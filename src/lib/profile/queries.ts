/**
 * Profile queries — the only database access layer for gamer profiles.
 *
 * Server-only: imported by server components, server actions and the
 * realtime ingestion route. Nothing here is reachable from a client
 * bundle, and every mutation of stats/rating/xp flows through
 * `ingestMatchResult`, which is itself only callable with the shared
 * REALTIME_TOKEN_SECRET (see app/api/profile/match-results).
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import {
    achievements,
    gameMatches,
    gameStats,
    profiles,
    userAchievements,
    DEFAULT_RATING,
    levelForXp,
} from "@/lib/db/schema/profiles";
import { isGameId } from "@/lib/games/registry";
import {
    ACHIEVEMENT_SEEDS,
    type AchievementSeed,
} from "./achievements";
import {
    applyProgression,
    nextGameStatsValues,
    nextProfileValues,
    ACHIEVEMENT_RULES,
    type ParticipantResult,
} from "./progression";

// ---------------------------------------------------------------------------
// Ingestion — the only writer of progression numbers.
// ---------------------------------------------------------------------------

/** Result of a successful ingestion, per participant. */
export interface IngestionOutcome {
    userId: string;
    outcome: "win" | "loss" | "draw";
    xpEarned: number;
    ratingAfter: number;
    levelAfter: number;
    newAchievements: { code: string; name: string }[];
}

export interface MatchIngestion {
    gameId: string;
    roomId: string;
    /** The Colyseus room id — the dedupe key for every replay. */
    playedAt?: Date;
    participants: ParticipantResult[];
}

/**
 * Apply one finished online match to every participant's profile.
 *
 * Idempotent per (roomId, userId): the match rows are inserted with
 * onConflictDoNothing first; a participant whose row already exists is
 * skipped entirely, so a room reported twice — transport retry, server
 * restart, a bug — can never double-count stats.
 *
 * All reads (existing profile/stats rows) happen inside the
 * transaction, so two concurrent finishes of the same room cannot
 * interleave their deltas.
 */
