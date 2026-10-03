import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import {
  WALLET_TRANSACTION_STATUSES,
  WALLET_TRANSACTION_TYPES,
} from "../../wallet/constants";

/** Static, safe-to-interpolate lists for the CHECK constraints below
 * (same pattern as profiles.ts GAME_ID_SQL_LIST) — the DB vocabulary
 * is built from the canonical arrays in lib/wallet/constants.ts, so
 * code and schema can never drift apart. */
const TYPE_SQL_LIST = WALLET_TRANSACTION_TYPES.map((t) => `'${t}'`).join(", ");
const STATUS_SQL_LIST = WALLET_TRANSACTION_STATUSES.map((s) => `'${s}'`).join(", ");

/**
 * Wallet domain schema — the ledger-backed money layer.
 *
 * Design rules (enforced here AND in lib/wallet/*):
 *
 *  - MONEY IS INTEGER MINOR UNITS. Every amount column is `bigint`
 *    (never float): 10000 BIF, 1999 (= 19.99 USD). Every amount
 *    carries an explicit ISO-4217 `currency` — the wallet never
 *    converts currencies silently.
 *  - DOUBLE ENTRY. A balance is never a mutable column: it is the sum
 *    of `ledger_entries` for the wallet. Every money movement posts a
 *    set of entries that sums to ZERO across accounts (wallet vs
 *    external clearing vs fee accounts). History is append-only — no
 *    application code updates or deletes a completed entry.
 *  - THE WALLET IS NOT THE PROVIDER. `wallet_transactions` reference a
 *    provider by registry id; provider-specific payloads never land
 *    here, only normalized state + sanitized metadata.
 *  - IDEMPOTENCY. Every external operation carries an idempotency key
 *    (unique) and, once accepted by a provider, a provider transaction
 *    id (unique per provider) — duplicate requests and duplicate
 *    webhooks can never move money twice.
 *  - CASCADES exist only so a full account erasure can succeed; no
 *    product path ever deletes a transaction (the engine only ever
 *    appends state transitions and ledger entries).
 *
 * Tables live in dependency order (Drizzle relations below reference
 * earlier declarations):
 *
 *   wallets → provider_accounts → wallet_transactions → ledger_entries
 *                                                       → reconciliation_records
 */

// ---------------------------------------------------------------------------
// Wallet — the user-owned internal account, independent from any provider.
// ---------------------------------------------------------------------------

