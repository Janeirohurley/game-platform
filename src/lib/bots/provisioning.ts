/**
 * Bot provisioning — the ONE writer of the `bot` pool.
 *
 * The Colyseus server never inserts into `user`/`profiles`/`bot`: it calls
 * the signed internal endpoint (app/api/internal/bots), which lands here.
 * Single writer keeps the lease columns honest when several game servers
 * run at once; the claim itself is race-safe via
 * `FOR UPDATE SKIP LOCKED`.
 *
 * A bot account is intentionally inert:
 *   - `user.is_bot = true`, no `account` row, no credential → nothing to
 *     sign in with (the auth guard in lib/auth.ts is defense in depth);
 *   - a reserved `.invalid` e-mail → no mailbox, never deliverable;
 *   - a real `profiles` row → it can be seated, tagged and reported like
 *     any player, which is exactly what makes the online path uniform.
 *
 * Provisioning is idempotent per call in the sense that it only ADDS
 * missing capacity; it never reuses a leased bot. `claimBots` tops the
 * pool up first, so a room always gets its count in a single round trip.
 */

import { and, count, eq, inArray, lt, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import {
    bots,
    BOT_ORIGIN_ADMIN,
    BOT_ORIGIN_GENERATED,
    isBotDifficulty,
    isBotMode,
    normalizeBotConfig,
    type BotConfig,
    type BotDifficulty,
    type BotMode,
    type BotStatus,
} from "@/lib/db/schema/bots";
import { isGameId, type GameId } from "@/lib/games/registry";
import {
    botEmail,
    generateBotIdentity,
    randomBotSeed,
} from "./names";

/** A pool entry as the game server needs it: enough to seat and label. */
export interface BotRecord {
    botId: string;
    userId: string;
    gameId: GameId;
    displayName: string;
    gamerTag: string;
    difficulty: BotDifficulty;
    /** Strategy knobs, fully defaulted — the seat drives with these. */
    config: BotConfig;
    status: BotStatus;
}

/** Bounds that keep a bad caller from provisioning an unbounded flood. */
const MAX_PROVISION_PER_CALL = 32;
const MAX_CLAIM_PER_CALL = 8;
const MAX_TAG_ATTEMPTS = 6;

function assertCount(value: number, max: number, label: string): number {
    if (!Number.isInteger(value) || value < 0 || value > max) {
        throw new Error(`${label} must be an integer in 0..${max}`);
    }
    return value;
}

/**
 * Create `count` fresh bot accounts for a game. Each bot is one
 * transaction: user, profile and pool row land together or not at all.
 * A username collision (two bots drawing the same tag) is retried with a
 * suffix; the userId is a fresh uuid so only the username can clash.
 */
export async function provisionBots(options: {
    count: number;
    gameId: string;
    origin?: string;
}): Promise<BotRecord[]> {
    const { gameId } = options;
    if (!isGameId(gameId)) throw new Error(`Unknown game id: ${gameId}`);
    const target = assertCount(options.count, MAX_PROVISION_PER_CALL, "count");
    const origin = options.origin ?? BOT_ORIGIN_GENERATED;

    const created: BotRecord[] = [];
    for (let i = 0; i < target; i++) {
        created.push(await createBotAccount(gameId, origin));
    }
    return created;
}

/** Auto-provisioned pool bot: a fresh identity, then a normal mint. */
async function createBotAccount(
    gameId: GameId,
    origin: string,
): Promise<BotRecord> {
    const identity = generateBotIdentity(randomBotSeed());
    return createPoolBot({
        gameId,
        origin,
        difficulty: identity.difficulty,
        displayName: identity.displayName,
        gamerTag: identity.gamerTag,
    });
}

export interface CreatePoolBotOptions {
    gameId: GameId;
    origin: string;
    difficulty: BotDifficulty;
    displayName: string;
    gamerTag: string;
    label?: string | null;
    config?: BotConfig | null;
    createdByAdminId?: string | null;
}

/**
 * Mint a POOL brain: an inert account (`user.is_bot = true`, no
 * credential) plus its public profile and its `bot` row, all in one
 * transaction. `mode` is always 'pool'. A username collision is retried
 * with a suffix; the userId is a fresh uuid so only the tag can clash.
 */
export async function createPoolBot(
    options: CreatePoolBotOptions,
): Promise<BotRecord> {
    const { gameId, origin, difficulty, displayName } = options;
    const userId = `bot_${crypto.randomUUID()}`;
    const botId = `bot_${crypto.randomUUID()}`;
    const base = options.gamerTag.slice(0, 24);

    return db.transaction(async (tx) => {
        await tx.insert(user).values({
            id: userId,
            name: displayName,
            email: botEmail(userId),
            // No mailbox exists; marking it verified keeps the account
            // out of "unverified/resend" admin surfaces. It cannot be
            // used to sign in regardless.
            emailVerified: true,
            role: "user",
            isBot: true,
        });

        let gamerTag = base;
        for (let attempt = 1; attempt <= MAX_TAG_ATTEMPTS; attempt++) {
            const candidate =
                attempt === 1 ? base : `${base.slice(0, 22)}_${attempt}`;
            const inserted = await tx
                .insert(profiles)
                .values({
                    userId,
                    username: candidate,
                    displayName,
                })
                .onConflictDoNothing({ target: profiles.username })
                .returning({ username: profiles.username });
            if (inserted.length > 0) {
                gamerTag = inserted[0].username;
                break;
            }
            if (attempt === MAX_TAG_ATTEMPTS) {
                throw new Error("Unable to allocate a unique bot gamer tag");
            }
        }

        await tx.insert(bots).values({
            id: botId,
            userId,
            mode: "pool",
            gameId,
            label: options.label ?? null,
            difficulty,
            config: options.config ?? null,
            status: "idle",
            origin,
            createdByAdminId: options.createdByAdminId ?? null,
        });

        return {
            botId,
            userId,
            gameId,
            displayName,
            gamerTag,
            difficulty,
            config: normalizeBotConfig(options.config),
            status: "idle" as const,
        };
    });
}

/**
 * Reserve up to `count` bots for a room, least-recently-used first.
 *
 * `topUp` (default true) provisions the shortfall first, so a caller asks
 * once and gets a full table when the DB is reachable. The claim itself
 * runs in a transaction: select idle rows `FOR UPDATE SKIP LOCKED` (a
 * concurrent claim skips what this one holds instead of blocking), flip
 * them to `in_match`, then read the profiles for labels. Returns fewer
 * than requested only under genuine pool exhaustion + race.
 */
export async function claimBots(options: {
    count: number;
    gameId: string;
    roomId: string;
    topUp?: boolean;
}): Promise<BotRecord[]> {
    const { gameId, roomId } = options;
    if (!isGameId(gameId)) throw new Error(`Unknown game id: ${gameId}`);
    if (!roomId) throw new Error("roomId is required");
    const target = assertCount(options.count, MAX_CLAIM_PER_CALL, "count");
    if (target === 0) return [];

    let available = await countAvailableBots(gameId);
    if (available < target) {
        // The pool is short: reclaim leases a crashed game server left in
        // `in_match` (best-effort — a sweep failure must never block the
        // claim), then top up so this claim can satisfy the request.
        try {
            const reclaimed = await releaseStaleBotLeases();
            if (reclaimed > 0) {
                console.info(`[bots] sweep reclaimed ${reclaimed} stale lease(s)`);
            }
        } catch (error) {
            console.error("[bots] stale-lease sweep failed:", error);
        }
        if (options.topUp !== false) {
            available = await countAvailableBots(gameId);
            if (available < target) {
                await provisionBots({ count: target - available, gameId });
            }
        }
    }

    const now = new Date();
    const rows = await db.transaction(async (tx) => {
        const picked = await tx
            .select({
                botId: bots.id,
                userId: bots.userId,
                difficulty: bots.difficulty,
                config: bots.config,
            })
            .from(bots)
            .where(
                and(
                    eq(bots.gameId, gameId),
                    eq(bots.status, "idle"),
                    eq(bots.mode, "pool"),
                ),
            )
            .orderBy(sql`${bots.lastUsedAt} asc nulls first`, bots.createdAt)
            .limit(target)
            .for("update", { skipLocked: true });

        if (picked.length === 0) return [];

        await tx
            .update(bots)
            .set({ status: "in_match", leaseRoomId: roomId, leasedAt: now })
            .where(
                inArray(
                    bots.id,
                    picked.map((row) => row.botId),
                ),
            );

        const profileRows = await tx
            .select({
                userId: profiles.userId,
                username: profiles.username,
                displayName: profiles.displayName,
            })
            .from(profiles)
            .where(
                inArray(
                    profiles.userId,
                    picked.map((row) => row.userId),
                ),
            );
        const profileByUser = new Map(
            profileRows.map((row) => [row.userId, row]),
        );

        return picked.map((row): BotRecord => {
            const profile = profileByUser.get(row.userId);
            return {
                botId: row.botId,
                userId: row.userId,
                gameId,
                displayName:
                    profile?.displayName ?? profile?.username ?? "Bot",
                gamerTag: profile?.username ?? "bot",
                difficulty: row.difficulty as BotDifficulty,
                config: normalizeBotConfig(row.config),
                status: "in_match" as const,
            };
        });
    });

    return rows;
}

/** Return every bot leased by a room to the idle pool. Idempotent. */
export async function releaseBots(options: { roomId: string }): Promise<number> {
    const { roomId } = options;
    if (!roomId) throw new Error("roomId is required");

    const released = await db
        .update(bots)
        .set({
            status: "idle",
            leaseRoomId: null,
            leasedAt: null,
            lastUsedAt: new Date(),
        })
        .where(eq(bots.leaseRoomId, roomId))
        .returning({ id: bots.id });

    return released.length;
}

/**
 * Heal leaks: a game server that crashed mid-match never called
 * `releaseBots`. Any lease older than `maxAgeMs` is reclaimed. Default
 * 6h — comfortably longer than the longest Ludo match, short enough that
 * a crashed room's bots return to the pool the same day.
 */
export async function releaseStaleBotLeases(options?: {
    maxAgeMs?: number;
}): Promise<number> {
    const maxAgeMs = options?.maxAgeMs ?? 6 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - maxAgeMs);

    const reclaimed = await db
        .update(bots)
        .set({
            status: "idle",
            leaseRoomId: null,
            leasedAt: null,
            lastUsedAt: new Date(),
        })
        .where(and(eq(bots.status, "in_match"), lt(bots.leasedAt, cutoff)))
        .returning({ id: bots.id });

    return reclaimed.length;
}

