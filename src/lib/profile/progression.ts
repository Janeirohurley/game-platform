/**
 * Pure progression rules — no database, fully testable.
 *
 * The ingestion endpoint (app/api/profile/match-results/route.ts) owns
 * one authoritative record per participant and feeds it through here;
 * the returned deltas are what get written to profiles, game_stats and
 * game_matches in a single transaction. Clients never call this: the
 * only caller is server-side and authenticated by REALTIME_TOKEN_SECRET.
 */

import { XP_PER_LEVEL } from "@/lib/db/schema/profiles";

/** One finished match from one participant's point of view. */
export interface ParticipantResult {
    userId: string;
    /** Stable registry id of the game that was played. */
    gameId: string;
    /** "win" | "loss" | "draw" — decided by the room, not the player. */
    outcome: "win" | "loss" | "draw";
    /** Server-measured match duration, in seconds. */
    durationSeconds: number;
    /** Number of seated players at match end. */
    playerCount: number;
    /** Seat index at match end (0 when the game does not use seats). */
    seat?: number;
    /** Streak state BEFORE this match (read inside the transaction). */
    currentStreak: number;
    bestStreak: number;
}

/** Per-participant deltas to persist for a finished match. */
export interface ParticipantDeltas {
    userId: string;
    gameId: string;
    outcome: ParticipantResult["outcome"];
    xpEarned: number;
    ratingDelta: number;
    /** Streak after this match (signed; negative = active loss streak). */
    currentStreak: number;
    /** True when the new streak's magnitude beats the stored best. */
    isBestStreak: boolean;
    durationSeconds: number;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** XP earned for one match, by outcome. Deliberately modest numbers. */
export function matchXp(
    outcome: ParticipantResult["outcome"],
    playerCount: number,
): number {
    switch (outcome) {
        case "win":
            // Bigger tables are harder to win — a touch more XP.
            return playerCount >= 3 ? 30 : 20;
        case "draw":
            return 10;
        case "loss":
            return 5;
    }
}

/**
 * Elo-like swing for a single match. The absolute value is a house
 * number: simple, clamped, boring on purpose — the point is a credible
 * per-game rating that moves without exploding, not FIDE accuracy.
 */
export function ratingDelta(
    outcome: ParticipantResult["outcome"],
    playerCount: number,
): number {
    const swing = clamp((playerCount - 1) * 16, 8, 48);
    switch (outcome) {
        case "win":
            return swing;
        case "loss":
            return -swing;
        case "draw":
            return Math.round(swing / 4); // a draw drifts slightly up
    }
}

/**
 * Streak after the match. Wins count up, losses count down (negative =
 * active loss streak), a draw preserves whatever was running.
 */
export function nextStreak(
    current: number,
    outcome: ParticipantResult["outcome"],
): number {
    if (outcome === "win") return current > 0 ? current + 1 : 1;
    if (outcome === "loss") return current < 0 ? current - 1 : -1;
    return current;
}

export function isBestStreak(current: number, best: number): boolean {
    return Math.abs(current) > Math.abs(best);
}

/** Durations are server-measured but clamped defensively (4 h ceiling). */
function saneDuration(seconds: number): number {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.round(Math.min(seconds, 4 * 60 * 60));
}

export function applyProgression(
    result: ParticipantResult,
): ParticipantDeltas {
    const streak = nextStreak(result.currentStreak, result.outcome);
    return {
        userId: result.userId,
        gameId: result.gameId,
        outcome: result.outcome,
        xpEarned: matchXp(result.outcome, result.playerCount),
        ratingDelta: ratingDelta(result.outcome, result.playerCount),
        currentStreak: streak,
        isBestStreak: isBestStreak(streak, result.bestStreak),
        durationSeconds: saneDuration(result.durationSeconds),
    };
}

/** New global values for a `profiles` row, given the deltas. Pure. */
export function nextProfileValues(
    profile: {
        level: number;
        xp: number;
        rating: number;
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        currentStreak: number;
        bestStreak: number;
        totalPlaySeconds: number;
    },
    deltas: ParticipantDeltas,
): {
    level: number;
    xp: number;
    rating: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    currentStreak: number;
    bestStreak: number;
    totalPlaySeconds: number;
} {
    const xp = profile.xp + deltas.xpEarned;
    const outcomeCount = (outcome: ParticipantResult["outcome"]) =>
        deltas.outcome === outcome ? 1 : 0;

    return {
        level: Math.floor(xp / XP_PER_LEVEL) + 1,
        xp,
        rating: Math.max(100, profile.rating + deltas.ratingDelta),
        gamesPlayed: profile.gamesPlayed + 1,
        wins: profile.wins + outcomeCount("win"),
        losses: profile.losses + outcomeCount("loss"),
        draws: profile.draws + outcomeCount("draw"),
        currentStreak: deltas.currentStreak,
        bestStreak: deltas.isBestStreak
            ? Math.abs(deltas.currentStreak)
            : profile.bestStreak,
        totalPlaySeconds: profile.totalPlaySeconds + deltas.durationSeconds,
    };
}

/** New values for a `game_stats` row, given the deltas. Pure. */
export function nextGameStatsValues(
    stats: {
        gamesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
        currentStreak: number;
        bestStreak: number;
        totalPlaySeconds: number;
    },
    deltas: ParticipantDeltas,
): {
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    rating: number;
    currentStreak: number;
    bestStreak: number;
    totalPlaySeconds: number;
} {
    const outcomeCount = (outcome: ParticipantResult["outcome"]) =>
        deltas.outcome === outcome ? 1 : 0;

    return {
        gamesPlayed: stats.gamesPlayed + 1,
        wins: stats.wins + outcomeCount("win"),
        losses: stats.losses + outcomeCount("loss"),
        draws: stats.draws + outcomeCount("draw"),
        rating: Math.max(100, stats.rating + deltas.ratingDelta),
        currentStreak: deltas.currentStreak,
        bestStreak: deltas.isBestStreak
            ? Math.abs(deltas.currentStreak)
            : stats.bestStreak,
        totalPlaySeconds: stats.totalPlaySeconds + deltas.durationSeconds,
    };
}

// ---------------------------------------------------------------------------
// Achievements — evaluated ONLY inside the ingestion transaction.
// ---------------------------------------------------------------------------

export interface AchievementContext {
    /** Deltas computed for this match, for this participant. */
    deltas: ParticipantDeltas;
    /** The freshly updated per-game row. */
    gameStats: {
        gamesPlayed: number;
        wins: number;
        currentStreak: number;
    };
}

export type AchievementRule = (context: AchievementContext) => boolean;

/**
 * Rules keyed by achievement code (see achievements.ts for the texts).
 * Each rule reads ONLY values that were just computed from a real
 * match — a profile view can never satisfy one, and nothing unlocks
 * "just because the user opened their profile".
 */
export const ACHIEVEMENT_RULES: Record<string, AchievementRule> = {
    "first-win": (c) => c.deltas.outcome === "win",
    "ten-matches": (c) => c.gameStats.gamesPlayed >= 10,
    "fifty-matches": (c) => c.gameStats.gamesPlayed >= 50,
    "hundred-matches": (c) => c.gameStats.gamesPlayed >= 100,
    "streak-3": (c) => c.gameStats.currentStreak >= 3,
    "streak-10": (c) => c.gameStats.currentStreak >= 10,
    "ludo-25": (c) =>
        c.deltas.gameId === "ludo" && c.gameStats.gamesPlayed >= 25,
    "checkers-25": (c) =>
        c.deltas.gameId === "checkers" && c.gameStats.gamesPlayed >= 25,
};
