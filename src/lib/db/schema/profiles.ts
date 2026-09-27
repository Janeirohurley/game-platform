import { relations, sql } from "drizzle-orm";
import {
    boolean,
    check,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { GAME_IDS } from "../../games/registry";

/**
 * Gamer profile schema.
 *
 * Responsibilities split:
 *   - `user` (Better Auth, schema/auth.ts): technical identity. Untouched.
 *   - `profiles`: public gaming identity + lifetime progression.
 *   - `game_stats`: per-game competitive record (one row per (user, game)).
 *   - `achievements` / `user_achievements`: catalogue + unlocks.
 *   - `game_matches`: one row per completed online match — the audit
 *     trail behind every stat and the source of "activité récente".
 *
 * Numbers on these tables are SERVER-owned: they are written only by the
 * realtime ingestion endpoint (app/api/profile/match-results), called by
 * the Colyseus server with the shared REALTIME_TOKEN_SECRET after a
 * match ends. No client mutation can touch them (see lib/validation and
 * the profile server actions).
 */

/**
 * Default competitive rating for a fresh per-game record. Elo-like:
 * every player starts from the same baseline and drifts from there.
 */
export const DEFAULT_RATING = 1200;
/**
 * Baseline for the global profile rating — a rough blend of the
 * per-game ratings, purely presentational. Defined here so the
 * ingestion path and the profile queries agree on it.
 */
export const DEFAULT_GLOBAL_RATING = 1200;

/**
 * Level curve shared by the ingestion path and the profile queries:
 * reaching level N costs N-1 level-ups of `XP_PER_LEVEL` each.
 * Level 1 starts at 0 XP, level 2 needs 100, level 10 needs 900…
 * Deliberately simple and documented — the client reads it, only the
 * server writes it.
 */
export const XP_PER_LEVEL = 100;

export function xpForLevel(level: number): number {
    return Math.max(0, level - 1) * XP_PER_LEVEL;
}

export function levelForXp(xp: number): number {
    return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

/** Static, safe-to-interpolate list of registry game ids for checks. */
const GAME_ID_SQL_LIST = GAME_IDS.map((id) => `'${id}'`).join(", ");

export const profiles = pgTable(
    "profiles",
    {
        /*
         * Identity: `username` is the public gamer tag (unique, 3-24,
         * [a-zA-Z0-9_] — DB checks below). The platform `user.id` stays
         * the technical key; nothing here duplicates Better Auth.
         */
        userId: text("user_id")
            .primaryKey()
            .references(() => user.id, {
                onDelete: "cascade",
            }),

        username: text("username").notNull().unique(),

        displayName: text("display_name"),

        bio: text("bio"),

        avatarUrl: text("avatar_url"),

        countryCode: text("country_code"),

        /*
         * Presentation: a wide cover image for the gamer profile header,
         * separate from the square avatar. No product surface sets it
         * yet — the column exists so the header has a real field to
         * grow into (null = the UI falls back to the plain header).
         */
        coverUrl: text("cover_url"),

        /*
         * Gamer-tag history: when the tag changes, the old one is kept
         * with its release date so it stays reserved for a short
         * quarantine window (squatter protection on released names;
         * enforced by saveProfile, not by the DB).
         */
        previousUsername: text("previous_username"),
        usernameChangedAt: timestamp("username_changed_at"),

        /*
         * Gaming preferences: languages spoken (BCP-47 stems, e.g.
         * "fr", "en") and favorite games (registry ids). Written only
         * by the owner's server actions; exposed like the rest of the
         * profile, i.e. only while isPublic allows it.
         */
        languages: jsonb("languages"),
        favoriteGames: jsonb("favorite_games"),

        /*
         * Privacy aid: how many signed-in visitors were turned away by
         * the private toggle. Informational, owner-visible only.
         */
        privateVisits: integer("private_visits").notNull().default(0),

        /*
         * Global progression. Server-owned: written only by the realtime
         * ingestion endpoint, never by a client payload. `level` is
         * derived from `xp` and stored so it can be indexed and listed.
         */
        level: integer("level").notNull().default(1),
        xp: integer("xp").notNull().default(0),
        rating: integer("rating").notNull().default(DEFAULT_GLOBAL_RATING),

        /*
         * Lifetime aggregates, updated in the same transaction as the
         * match rows by the ingestion path. Other windows (recent
         * activity, per-game breakdowns) are derived from game_matches
         * on demand — see lib/profile/queries.ts.
         */
        gamesPlayed: integer("games_played").notNull().default(0),
        wins: integer("wins").notNull().default(0),
        losses: integer("losses").notNull().default(0),
        draws: integer("draws").notNull().default(0),
        currentStreak: integer("current_streak").notNull().default(0),
        bestStreak: integer("best_streak").notNull().default(0),
        totalPlaySeconds: integer("total_play_seconds").notNull().default(0),
        lastPlayedAt: timestamp("last_played_at"),

        isPublic: boolean("is_public").notNull().default(true),

        createdAt: timestamp("created_at").defaultNow().notNull(),

        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("profiles_level_idx").on(table.level),

        check(
            "profiles_username_length",
           sql`char_length(${table.username}) between 3 and 24`,
        ),

        check(
            "profiles_username_format",
             sql`${table.username} ~ '^[a-zA-Z0-9_]+$'`,
        ),

        check(
            "profiles_country_code_length",
            sql`${table.countryCode} is null or char_length(${table.countryCode}) = 2`,
        ),

        check("profiles_level_positive", sql`${table.level} >= 1`),
        check("profiles_xp_non_negative", sql`${table.xp} >= 0`),
        check(
            "profiles_counts_non_negative",
            sql`${table.gamesPlayed} >= 0 and ${table.wins} >= 0 and ${table.losses} >= 0 and ${table.draws} >= 0`,
        ),
    ],
);

/**
 * Per-game competitive record — Ludo, Checkers, Rally and any future
 * game that registers a room. Keyed (userId, gameId): one row per game
 * a player has touched. Columns mirror the profile's lifetime block so
 * the UI needs no per-game if/else anywhere; `gameId` is validated
 * against the platform registry.
 *
 * Never invent `ludoWins`-style columns: this table IS the generic
 * structure for every game.
 */
export const gameStats = pgTable(
    "game_stats",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Stable game id — matches the platform and server registries. */
        gameId: text("game_id").notNull(),

        gamesPlayed: integer("games_played").notNull().default(0),
        wins: integer("wins").notNull().default(0),
        losses: integer("losses").notNull().default(0),
        draws: integer("draws").notNull().default(0),

        /** Competitive rating for THIS game (Elo-like, 1200 baseline). */
        rating: integer("rating").notNull().default(DEFAULT_RATING),

        bestStreak: integer("best_streak").notNull().default(0),
        currentStreak: integer("current_streak").notNull().default(0),
        totalPlaySeconds: integer("total_play_seconds").notNull().default(0),
        lastPlayedAt: timestamp("last_played_at"),

        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        uniqueIndex("game_stats_user_game_uq").on(table.userId, table.gameId),
        check(
            "game_stats_game_id_valid",
            sql`${table.gameId} in (${sql.raw(GAME_ID_SQL_LIST)})`,
        ),
        check(
            "game_stats_counts_non_negative",
            sql`${table.gamesPlayed} >= 0 and ${table.wins} >= 0 and ${table.losses} >= 0 and ${table.draws} >= 0`,
        ),
        check("game_stats_rating_positive", sql`${table.rating} >= 100`),
    ],
);

/**
 * Global achievement catalogue. Static reference data, seeded from
 * `lib/profile/achievements.ts`; rows are content, not state.
 */
export const achievements = pgTable(
    "achievements",
    {
        /** Stable slug used by the unlock rules ("first-win", …). */
        code: text("code").primaryKey(),

        name: text("name").notNull(),
        description: text("description").notNull(),

        /** Short glyph rendered in the profile grid. */
        icon: text("icon").notNull().default("★"),

        /**
         * Null = global (any game counts). Set = specific game,
         * validated against the platform registry.
         */
        gameId: text("game_id"),

        /** Display order inside the profile grid. */
        sortOrder: integer("sort_order").notNull().default(0),

        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "achievements_game_id_valid",
            sql`${table.gameId} is null or ${table.gameId} in (${sql.raw(GAME_ID_SQL_LIST)})`,
        ),
    ],
);