/** Idle bots available for a game — used by claim top-up and admin views. */
export async function countAvailableBots(gameId: string): Promise<number> {
    if (!isGameId(gameId)) throw new Error(`Unknown game id: ${gameId}`);
    const [row] = await db
        .select({ value: count() })
        .from(bots)
        .where(
            and(
                eq(bots.gameId, gameId),
                eq(bots.status, "idle"),
                eq(bots.mode, "pool"),
            ),
        );
    return Number(row?.value ?? 0);
}

/** What the game server needs to drive a seat with an attached brain. */
export interface ResolvedBrain {
    botId: string;
    difficulty: BotDifficulty;
    config: BotConfig;
}

/**
 * Resolve the attached brain driving `userId`, if any. Pool brains are
 * NOT returned: those are seated through `claimBots` against a fresh
 * identity, never by a human joining. Only an `attached` brain — a brain
 * bound to a real account — makes an ordinary join play itself. The brain
 * must be for the same game, and a disabled brain resolves to null (an
 * operator turned it off).
 */
export async function resolveAttachedBrain(options: {
    userId: string;
    gameId: string;
}): Promise<ResolvedBrain | null> {
    if (!isGameId(options.gameId)) return null;
    const [row] = await db
        .select({
            botId: bots.id,
            difficulty: bots.difficulty,
            config: bots.config,
        })
        .from(bots)
        .where(
            and(
                eq(bots.userId, options.userId),
                eq(bots.mode, "attached"),
                eq(bots.gameId, options.gameId),
                ne(bots.status, "disabled"),
            ),
        )
        .limit(1);
    if (!row) return null;
    return {
        botId: row.botId,
        difficulty: row.difficulty as BotDifficulty,
        config: normalizeBotConfig(row.config),
    };
}

