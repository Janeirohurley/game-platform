/**
 * Public read-model for the gamer profile.
 *
 * Shapes what a profile page may show. It is the single boundary
 * between the DB rows and the UI: nothing else decides what is public,
 * so nothing private (email, sessions, ids beyond the tag, private
 * dates) can leak through a new call site by accident.
 */

import {
    getProfileByUserId,
    getGameStatsForUser,
    getAchievementGridForUser,
    getRecentMatchesForUser,
} from "./queries";
import { listGames } from "@/lib/games/registry";
import { XP_PER_LEVEL } from "@/lib/db/schema/profiles";

export interface PublicGameStatsView {
    gameId: string;
    title: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number; // 0-100, rounded to 0.1
    rating: number;
    bestStreak: number;
    lastPlayedAt: Date | null;
}

export interface PublicAchievementView {
    code: string;
    name: string;
    description: string;
    icon: string;
    gameId: string | null;
    unlockedAt: Date | null;
}

export interface PublicActivityView {
    id: string;
    gameId: string;
    outcome: "win" | "loss" | "draw";
    playerCount: number;
    durationSeconds: number;
    opponentTags: string[];
    playedAt: Date;
    ratingDelta: number;
}

export interface PublicPresenceView {
    state: "online" | "in-match" | "spectating" | "offline";
    gameId?: string;
}

export interface PublicGamerProfileView {
    gamerTag: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    country: string | null;
    languages: string[];
    gamerSince: Date;
    level: number;
    xp: number;
    /** XP still needed for the next level. */
    xpToNextLevel: number;
    rating: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    totalPlaySeconds: number;
    lastPlayedAt: Date | null;
    games: PublicGameStatsView[];
    achievements: PublicAchievementView[];
    activity: PublicActivityView[];
    favoriteGameIds: string[];
    isPublic: boolean;
    isOwner: boolean;
    presence?: PublicPresenceView;
}

/** Percentage helper — 0 games ⇒ 0 %, never NaN. */
function winRate(wins: number, gamesPlayed: number): number {
    if (gamesPlayed <= 0) return 0;
    return Math.round((wins / gamesPlayed) * 1000) / 10;
}

export async function readPublicGamerProfile(
    userId: string,
    options: { viewerUserId: string | null; isOwner: boolean },
): Promise<PublicGamerProfileView> {
    const [profile, stats, achievementGrid, recentMatches] = await Promise.all([
        getProfileByUserId(userId),
        getGameStatsForUser(userId),
        getAchievementGridForUser(userId),
        getRecentMatchesForUser(userId, 8),
    ]);

    if (!profile) {
        throw new Error("readPublicGamerProfile requires an existing profile");
    }

    const registry = listGames();
    const titleByGame = new Map(registry.map((game) => [game.id, game.title]));

    const games: PublicGameStatsView[] = stats.map((row) => ({
        gameId: row.gameId,
        title: titleByGame.get(row.gameId) ?? row.gameId,
        gamesPlayed: row.gamesPlayed,
        wins: row.wins,
        losses: row.losses,
        draws: row.draws,
        winRate: winRate(row.wins, row.gamesPlayed),
        rating: row.rating,
        bestStreak: row.bestStreak,
        lastPlayedAt: row.lastPlayedAt,
    }));

    const activity: PublicActivityView[] = recentMatches.map((row) => ({
        id: row.id,
        gameId: row.gameId,
        outcome:
            row.outcome === "win" || row.outcome === "loss" ? row.outcome : "draw",
        playerCount: row.playerCount,
        durationSeconds: row.durationSeconds,
        opponentTags: row.opponentTags,
        playedAt: row.playedAt,
        ratingDelta: row.ratingAfter - row.ratingBefore,
    }));

    return {
        gamerTag: profile.username,
        displayName: profile.displayName || profile.username,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        coverUrl: profile.coverUrl,
        country: profile.countryCode,
        languages: Array.isArray(profile.languages) ? profile.languages : [],
        gamerSince: profile.createdAt,
        level: profile.level,
        xp: profile.xp,
        xpToNextLevel: XP_PER_LEVEL - (profile.xp % XP_PER_LEVEL),
        rating: profile.rating,
        gamesPlayed: profile.gamesPlayed,
        wins: profile.wins,
        losses: profile.losses,
        draws: profile.draws,
        winRate: winRate(profile.wins, profile.gamesPlayed),
        currentStreak: profile.currentStreak,
        bestStreak: profile.bestStreak,
        totalPlaySeconds: profile.totalPlaySeconds,
        lastPlayedAt: profile.lastPlayedAt,
        games,
        achievements: achievementGrid,
        activity,
        favoriteGameIds: Array.isArray(profile.favoriteGames)
            ? profile.favoriteGames
            : [],
        isPublic: profile.isPublic,
        isOwner: options.isOwner,
        presence: await resolvePresence(userId),
    };
}

/**
 * Presence is NEVER stored on the profile: it is derived from the
 * realtime server's live room metadata. When the game server is
 * unreachable, the profile simply shows no status rather than a stale
 * "online". A user in no room at all reads as "offline" — the absence
 * of data, not stored data.
 */
async function resolvePresence(
    userId: string,
): Promise<PublicPresenceView | undefined> {
    try {
        const { fetchRealtimePresence } = await import(
            "@/lib/realtime/presence"
        );
        const users = await fetchRealtimePresence([userId]);
        const presence = users[userId];
        if (!presence) {
            return { state: "offline" };
        }
        return presence.state === "in-match"
            ? { state: "in-match", gameId: presence.gameId }
            : { state: "spectating", gameId: presence.gameId };
    } catch {
        return undefined; // realtime unavailable — show nothing
    }
}