export async function ingestMatchResult(
    ingestion: MatchIngestion,
): Promise<IngestionOutcome[]> {
    if (!isGameId(ingestion.gameId)) {
        throw new Error(`Unknown game id: ${ingestion.gameId}`);
    }
    const playedAt = ingestion.playedAt ?? new Date();
    const winners = ingestion.participants.filter(
        (p) => p.outcome === "win",
    ).length;

    return db.transaction(async (tx) => {
        // 1) Dedupe: claim each participant's match row. Replays die here.
        const inserted = await tx
            .insert(gameMatches)
            .values(
                ingestion.participants.map((participant) => ({
                    id: crypto.randomUUID(),
                    roomId: ingestion.roomId,
                    userId: participant.userId,
                    gameId: ingestion.gameId,
                    outcome: participant.outcome,
                    durationSeconds: Math.max(0, Math.round(participant.durationSeconds || 0)),
                    playerCount: participant.playerCount,
                    opponentIds: ingestion.participants
                        .filter((p) => p.userId !== participant.userId)
                        .map((p) => p.userId),
                    playedAt,
                })),
            )
            .onConflictDoNothing({
                target: [gameMatches.roomId, gameMatches.userId],
            })
            .returning({
                userId: gameMatches.userId,
                seat: gameMatches.seat,
            });

        const claimed = new Set(inserted.map((row) => row.userId));
        const fresh = ingestion.participants.filter((p) => claimed.has(p.userId));
        if (fresh.length === 0) return []; // pure replay — nothing to do

        const userIds = fresh.map((p) => p.userId);

        // 2) Read current state inside the transaction.
        const [existingProfiles, existingStats, alreadyUnlocked] =
            await Promise.all([
                tx.select().from(profiles).where(inArray(profiles.userId, userIds)),
                tx
                    .select()
                    .from(gameStats)
                    .where(
                        and(
                            inArray(gameStats.userId, userIds),
                            eq(gameStats.gameId, ingestion.gameId),
                        ),
                    ),
                tx
                    .select({ userId: userAchievements.userId, code: userAchievements.achievementId })
                    .from(userAchievements)
                    .where(inArray(userAchievements.userId, userIds)),
            ]);

        const profileByUser = new Map(existingProfiles.map((row) => [row.userId, row]));
        const statsByUser = new Map(existingStats.map((row) => [row.userId, row]));

        // Streak state read from the CURRENT per-game row (0 when a
        // player's first match in that game), BEFORE any delta applies.
        const streakByUser = new Map(
            existingStats.map((row) => [
                row.userId,
                {
                    currentStreak: row.currentStreak,
                    bestStreak: row.bestStreak,
                },
            ]),
        );
        const unlockedByUser = new Map<string, Set<string>>();
        for (const row of alreadyUnlocked) {
            const set = unlockedByUser.get(row.userId) ?? new Set<string>();
            set.add(row.code);
            unlockedByUser.set(row.userId, set);
        }

        const outcomes: IngestionOutcome[] = [];
        const unlockedThisMatch: {
            userId: string;
            code: string;
            name: string;
        }[] = [];

        // Guests never hold profiles (and never seat) — skip them early
        // so the per-participant loop only walks real accounts.
        const realPlayers = fresh.filter((p) => !p.userId.startsWith("guest-"));

        for (const participant of realPlayers) {
            const streakState = streakByUser.get(participant.userId) ?? {
                currentStreak: 0,
                bestStreak: 0,
            };
            const deltas = applyProgression({
                userId: participant.userId,
                gameId: participant.gameId,
                outcome: participant.outcome,
                playerCount: participant.playerCount,
                seat: participant.seat,
                durationSeconds: participant.durationSeconds,
                currentStreak: streakState.currentStreak,
                bestStreak: streakState.bestStreak,
            });

            const profile = profileByUser.get(participant.userId);
            if (!profile) continue; // no gamer profile yet — skip silently

            const nextProfile = nextProfileValues(profile, deltas);

            // 3) Per-game row: create at the default rating or update.
            const stats = statsByUser.get(participant.userId);
            const baseStats = stats ?? {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                rating: DEFAULT_RATING,
                currentStreak: 0,
                bestStreak: 0,
                totalPlaySeconds: 0,
            };
            const nextStats = nextGameStatsValues(baseStats, deltas);

            if (stats) {
                await tx
                    .update(gameStats)
                    .set({ ...nextStats, lastPlayedAt: playedAt })
                    .where(
                        and(
                            eq(gameStats.userId, participant.userId),
                            eq(gameStats.gameId, ingestion.gameId),
                        ),
                    );
            } else {
                await tx.insert(gameStats).values({
                    userId: participant.userId,
                    gameId: ingestion.gameId,
                    ...nextStats,
                    lastPlayedAt: playedAt,
                });
            }

            // 4) Profile lifetime block.
            await tx
                .update(profiles)
                .set({
                    level: nextProfile.level,
                    xp: nextProfile.xp,
                    rating: nextProfile.rating,
                    gamesPlayed: nextProfile.gamesPlayed,
                    wins: nextProfile.wins,
                    losses: nextProfile.losses,
                    draws: nextProfile.draws,
                    currentStreak: nextProfile.currentStreak,
                    bestStreak: nextProfile.bestStreak,
                    totalPlaySeconds: nextProfile.totalPlaySeconds,
                    lastPlayedAt: playedAt,
                })
                .where(eq(profiles.userId, participant.userId));

            // 5) Match row: record the rating swing that was applied.
            await tx
                .update(gameMatches)
                .set({
                    seat: participant.seat ?? 0,
                    ratingBefore: (stats?.rating ?? DEFAULT_RATING) - deltas.ratingDelta,
                    ratingAfter: nextStats.rating,
                    xpEarned: deltas.xpEarned,
                })
                .where(
                    and(
                        eq(gameMatches.roomId, ingestion.roomId),
                        eq(gameMatches.userId, participant.userId),
                    ),
                );

            // 6) Achievements — only from freshly computed values.
            const owned = unlockedByUser.get(participant.userId) ?? new Set<string>();
            for (const [code, rule] of Object.entries(ACHIEVEMENT_RULES)) {
                if (owned.has(code)) continue;
                const satisfied = rule({
                    deltas,
                    gameStats: {
                        gamesPlayed: nextStats.gamesPlayed,
                        wins: nextStats.wins,
                        currentStreak: nextStats.currentStreak,
                    },
                });
                if (!satisfied) continue;

                const insertedAchievement = await tx
                    .insert(userAchievements)
                    .values({
                        userId: participant.userId,
                        achievementId: code,
                        metadata: {
                            roomId: ingestion.roomId,
                            gameId: ingestion.gameId,
                            outcome: participant.outcome,
                        },
                    })
                    .onConflictDoNothing()
                    .returning({ code: userAchievements.achievementId });

                if (insertedAchievement.length > 0) {
                    unlockedThisMatch.push({
                        userId: participant.userId,
                        code,
                        name:
                            ACHIEVEMENT_SEEDS.find((seed) => seed.code === code)?.name ??
                            code,
                    });
                }
            }

            outcomes.push({
                userId: participant.userId,
                outcome: participant.outcome,
                xpEarned: deltas.xpEarned,
                ratingAfter: nextStats.rating,
                levelAfter: levelForXp(nextProfile.xp),
                newAchievements: unlockedThisMatch
                    .filter((a) => a.userId === participant.userId)
                    .map(({ code, name }) => ({ code, name })),
            });
        }

        // Informational only — the room is the authority on outcomes.
        if (winners === 0 && realPlayers.length > 1) {
            console.warn(
                `[profile] match ${ingestion.roomId} finished with no winner`,
            );
        }

        return outcomes;
    });
}