// ---------------------------------------------------------------------------
// Admin control plane (console): author brains, retune them, bind them to a
// real account, retire them. These are the ONLY writers besides provisioning;
// every mutation refuses to touch a bot leased into a live match.
// ---------------------------------------------------------------------------

export type BotAdminErrorCode =
    | "account-not-found"
    | "account-already-bound"
    | "bot-not-found"
    | "bot-busy";

/** Typed, code-mapped failure so the console can phrase it in French. */
export class BotAdminError extends Error {
    constructor(
        readonly code: BotAdminErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "BotAdminError";
    }
}

export interface CreateManagedBotInput {
    gameId: GameId;
    mode: BotMode;
    difficulty: BotDifficulty;
    /** Console label; falls back to the public identity when null. */
    label?: string | null;
    /** Strategy knobs; validated + defaulted, `null` means "defaults". */
    config?: BotConfig | null;
    /** pool only — optional identity overrides (else generated). */
    displayName?: string;
    gamerTag?: string;
    /** attached only: the account the brain will drive. */
    targetUserId?: string;
    /** The admin performing the creation (traceability). */
    createdByAdminId: string;
}

/**
 * Create a brain from the console. `pool` mints a standalone inert
 * account; `attached` binds the brain to an existing account so it plays
 * in that account's place. Returns the seated shape for immediate use.
 */