export const wallets = pgTable(
  "wallets",
  {
    id: text("id").primaryKey(),

    /** Owner (Better Auth user). One user may hold one wallet per currency. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    /**
     * ISO-4217 code, uppercase. Explicit and immutable per wallet:
     * a wallet never converts — a different currency is a different
     * wallet row (future multi-currency support without touching money
     * logic).
     */
    currency: text("currency").notNull(),

    status: text("status").notNull().default("active"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // One wallet per (user, currency) — created lazily, never duplicated
    // under concurrent first requests (insert … on conflict).
    uniqueIndex("wallets_user_currency_uq").on(table.userId, table.currency),
    index("wallets_user_idx").on(table.userId),
    check("wallets_currency_format", sql`char_length(${table.currency}) = 3`),
    check(
      "wallets_status_valid",
      sql`${table.status} in ('active', 'frozen', 'closed')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Provider accounts — a connected EXTERNAL account (mobile-money number,
// bank account, card). Identified, masked, never a secret store: no
// credentials, no CVV, no tokens (those live in env/secret management).
// ---------------------------------------------------------------------------

export const providerAccounts = pgTable(
  "provider_accounts",
  {
    id: text("id").primaryKey(),

    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),

    /** Registry id of the provider this account belongs to. */
    provider: text("provider").notNull(),

    /** External identifier (masked for display; NOT a secret). */
    providerAccountId: text("provider_account_id").notNull(),

    accountType: text("account_type").notNull().default("other"),

    /** Human label, already masked by the connect flow ("•••• 4242"). */
    displayName: text("display_name"),

    currency: text("currency"),

    status: text("status").notNull().default("active"),

    /**
     * Sanitized, non-secret extras (issuer, country, last4…). The
     * connect service runs an allowlist — raw provider payloads are
     * rejected, secrets are never persisted here.
     */
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("provider_accounts_wallet_provider_account_uq").on(
      table.walletId,
      table.provider,
      table.providerAccountId,
    ),
    index("provider_accounts_wallet_idx").on(table.walletId),
    index("provider_accounts_provider_idx").on(table.provider),
    check(
      "provider_accounts_type_valid",
      sql`${table.accountType} in ('mobile_money', 'bank', 'card', 'digital_wallet', 'other')`,
    ),
    check(
      "provider_accounts_status_valid",
      sql`${table.status} in ('active', 'disconnected', 'expired', 'error')`,
    ),
    check(
      "provider_accounts_currency_format",
      sql`${table.currency} is null or char_length(${table.currency}) = 3`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Wallet transactions — the header of every money movement. Status only
// ever moves forward through the engine's guarded transitions.
// Types/statuses come from lib/wallet/constants.ts (see SQL lists above).
// ---------------------------------------------------------------------------

export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: text("id").primaryKey(),

    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),

    type: text("type").notNull(),
    status: text("status").notNull().default("created"),

    /** ISO-4217 — asserted equal to the wallet's on every posting. */
    currency: text("currency").notNull(),

    /**
     * Fee breakdown, explicit and never hidden inside the amount:
     *   deposit   : netAmount = grossAmount (credited); the rail moves
     *               grossAmount + providerFee + platformFee inbound.
     *   withdrawal: netAmount = grossAmount + providerFee + platformFee
     *               (debited from the wallet); the rail moves
     *               grossAmount outbound.
     */
    grossAmount: bigint("gross_amount", { mode: "number" }).notNull(),
    providerFee: bigint("provider_fee", { mode: "number" }).notNull().default(0),
    platformFee: bigint("platform_fee", { mode: "number" }).notNull().default(0),
    /** Wallet-side movement magnitude (integer minor units, >= 0). */
    netAmount: bigint("net_amount", { mode: "number" }).notNull(),

    /** Registry id of the payment provider ("sandbox-momo", …). */
    provider: text("provider"),
    /** Connected external account this operation used, when any. */
    providerAccountId: text("provider_account_id"),
    /** External reference once the provider accepted the operation. */
    providerTransactionId: text("provider_transaction_id"),

    /**
     * Client-supplied key that makes creation idempotent: the same key
     * ALWAYS maps to the same transaction row (unique), so a retried
     * request can never open a second money movement.
     */
    idempotencyKey: text("idempotency_key"),

    /** Refund → the deposit it reverses (append-only linkage). */
    originalTransactionId: text("original_transaction_id"),

    /**
     * Sanitized failure summary (no secrets, no provider payloads —
     * the adapter decides what is safe to expose).
     */
    failureReason: text("failure_reason"),

    /** Sanitized, provider-agnostic extras (instructions, masked msisdn…). */
    metadata: jsonb("metadata"),

    expiresAt: timestamp("expires_at"),
    completedAt: timestamp("completed_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("wallet_transactions_idem_uq").on(table.idempotencyKey),
    // One internal transaction per external provider transaction — a
    // replayed webhook can never resolve to two different rows.
    uniqueIndex("wallet_transactions_provider_txn_uq").on(
      table.provider,
      table.providerTransactionId,
    ),
    index("wallet_transactions_wallet_time_idx").on(
      table.walletId,
      table.createdAt,
    ),
    index("wallet_transactions_status_idx").on(table.status),
    index("wallet_transactions_provider_idx").on(table.provider),
    index("wallet_transactions_type_idx").on(table.type),
    index("wallet_transactions_created_idx").on(table.createdAt),
    check(
      "wallet_transactions_currency_format",
      sql`char_length(${table.currency}) = 3`,
    ),
    check(
      "wallet_transactions_type_valid",
      sql`${table.type} in (${sql.raw(TYPE_SQL_LIST)})`,
    ),
    check(
      "wallet_transactions_status_valid",
      sql`${table.status} in (${sql.raw(STATUS_SQL_LIST)})`,
    ),
    check("wallet_transactions_gross_positive", sql`${table.grossAmount} > 0`),
    check("wallet_transactions_net_positive", sql`${table.netAmount} >= 0`),
    check(
      "wallet_transactions_fees_non_negative",
      sql`${table.providerFee} >= 0 and ${table.platformFee} >= 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Ledger entries — immutable double-entry postings. `amount_minor` is
// SIGNED: positive = money into the account, negative = money out, and
// all entries of one transaction sum to zero.
//
// Accounts:
//   wallet          — the wallet side (walletId set, balance = SUM)
//   external:<id>   — clearing account of a payment provider
//   fees:platform   — platform fee revenue
//   fees:provider   — provider fee
// ---------------------------------------------------------------------------

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),

    transactionId: text("transaction_id")
      .notNull()
      .references(() => walletTransactions.id, { onDelete: "cascade" }),

    /** Set for the wallet side of the posting; null for system accounts. */
    walletId: text("wallet_id").references(() => wallets.id, {
      onDelete: "cascade",
    }),

    account: text("account").notNull(),

    /** Signed integer minor units; the whole transaction sums to 0. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),

    currency: text("currency").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // NOTE: deliberately NO unique (transaction, account, wallet) index —
    // a compensating posting (cancel/expire/fail of a withdrawal) posts
    // the INVERSE legs on the SAME transaction and account, which such
    // an index would reject. The primary guard against a double posting
    // is the status transition performed under FOR UPDATE in the engine.
    index("ledger_entries_wallet_time_idx").on(table.walletId, table.createdAt),
    index("ledger_entries_transaction_idx").on(table.transactionId),
    check("ledger_entries_amount_non_zero", sql`${table.amountMinor} <> 0`),
    check(
      "ledger_entries_currency_format",
      sql`char_length(${table.currency}) = 3`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Reconciliation — discrepancies are RECORDED, never silently corrected.
// `dedupeKey` keeps repeated runs from piling up duplicate findings.
// ---------------------------------------------------------------------------

export const reconciliationRecords = pgTable(
  "reconciliation_records",
  {
    id: text("id").primaryKey(),

    provider: text("provider").notNull(),
    transactionId: text("transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    providerTransactionId: text("provider_transaction_id"),

    issueType: text("issue_type").notNull(),
    severity: text("severity").notNull().default("warning"),
    status: text("status").notNull().default("open"),

    /** Sanitized evidence (amounts, statuses, ids — never secrets). */
    details: jsonb("details"),

    /** Stable fingerprint so a re-run reports, not duplicates. */
    dedupeKey: text("dedupe_key").notNull().unique(),

    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id"),
  },
  (table) => [
    index("reconciliation_records_status_idx").on(table.status),
    index("reconciliation_records_provider_idx").on(table.provider),
    index("reconciliation_records_detected_idx").on(table.detectedAt),
    check(
      "reconciliation_records_issue_valid",
      sql`${table.issueType} in ('missing_provider_transaction', 'missing_ledger_transaction', 'duplicate_transaction', 'amount_mismatch', 'currency_mismatch', 'status_mismatch', 'ledger_imbalance', 'negative_balance')`,
    ),
    check(
      "reconciliation_records_severity_valid",
      sql`${table.severity} in ('info', 'warning', 'critical')`,
    ),
    check(
      "reconciliation_records_status_valid",
      sql`${table.status} in ('open', 'acknowledged', 'resolved')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Provider events — the webhook/event log. One row per provider event,
// UNIQUE per (provider, provider_event_id): the uniqueness constraint IS
// the duplicate-webhook guard — a replay conflicts and is answered with
// success without touching money. Insert + processing happen in the same
// database transaction, so a failed processing rolls the event back and
// the provider's retry can attempt it again.
// ---------------------------------------------------------------------------

export const providerEvents = pgTable(
  "provider_events",
  {
    id: text("id").primaryKey(),

    provider: text("provider").notNull(),
    /** Event id assigned by the provider — the dedupe key. */
    providerEventId: text("provider_event_id").notNull(),

    /** Normalized event type ("deposit.succeeded"…, "unknown"). */
    type: text("type").notNull(),

    status: text("status").notNull().default("received"),

    /** Signature verification outcome (events that fail never insert). */
    signatureValid: boolean("signature_valid").notNull(),

    /** Internal transaction the event resolved to, when any. */
    transactionId: text("transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    providerTransactionId: text("provider_transaction_id"),

    /** Sanitized normalized payload (never the raw provider body). */
    payload: jsonb("payload"),
    error: text("error"),

    receivedAt: timestamp("received_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    uniqueIndex("provider_events_provider_event_uq").on(
      table.provider,
      table.providerEventId,
    ),
    index("provider_events_transaction_idx").on(table.transactionId),
    index("provider_events_received_idx").on(table.receivedAt),
    index("provider_events_provider_idx").on(table.provider),
    check(
      "provider_events_status_valid",
      sql`${table.status} in ('received', 'processed', 'failed', 'ignored')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Provider configuration — runtime, DB-backed settings per provider so a
// provider can be enabled/disabled, limited and re-priced WITHOUT code
// changes. Secrets NEVER live here: they come from the environment.
// ---------------------------------------------------------------------------

export const providerConfigs = pgTable(
  "provider_configs",
  {
    /** Registry id of the adapter — NOT a foreign key by design: a
     * provider row can exist before (or after) its adapter ships. */
    provider: text("provider").primaryKey(),

    enabled: boolean("enabled").notNull().default(true),

    /** Display override shown to users (falls back to the adapter name). */
    displayName: text("display_name"),

    environment: text("environment").notNull().default("sandbox"),

    /**
     * Effective capability restriction: NULL = every capability the
     * adapter declares; otherwise the INTERSECTION with the adapter's.
     * The wallet only ever trusts the intersection, so configuration
     * can narrow — never widen — what an adapter can do.
     */
    capabilities: text("capabilities").array(),

    /** NULL = currencies allowed by the adapter/wallet. */
    supportedCurrencies: text("supported_currencies").array(),

    supportedCountries: text("supported_countries").array(),

    /** Operating limits in integer minor units (NULL = unlimited). */
    minimumAmount: bigint("minimum_amount", { mode: "number" }),
    maximumAmount: bigint("maximum_amount", { mode: "number" }),

    /**
     * Fee schedule, explicit and replaceable at runtime:
     * { platformBps, providerBps, platformFixedMinor, providerFixedMinor }
     * (bps = basis points of the gross amount; fixed = minor units).
     * NULL = zero fees.
     */
    fees: jsonb("fees"),

    /**
     * Non-secret operational knobs (base URL, timeout ms, expiry
     * minutes…). Anything secret stays in the environment.
     */
    configuration: jsonb("configuration"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "provider_configs_environment_valid",
      sql`${table.environment} in ('sandbox', 'production')`,
    ),
    check(
      "provider_configs_limits_ordered",
      sql`${table.minimumAmount} is null or ${table.maximumAmount} is null or ${table.minimumAmount} <= ${table.maximumAmount}`,
    ),
    check(
      "provider_configs_limits_non_negative",
      sql`${table.minimumAmount} is null or ${table.minimumAmount} >= 0`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(user, {
    fields: [wallets.userId],
    references: [user.id],
  }),
  transactions: many(walletTransactions),
  providerAccounts: many(providerAccounts),
}));

export const providerAccountsRelations = relations(
  providerAccounts,
  ({ one }) => ({
    wallet: one(wallets, {
      fields: [providerAccounts.walletId],
      references: [wallets.id],
    }),
  }),
);

export const walletTransactionsRelations = relations(
  walletTransactions,
  ({ one, many }) => ({
    wallet: one(wallets, {
      fields: [walletTransactions.walletId],
      references: [wallets.id],
    }),
    providerAccount: one(providerAccounts, {
      fields: [walletTransactions.providerAccountId],
      references: [providerAccounts.id],
    }),
    ledgerEntries: many(ledgerEntries),
  }),
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  transaction: one(walletTransactions, {
    fields: [ledgerEntries.transactionId],
    references: [walletTransactions.id],
  }),
  wallet: one(wallets, {
    fields: [ledgerEntries.walletId],
    references: [wallets.id],
  }),
}));
