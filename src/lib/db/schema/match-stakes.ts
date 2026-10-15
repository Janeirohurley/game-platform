import { relations, sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { walletTransactions } from "./wallet";
import { GAME_IDS } from "../../games/registry";
import {
  MATCH_STAKE_HOLD_STATUS_SQL,
  MATCH_STAKE_STATUS_SQL,
} from "../../wallet/stake-types";

const GAME_ID_SQL_LIST = GAME_IDS.map((id) => `'${id}'`).join(", ");

export const matchStakes = pgTable(
  "match_stakes",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    gameId: text("game_id").notNull(),
    currency: text("currency").notNull(),
    stakeMinor: bigint("stake_minor", { mode: "number" }).notNull(),
    rakeBps: integer("rake_bps").notNull().default(0),
    status: text("status").notNull().default("open"),
    winnerUserId: text("winner_user_id"),
    potMinor: bigint("pot_minor", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at"),
    settledAt: timestamp("settled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("match_stakes_room_id_uq").on(table.roomId),
    index("match_stakes_status_idx").on(table.status),
    index("match_stakes_game_id_idx").on(table.gameId),
    check("match_stakes_game_id_valid", sql`${table.gameId} in (${sql.raw(GAME_ID_SQL_LIST)})`),
    check("match_stakes_currency_format", sql`char_length(${table.currency}) = 3`),
    check("match_stakes_stake_positive", sql`${table.stakeMinor} > 0`),
    check("match_stakes_pot_non_negative", sql`${table.potMinor} >= 0`),
    check("match_stakes_rake_bps_valid", sql`${table.rakeBps} >= 0 and ${table.rakeBps} <= 10000`),
    check("match_stakes_status_valid", sql`${table.status} in (${sql.raw(MATCH_STAKE_STATUS_SQL)})`),
  ],
);

export const matchStakeHolds = pgTable(
  "match_stake_holds",
  {
    matchStakeId: text("match_stake_id")
      .notNull()
      .references(() => matchStakes.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    transactionId: text("transaction_id").references(() => walletTransactions.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("held"),
  },
  (table) => [
    primaryKey({ columns: [table.matchStakeId, table.userId] }),
    index("match_stake_holds_user_id_idx").on(table.userId),
    index("match_stake_holds_status_idx").on(table.status),
    check("match_stake_holds_amount_positive", sql`${table.amountMinor} > 0`),
    check("match_stake_holds_status_valid", sql`${table.status} in (${sql.raw(MATCH_STAKE_HOLD_STATUS_SQL)})`),
  ],
);

export const matchStakesRelations = relations(matchStakes, ({ many }) => ({
  holds: many(matchStakeHolds),
}));

export const matchStakeHoldsRelations = relations(matchStakeHolds, ({ one }) => ({
  matchStake: one(matchStakes, {
    fields: [matchStakeHolds.matchStakeId],
    references: [matchStakes.id],
  }),
  user: one(user, {
    fields: [matchStakeHolds.userId],
    references: [user.id],
  }),
  transaction: one(walletTransactions, {
    fields: [matchStakeHolds.transactionId],
    references: [walletTransactions.id],
  }),
}));