export async function createManagedBot(
    input: CreateManagedBotInput,
): Promise<BotRecord> {
    if (!isGameId(input.gameId)) {
        throw new Error(`Unknown game id: ${input.gameId}`);
    }
    if (!isBotDifficulty(input.difficulty)) {
        throw new Error(`Unknown difficulty: ${input.difficulty}`);
    }
    if (!isBotMode(input.mode)) {
        throw new Error(`Unknown mode: ${input.mode}`);
    }

    const config = input.config ? normalizeBotConfig(input.config) : null;

    if (input.mode === "attached") {
        if (!input.targetUserId) {
            throw new Error("targetUserId is required for an attached bot");
        }
        return attachBotToAccount({
            gameId: input.gameId,
            targetUserId: input.targetUserId,
            label: input.label ?? null,
            difficulty: input.difficulty,
            config,
            createdByAdminId: input.createdByAdminId,
        });
    }

    const identity = generateBotIdentity(randomBotSeed());
    return createPoolBot({
        gameId: input.gameId,
        origin: BOT_ORIGIN_ADMIN,
        difficulty: input.difficulty,
        displayName: input.displayName?.trim() || identity.displayName,
        gamerTag: input.gamerTag?.trim() || identity.gamerTag,
        label: input.label ?? null,
        config,
        createdByAdminId: input.createdByAdminId,
    });
}

async function attachBotToAccount(options: {
    gameId: GameId;
    targetUserId: string;
    label: string | null;
    difficulty: BotDifficulty;
    config: BotConfig | null;
    createdByAdminId: string;
}): Promise<BotRecord> {
    const { gameId, targetUserId } = options;

    return db.transaction(async (tx) => {
        const [target] = await tx
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(eq(user.id, targetUserId))
            .limit(1);
        if (!target) {
            throw new BotAdminError(
                "account-not-found",
                "the target account does not exist",
            );
        }

        const [bound] = await tx
            .select({ id: bots.id })
            .from(bots)
            .where(eq(bots.userId, targetUserId))
            .limit(1);
        if (bound) {
            throw new BotAdminError(
                "account-already-bound",
                "this account already drives a brain",
            );
        }

        const [profile] = await tx
            .select({
                username: profiles.username,
                displayName: profiles.displayName,
            })
            .from(profiles)
            .where(eq(profiles.userId, targetUserId))
            .limit(1);

        const botId = `bot_${crypto.randomUUID()}`;
        await tx.insert(bots).values({
            id: botId,
            userId: targetUserId,
            mode: "attached",
            gameId,
            label: options.label,
            difficulty: options.difficulty,
            config: options.config,
            status: "idle",
            origin: BOT_ORIGIN_ADMIN,
            createdByAdminId: options.createdByAdminId,
        });

        return {
            botId,
            userId: targetUserId,
            gameId,
            displayName: profile?.displayName ?? target.name ?? "Account",
            gamerTag: profile?.username ?? "account",
            difficulty: options.difficulty,
            config: normalizeBotConfig(options.config),
            status: "idle" as const,
        };
    });
}

