import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { wallets, walletTransactions } from "./wallet";
import {
  MAX_RATE_VALUE,
  WITHDRAWAL_REQUEST_STATUS_SQL,
} from "../../wallet/points-types";

/**
 * Manual points layer — the replacement for the provider/payment rail.
 *
 *  - `wallet_settings` holds the SINGLE tariff row (`id = 'default'`):
 *    how many points one currency unit buys, how much money one point
 *    is worth on withdrawal, the minimum withdrawal and the stake
 *    bounds. Tariffs are data, never hard-coded.
 *  - `withdrawal_requests` is the admin queue. The points are debited
 *    from the ledger the moment the request is created (see
 *    `lib/wallet/withdrawal-requests.ts`), so the balance shown to the
 *    user is always the spendable one. A rejection posts the inverse
 *    movement; a payment only advances the status.
 */

export const walletSettings = pgTable(
  "wallet_settings",
  {
    /** Always `default` — enforced by the CHECK below. */
    id: text("id").primaryKey(),

    /** Currency the two rates are expressed in (display only). */
    currency: text("currency").notNull().default("BIF"),

    /** Points credited per ONE major unit of `currency`. */
    buyPointsPerUnit: integer("buy_points_per_unit").notNull().default(100),

    /** `currency` minor units paid per ONE point on withdrawal. */
    sellMinorPerPoint: integer("sell_minor_per_point").notNull().default(10),

    /** Minimum amount a user may request to withdraw. */
    minWithdrawalPoints: bigint("min_withdrawal_points", { mode: "number" })
      .notNull()
      .default(1000),

    /** Stake bounds advertised to the game rooms. */
    minStakePoints: bigint("min_stake_points", { mode: "number" })
      .notNull()
      .default(10),
    maxStakePoints: bigint("max_stake_points", { mode: "number" })
      .notNull()
      .default(100_000),

    /** Free-form instructions shown on the "buy points" screen. */
    contactInstructions: text("contact_instructions").notNull().default(""),

    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("wallet_settings_singleton", sql`${table.id} = 'default'`),
    check(
      "wallet_settings_currency_format",
      sql`char_length(${table.currency}) = 3`,
    ),
    check(
      "wallet_settings_buy_rate_valid",
      sql`${table.buyPointsPerUnit} > 0 and ${table.buyPointsPerUnit} <= ${sql.raw(String(MAX_RATE_VALUE))}`,
    ),
    check(
      "wallet_settings_sell_rate_valid",
      sql`${table.sellMinorPerPoint} > 0 and ${table.sellMinorPerPoint} <= ${sql.raw(String(MAX_RATE_VALUE))}`,
    ),
    check(
      "wallet_settings_min_withdrawal_positive",
      sql`${table.minWithdrawalPoints} > 0`,
    ),
    check("wallet_settings_min_stake_positive", sql`${table.minStakePoints} > 0`),
    check(
      "wallet_settings_max_stake_valid",
      sql`${table.maxStakePoints} >= ${table.minStakePoints}`,
    ),
  ],
);

export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: text("id").primaryKey(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    walletId: text("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),

    /** Points requested — debited at creation. */
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("PTS"),

    status: text("status").notNull().default("pending"),

    /**
     * Client idempotency key (namespaced per user when written). A
     * retried request returns the SAME row instead of debiting twice.
     */
    idempotencyKey: text("idempotency_key").notNull(),

    /** Optional note from the user (payment destination, reference…). */
    userNote: text("user_note"),
    /** Mandatory reason when an administrator rejects. */
    adminNote: text("admin_note"),

    /** The debit movement created with the request (append-only). */
    debitTransactionId: text("debit_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),
    /** The compensating movement posted on rejection. */
    refundTransactionId: text("refund_transaction_id").references(
      () => walletTransactions.id,
      { onDelete: "set null" },
    ),

    /** Administrator who approved/rejected/paid (user.id, no FK on purpose). */
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at"),
    paidAt: timestamp("paid_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("withdrawal_requests_idem_uq").on(table.idempotencyKey),
    index("withdrawal_requests_user_idx").on(table.userId, table.createdAt),
    index("withdrawal_requests_status_idx").on(table.status, table.createdAt),
    check("withdrawal_requests_amount_positive", sql`${table.amountMinor} > 0`),
    check(
      "withdrawal_requests_currency_format",
      sql`char_length(${table.currency}) = 3`,
    ),
    check(
      "withdrawal_requests_status_valid",
      sql`${table.status} in (${sql.raw(WITHDRAWAL_REQUEST_STATUS_SQL)})`,
    ),
  ],
);