/**
 * A player's unlocked achievements. Written only by the ingestion path
 * when a real match result satisfies a rule — never on profile views.
 */
export const userAchievements = pgTable(
    "user_achievements",
    {
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        achievementId: text("achievement_id")
            .notNull()
            .references(() => achievements.code, { onDelete: "cascade" }),

        unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),

        /** Free-form context snapshot (match id, streak reached, …). */
        metadata: jsonb("metadata"),
    },
    (table) => [
        primaryKey({
            columns: [table.userId, table.achievementId],
        }),
        index("user_achievements_user_idx").on(table.userId),
    ],
);

/**
 * One row per completed online match per participant — the source of
 * truth for recent activity and the audit trail behind every stat
 * number. Written once by the realtime server's ingestion call,
 * deduplicated on (roomId, userId), and read by the profile queries.
 * Nothing else mutates it.
 */
export const gameMatches = pgTable(
    "game_matches",
    {
        /** Server-generated primary key (uuid). */
        id: text("id").primaryKey(),

        /** The Colyseus room that produced the result (dedupe key). */
        roomId: text("room_id").notNull(),

        /** The participant this row describes. */
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        gameId: text("game_id").notNull(),

        /** Seat order at match end, so activity can show the table. */
        seat: integer("seat").notNull().default(0),

        outcome: text("outcome").notNull(), // "win" | "loss" | "draw"

        /** Rating before/after, so history can show the delta. */
        ratingBefore: integer("rating_before").notNull().default(0),
        ratingAfter: integer("rating_after").notNull().default(0),

        /** Earned at match end, mirrored into the profile row. */
        xpEarned: integer("xp_earned").notNull().default(0),

        durationSeconds: integer("duration_seconds").notNull().default(0),

        /** How many players were seated at the end. */
        playerCount: integer("player_count").notNull().default(0),

        /** Opponents' user ids — powers “Défaite contre @Alex”. */
        opponentIds: jsonb("opponent_ids"),

        playedAt: timestamp("played_at").defaultNow().notNull(),
    },
    (table) => [
        // One result per (room, user): a replayed ingestion call is a no-op.
        uniqueIndex("game_matches_room_user_uq").on(table.roomId, table.userId),
        index("game_matches_user_time_idx").on(table.userId, table.playedAt),
        check(
            "game_matches_game_id_valid",
            sql`${table.gameId} in (${sql.raw(GAME_ID_SQL_LIST)})`,
        ),
        check(
            "game_matches_outcome_valid",
            sql`${table.outcome} in ('win', 'loss', 'draw')`,
        ),
    ],
);

export const profilesRelations = relations(profiles, ({ one, many }) => ({
    user: one(user, {
        fields: [profiles.userId],
        references: [user.id],
    }),
    stats: many(gameStats),
    matches: many(gameMatches),
}));

export const gameStatsRelations = relations(gameStats, ({ one }) => ({
    user: one(user, {
        fields: [gameStats.userId],
        references: [user.id],
    }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
    unlocked: many(userAchievements),
}));

export const userAchievementsRelations = relations(
    userAchievements,
    ({ one }) => ({
        user: one(user, {
            fields: [userAchievements.userId],
            references: [user.id],
        }),
        achievement: one(achievements, {
            fields: [userAchievements.achievementId],
            references: [achievements.code],
        }),
    }),
);