export interface UpdateManagedBotInput {
    label?: string | null;
    difficulty?: BotDifficulty;
    config?: BotConfig | null;
    /** Enable (`true`) or disable (`false`) without deleting the brain. */
    enabled?: boolean;
}

/** Retune a brain's label / reasoning / strategy / enabled state. */
export async function updateManagedBot(
    botId: string,
    patch: UpdateManagedBotInput,
): Promise<void> {
    const [row] = await db
        .select({ id: bots.id, status: bots.status })
        .from(bots)
        .where(eq(bots.id, botId))
        .limit(1);
    if (!row) {
        throw new BotAdminError("bot-not-found", "the bot does not exist");
    }
    if (row.status === "in_match") {
        throw new BotAdminError("bot-busy", "the bot is in a match");
    }
    if (patch.difficulty !== undefined && !isBotDifficulty(patch.difficulty)) {
        throw new Error(`Unknown difficulty: ${patch.difficulty}`);
    }

    const set: Partial<typeof bots.$inferInsert> = {};
    if (patch.label !== undefined) set.label = patch.label?.trim() || null;
    if (patch.difficulty !== undefined) set.difficulty = patch.difficulty;
    if (patch.config !== undefined) {
        set.config = patch.config ? normalizeBotConfig(patch.config) : null;
    }
    if (patch.enabled !== undefined) {
        set.status = patch.enabled ? "idle" : "disabled";
    }
    if (Object.keys(set).length === 0) return;

    await db.update(bots).set(set).where(eq(bots.id, botId));
}

/**
 * Delete a brain. A pool brain takes its minted account with it (cascade);
 * an attached brain is removed alone — the real account it drove is never
 * touched, which doubles as "detach".
 */
export async function deleteManagedBot(botId: string): Promise<void> {
    const [row] = await db
        .select({
            id: bots.id,
            userId: bots.userId,
            mode: bots.mode,
            status: bots.status,
        })
        .from(bots)
        .where(eq(bots.id, botId))
        .limit(1);
    if (!row) {
        throw new BotAdminError("bot-not-found", "the bot does not exist");
    }
    if (row.status === "in_match") {
        throw new BotAdminError("bot-busy", "the bot is in a match");
    }

    if (row.mode === "pool") {
        await db.delete(user).where(eq(user.id, row.userId));
    } else {
        await db.delete(bots).where(eq(bots.id, botId));
    }
}

/**
 * Move an existing brain onto another account. A pool brain leaves its
 * minted account behind (deleted); an attached brain simply rebinds and
 * the account it used to drive is left untouched.
 */
export async function bindExistingBot(
    botId: string,
    targetUserId: string,
): Promise<void> {
    const [row] = await db
        .select({
            id: bots.id,
            userId: bots.userId,
            mode: bots.mode,
            status: bots.status,
        })
        .from(bots)
        .where(eq(bots.id, botId))
        .limit(1);
    if (!row) {
        throw new BotAdminError("bot-not-found", "the bot does not exist");
    }
    if (row.status === "in_match") {
        throw new BotAdminError("bot-busy", "the bot is in a match");
    }
    if (row.userId === targetUserId) return;

    await db.transaction(async (tx) => {
        const [target] = await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, targetUserId))
            .limit(1);
        if (!target) {
            throw new BotAdminError(
                "account-not-found",
                "the target account does not exist",
            );
        }

        const [bound] = await tx
            .select({ id: bots.id })
            .from(bots)
            .where(eq(bots.userId, targetUserId))
            .limit(1);
        if (bound) {
            throw new BotAdminError(
                "account-already-bound",
                "this account already drives a brain",
            );
        }

        // Repoint the brain BEFORE dropping the old minted account: the
        // FK would otherwise be dangling and the minted user's delete
        // would cascade the very bot row we are moving.
        await tx
            .update(bots)
            .set({ userId: targetUserId, mode: "attached", origin: BOT_ORIGIN_ADMIN })
            .where(eq(bots.id, botId));

        if (row.mode === "pool") {
            await tx.delete(user).where(eq(user.id, row.userId));
        }
    });
}
