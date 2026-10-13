import { relations, sql } from "drizzle-orm";
import {
    check,
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { GAME_IDS } from "../../games/registry";

/**
 * Bot runtime state — a BRAIN, not a special kind of player.
 *
 * A bot is a controller (`difficulty` + `config`) bound to exactly one
 * account, which it drives in that account's place:
 *   - `mode = 'pool'`     : the account is a minted inert identity
 *     (`user.is_bot = true`), claimed by rooms and played on its own.
 *   - `mode = 'attached'` : the account is an ordinary, operator-chosen
 *     account; the brain plays it in its place.
 *
 * The account side lives in two other tables:
 *   - `user`   (schema/auth.ts): the identity a brain is bound to.
 *   - `profiles` (schema/profiles.ts): the public gaming identity
 *     (gamer tag, avatar) — created once for minted accounts.
 *
 * The platform owns this table; the Colyseus server NEVER writes it.
 * It calls the signed internal endpoint (app/api/internal/bots) to
 * claim/release bots, so a single writer keeps the lease state honest
 * even with several game servers running.
 *
 * Pool model — one row per bot, one status at a time:
 *   - `idle`      : available to be claimed by a room.
 *   - `in_match`  : reserved by `leaseRoomId` for the duration of a
 *                   match. A crash without a `release` call is healed by
 *                   a stale-lease sweep (see provisioning.ts).
 *   - `disabled`  : retired by an operator; never claimed, row kept so
 *                   the user/profile it points at stay auditable.
 *
 * `leaseRoomId` has no foreign key on purpose: the room lives in the
 * Colyseus server's own store, not in this database.
 */

export const BOT_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type BotDifficulty = (typeof BOT_DIFFICULTIES)[number];

export function isBotDifficulty(value: string): value is BotDifficulty {
    return (BOT_DIFFICULTIES as readonly string[]).includes(value);
}

/**
 * How a brain is bound to an account:
 *   - `pool`     : the platform minted an inert account for it; it is
 *                  claimed by a room and plays on its own.
 *   - `attached` : an operator bound it to an EXISTING account so it
 *                  plays in that account's place.
 * The two modes are the same brain; only the account it drives differs.
 */
export const BOT_MODES = ["pool", "attached"] as const;
export type BotMode = (typeof BOT_MODES)[number];

export function isBotMode(value: string): value is BotMode {
    return (BOT_MODES as readonly string[]).includes(value);
}

/**
 * Operator-tunable strategy, kept separate from `difficulty` (the coarse
 * reasoning level the brain's move chooser already understands). Values
 * are normalised [0, 1] and defaulted; the brain reads them to weight its
 * decisions. Stored as JSON so a new lever needs no migration.
 */
export interface BotConfig {
    /** Bias toward capturing/racing ahead vs. playing safe. */
    aggression: number;
    /** Bias toward keeping pieces out of reach. */
    caution: number;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
    aggression: 0.5,
    caution: 0.5,
};

/** Clamp arbitrary input to a valid, fully-populated config. */
export function normalizeBotConfig(input?: Partial<BotConfig> | null): BotConfig {
    const clamp = (value: unknown, fallback: number): number => {
        if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
        return Math.min(1, Math.max(0, value));
    };
    return {
        aggression: clamp(input?.aggression, DEFAULT_BOT_CONFIG.aggression),
        caution: clamp(input?.caution, DEFAULT_BOT_CONFIG.caution),
    };
}

export const BOT_STATUSES = ["idle", "in_match", "disabled"] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

export function isBotStatus(value: string): value is BotStatus {
    return (BOT_STATUSES as readonly string[]).includes(value);
}

/**
 * Where a bot row came from. Kept open-ended (text, not an enum) so a
 * future "imported" origin needs no migration. `generated` = minted by
 * the auto-provisioner; `admin` = authored in the console.
 */
export const BOT_ORIGIN_GENERATED = "generated";
export const BOT_ORIGIN_ADMIN = "admin";

const GAME_ID_SQL_LIST = GAME_IDS.map((id) => `'${id}'`).join(", ");
const DIFFICULTY_SQL_LIST = BOT_DIFFICULTIES.map((d) => `'${d}'`).join(", ");
const STATUS_SQL_LIST = BOT_STATUSES.map((s) => `'${s}'`).join(", ");
const MODE_SQL_LIST = BOT_MODES.map((m) => `'${m}'`).join(", ");

export const bots = pgTable(
    "bot",
    {
        id: text("id").primaryKey(),

        /**
         * The backing user row. Unique: one bot account, one bot row —
         * prevents provisioning from ever double-seating the same
         * identity under two pool entries.
         */
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /**
         * Whether the brain owns a minted account (`pool`) or was bound
         * to an operator-chosen one (`attached`). The UNIQUE index on
         * `userId` still holds: one brain drives one account at a time.
         */
        mode: text("mode").notNull().default("pool"),

        /**
         * Operator-facing name for the console. Pure label — the public
         * identity stays the account's profile.
         */
        label: text("label"),

        /** Game the bot is reserved for (validated against the registry). */
        gameId: text("game_id").notNull(),

        /**
         * Coarse reasoning level the brain's move chooser understands.
         * Seed-picked at generation, but an operator may retune it at
         * any time (the "power" knob of the console).
         */
        difficulty: text("difficulty").notNull(),

        /**
         * Fine strategy knobs (JSON, see `BotConfig`). Null means "use
         * defaults"; a value is validated on write and defaulted on read
         * so a partial object can never reach the brain.
         */
        config: jsonb("config").$type<BotConfig>(),

        status: text("status").notNull().default("idle"),

        /** Room currently holding the bot (null when idle/disabled). */
        leaseRoomId: text("lease_room_id"),
        leasedAt: timestamp("leased_at"),

        /** "generated" today; free text so the origin story can grow. */
        origin: text("origin").notNull().default(BOT_ORIGIN_GENERATED),

        /** Last time the bot sat in a match — drives pool rotation. */
        lastUsedAt: timestamp("last_used_at"),

        /**
         * Admin who created or last re-bound this brain. Null for the
         * auto-provisioned pool rows (nobody authored those).
         */
        createdByAdminId: text("created_by_admin_id").references(
            () => user.id,
            { onDelete: "set null" },
        ),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("bot_user_uq").on(table.userId),

        /*
         * The claim query scans (gameId, status) then takes rows with
         * FOR UPDATE SKIP LOCKED — this index is what keeps that scan
         * cheap as the pool grows.
         */
        index("bot_pool_idx").on(table.gameId, table.status),

        /** Release / stale-lease sweep looks bots up by room. */
        index("bot_lease_idx").on(table.leaseRoomId),

        check(
            "bot_game_id_valid",
            sql`${table.gameId} in (${sql.raw(GAME_ID_SQL_LIST)})`,
        ),
        check(
            "bot_difficulty_valid",
            sql`${table.difficulty} in (${sql.raw(DIFFICULTY_SQL_LIST)})`,
        ),
        check(
            "bot_status_valid",
            sql`${table.status} in (${sql.raw(STATUS_SQL_LIST)})`,
        ),

        check(
            "bot_mode_valid",
            sql`${table.mode} in (${sql.raw(MODE_SQL_LIST)})`,
        ),

        /*
         * Lease columns are all-or-nothing: a bot is either leased (room
         * + timestamp) or not (both null). Makes a torn release — the
         * class of bug that silently loses a bot from the pool — a
         * constraint violation instead of a leak.
         */
        check(
            "bot_lease_consistent",
            sql`(${table.leaseRoomId} is null and ${table.leasedAt} is null) or (${table.leaseRoomId} is not null and ${table.leasedAt} is not null)`,
        ),
        check(
            "bot_status_lease_consistent",
            sql`(${table.status} = 'in_match' and ${table.leaseRoomId} is not null) or (${table.status} <> 'in_match' and ${table.leaseRoomId} is null)`,
        ),
    ],
);

export const botsRelations = relations(bots, ({ one }) => ({
    user: one(user, {
        fields: [bots.userId],
        references: [user.id],
    }),
}));

export type BotRow = typeof bots.$inferSelect;
export type NewBotRow = typeof bots.$inferInsert;
