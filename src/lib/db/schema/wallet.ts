import { relations, sql } from "drizzle-orm";
import {
  bigint,
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

/** Wallet domain schema — the ledger-backed internal points layer.
 *
 * Design rules (enforced here AND in lib/wallet/*):
 *
 *  - AMOUNTS ARE INTEGER MINOR UNITS. Every amount column is `bigint`
 *    (never float). With the unique PTS currency (exponent 0) the
 *    minor unit is the point itself; the `currency` column is kept so
 *    the invariant stays explicit everywhere.
 *  - DOUBLE ENTRY. A balance is never a mutable column: it is the sum
 *    of `ledger_entries` for the wallet. Every movement posts a set of
 *    entries that sums to ZERO across accounts (wallet vs
 *    `external:manual` clearing vs fee accounts). History is
 *    append-only — no application code updates or deletes a completed
 *    entry.
 *  - NO PROVIDER, NO RAIL. Points are credited manually by an
 *    administrator after an off-platform payment and debited by the
 *    platform itself (stakes, withdrawals, adjustments). Provider-specific
 *    payloads never exist here, only normalized state + sanitized
 *    metadata.
 *  - IDEMPOTENCY. Creation carries an idempotency key (unique) so a
 *    retried request can never open a second movement.
 *  - CASCADES exist only so a full account erasure can succeed; no
 *    product path ever deletes a transaction (the engine only ever
 *    appends state transitions and ledger entries).
 *
 * Tables live in dependency order (Drizzle relations below reference
 * earlier declarations):
 *
 *   wallets → wallet_transactions → ledger_entries
 */

// ---------------------------------------------------------------------------
// Wallet — the user-owned internal points account.
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
     * Uppercase currency code (the unique "PTS"). Explicit and immutable
     * per wallet: a wallet never converts — a different currency is a
     * different wallet row.
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
// Wallet movements — the header of every movement. Status only ever moves
// forward through the engine's guarded transitions.
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

    /** Currency code — asserted equal to the wallet's on every posting. */
    currency: text("currency").notNull(),

    /**
     * Fee breakdown, explicit and never hidden inside the amount.
     * The columns are kept (platform rake on stakes); they stay at 0
     * for plain manual credits/debits.
     */
    grossAmount: bigint("gross_amount", { mode: "number" }).notNull(),
    providerFee: bigint("provider_fee", { mode: "number" }).notNull().default(0),
    platformFee: bigint("platform_fee", { mode: "number" }).notNull().default(0),
    /** Wallet-side movement magnitude (integer minor units, >= 0). */
    netAmount: bigint("net_amount", { mode: "number" }).notNull(),

    /**
     * Client-supplied key that makes creation idempotent: the same key
     * ALWAYS maps to the same transaction row (unique), so a retried
     * request can never open a second movement.
     */
    idempotencyKey: text("idempotency_key"),

    /** Refund-like movement → the movement it reverses (append-only linkage). */
    originalTransactionId: text("original_transaction_id"),

    /**
     * Sanitized failure summary (no secrets, no raw payloads).
     */
    failureReason: text("failure_reason"),

    /** Sanitized, neutral extras (instructions, withdrawal reference…). */
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
    index("wallet_transactions_wallet_time_idx").on(
      table.walletId,
      table.createdAt,
    ),
    index("wallet_transactions_status_idx").on(table.status),
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
//   external:manual — clearing account for off-platform payments
//   escrow:<roomId> — per-match stake holding (system, walletId null)
//   fees:platform   — platform fee revenue
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
    // a compensating posting (rejection, refund) posts the INVERSE legs on
    // the SAME transaction and account, which such an index would reject.
    // The primary guard against a double posting is the status transition
    // performed under FOR UPDATE in the engine.
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
// Relations (used by the Drizzle query API where needed).
// ---------------------------------------------------------------------------
export const walletsRelations = relations(wallets, ({ many }) => ({
  transactions: many(walletTransactions),
  ledgerEntries: many(ledgerEntries),
}));

export const walletTransactionsRelations = relations(
  walletTransactions,
  ({ one, many }) => ({
    wallet: one(wallets, {
      fields: [walletTransactions.walletId],
      references: [wallets.id],
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