/**
 * Make sure every listed user has a gamer profile (batch, for the
 * ingestion path: participants of a finishing match). Creates minimal,
 * honest rows when missing — no fake stats, everything starts at zero.
 */
export async function ensureProfilesForParticipants(
    participants: readonly { userId: string }[],
): Promise<void> {
    const userIds = [...new Set(participants.map((p) => p.userId))];
    if (userIds.length === 0) return;

    const existing = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(inArray(profiles.userId, userIds));
    const missing = userIds.filter(
        (userId) => !existing.some((row) => row.userId === userId),
    );
    if (missing.length === 0) return;

    const users = await db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(inArray(user.id, missing));
    const nameByUser = new Map(users.map((row) => [row.id, row.name]));

    for (const userId of missing) {
        const name = nameByUser.get(userId) ?? "Player";
        const base = sanitizeGamerTag(name) || `player_${userId.slice(0, 6)}`;
        let username = base;
        for (let attempt = 1; attempt <= 5; attempt++) {
            // Bare ON CONFLICT DO NOTHING: ANY unique violation (the
            // userId PK or a claimed username) yields no rows, and the
            // follow-up read tells the two cases apart.
            const inserted = await db
                .insert(profiles)
                .values({ userId, username })
                .onConflictDoNothing()
                .returning();
            if (inserted.length > 0) break;
            const current = await getProfileByUserId(userId);
            if (current) break;
            username = `${base}_${attempt}`;
        }
    }
}

// ---------------------------------------------------------------------------
// Reads — profiles, stats, activity, achievements.
// ---------------------------------------------------------------------------

/** Raw profiles row (own view — includes everything). */
export async function getProfileByUserId(userId: string) {
    const rows = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
    return rows[0] ?? null;
}

export async function getProfileByUsername(username: string) {
    const rows = await db
        .select()
        .from(profiles)
        .where(sql`lower(${profiles.username}) = lower(${username})`)
        .limit(1);
    return rows[0] ?? null;
}

/** True when the gamerTag is free (case-insensitive), excluding a user. */
export async function isGamerTagAvailable(username: string, excludeUserId?: string) {
    const rows = await db
        .select({ userId: profiles.userId })
        .from(profiles)
        .where(sql`lower(${profiles.username}) = lower(${username})`)
        .limit(1);
    if (rows.length === 0) return true;
    return excludeUserId !== undefined && rows[0].userId === excludeUserId;
}

/**
 * Gameplay identity snapshot for the realtime token route (gamerTag +
 * avatar, keyed by the stable userId). Lives in this server-only
 * module — NOT in actions.ts, where every export becomes a client-
 * callable server action (this read takes an arbitrary userId).
 */
export async function getRealtimeIdentityForUser(userId: string) {
    const [profile] = await db
        .select({
            username: profiles.username,
            avatarUrl: profiles.avatarUrl,
        })
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
    return profile ?? null;
}

/** Per-game rows of a profile, joined with the registry metadata. */
export async function getGameStatsForUser(userId: string) {
    return db
        .select()
        .from(gameStats)
        .where(eq(gameStats.userId, userId))
        .orderBy(desc(gameStats.gamesPlayed));
}

/** Recent matches with opponent gamer tags resolved (for “contre @alex”). */
export async function getRecentMatchesForUser(userId: string, limit = 8) {
    const rows = await db
        .select()
        .from(gameMatches)
        .where(eq(gameMatches.userId, userId))
        .orderBy(desc(gameMatches.playedAt))
        .limit(limit);

    const opponentIds = [
        ...new Set(rows.flatMap((row) => (Array.isArray(row.opponentIds) ? row.opponentIds : []))),
    ];
    const opponents = opponentIds.length
        ? await db
              .select({ userId: profiles.userId, username: profiles.username })
              .from(profiles)
              .where(inArray(profiles.userId, opponentIds))
        : [];
    const nameByUser = new Map(opponents.map((row) => [row.userId, row.username]));

    return rows.map((row) => ({
        ...row,
        opponentTags: (Array.isArray(row.opponentIds) ? row.opponentIds : [])
            .map((id) => nameByUser.get(id))
            .filter((tag): tag is string => Boolean(tag)),
    }));
}

/** Full achievement grid for a profile (catalogue + unlock state). */
export async function getAchievementGridForUser(userId: string) {
    const catalogue = await db
        .select()
        .from(achievements)
        .orderBy(achievements.sortOrder);
    const unlocked = await db
        .select()
        .from(userAchievements)
        .where(eq(userAchievements.userId, userId));
    const unlockedByCode = new Map(
        unlocked.map((row) => [row.achievementId, row.unlockedAt]),
    );

    return catalogue.map((achievement) => ({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        gameId: achievement.gameId,
        unlockedAt: unlockedByCode.get(achievement.code) ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Catalogue seeding + safe defaults for existing users.
// ---------------------------------------------------------------------------

/**
 * Upsert the static achievement catalogue. Cheap (a handful of rows,
 * no-op when nothing changed); called from the ingestion route and the
 * profile page so a fresh deployment converges without a manual step.
 */
export async function ensureAchievementCatalogue(seeds: readonly AchievementSeed[] = ACHIEVEMENT_SEEDS) {
    if (seeds.length === 0) return;
    await db
        .insert(achievements)
        .values([...seeds])
        .onConflictDoUpdate({
            target: achievements.code,
            set: {
                name: sql`excluded.name`,
                description: sql`excluded.description`,
                icon: sql`excluded.icon`,
                gameId: sql`excluded.game_id`,
                sortOrder: sql`excluded.sort_order`,
            },
        });
}

/**
 * Make sure a user has a gamer profile. Creates a minimal, honest one
 * when missing (no fake stats — everything starts at zero). Used by the
 * profile page and the ingestion path so an old account gets its
 * profile on first contact, not by a batch migration.
 */
export async function ensureProfileForUser(userId: string, fallbackName: string) {
    const existing = await getProfileByUserId(userId);
    if (existing) return existing;

    const base = sanitizeGamerTag(fallbackName) || `player_${userId.slice(0, 6)}`;
    let username = base;
    for (let attempt = 1; attempt <= 5; attempt++) {
        const inserted = await db
            .insert(profiles)
            .values({ userId, username })
            .onConflictDoNothing({ target: profiles.userId })
            .returning();
        if (inserted.length > 0) return inserted[0];
        // userId PK conflict → profile exists; username conflict → vary.
        const current = await getProfileByUserId(userId);
        if (current) return current;
        username = `${base}_${attempt}`;
    }
    throw new Error("Unable to create a gamer profile for this user");
}

/** Turn any name into a legal gamerTag stem (3-24, [a-zA-Z0-9_]). */
export function sanitizeGamerTag(name: string): string {
    const cleaned = name
        .normalize("NFKD")
        .replace(/[^\w]/g, "")
        .slice(0, 24);
    if (cleaned.length >= 3) return cleaned;
    return cleaned.padEnd(3, "_");
}

/**
 * Wait for tests/ops: wipe every gamer table for a user (never auth).
 * Not used by the product surface.
 */
export async function deleteProfileDataForUser(userId: string) {
    await db.delete(userAchievements).where(eq(userAchievements.userId, userId));
    await db.delete(gameMatches).where(eq(gameMatches.userId, userId));
    await db.delete(gameStats).where(eq(gameStats.userId, userId));
    await db.delete(profiles).where(eq(profiles.userId, userId));
}
