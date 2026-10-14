import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isGameId } from "@/lib/games/registry";
import {
    claimBots,
    countAvailableBots,
    provisionBots,
    releaseBots,
    releaseStaleBotLeases,
    resolveAttachedBrain,
} from "@/lib/bots/provisioning";

/**
 * Internal bot pool endpoint — server-to-server only.
 *
 * The Colyseus server (server-games) calls this to provision, claim and
 * release the bots it seats in a room. It never touches the bot tables
 * directly, so there is exactly ONE writer of the pool and the lease
 * state can never be torn between two databases-of-record.
 *
 * Trust model mirrors app/api/profile/match-results: a per-request HMAC
 * of the RAW body, keyed by the shared REALTIME_TOKEN_SECRET (the same
 * secret that signs realtime join tokens and match reports — one shared
 * secret, several server-side uses). No client ever reaches this route:
 * a valid signature requires the secret.
 *
 * Payloads are small and enum-dispatched, so the whole surface is one
 * `z.discriminatedUnion`.
 */

const actionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("provision"),
        gameId: z.string().refine(isGameId, "Unknown game id"),
        count: z.number().int().min(0).max(32),
        origin: z.string().min(1).max(32).optional(),
    }),
    z.object({
        action: z.literal("claim"),
        gameId: z.string().refine(isGameId, "Unknown game id"),
        count: z.number().int().min(0).max(8),
        roomId: z.string().min(1).max(64),
        topUp: z.boolean().optional(),
    }),
    z.object({
        action: z.literal("release"),
        roomId: z.string().min(1).max(64),
    }),
    z.object({
        action: z.literal("release-stale"),
        maxAgeMs: z.number().int().min(60_000).max(7 * 24 * 60 * 60 * 1000).optional(),
    }),
    z.object({
        action: z.literal("stats"),
        gameId: z.string().refine(isGameId, "Unknown game id"),
    }),
    z.object({
        action: z.literal("resolve"),
        gameId: z.string().refine(isGameId, "Unknown game id"),
        userId: z.string().min(1).max(64),
    }),
]);

/** Constant-time compare of the request signature against the body. */
function verifySignature(rawBody: string, signature: string | null): boolean {
    const secret = process.env.REALTIME_TOKEN_SECRET;
    if (!secret || secret.length < 16) return false;
    if (!signature?.startsWith("sha256=")) return false;

    const expected = createHmac("sha256", secret)
        .update(rawBody, "utf8")
        .digest("hex");
    const received = signature.slice("sha256=".length);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    // timingSafeEqual requires equal lengths; a mismatch is simply invalid.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get("x-realtime-signature");

    if (!verifySignature(rawBody, signature)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let parsed: z.infer<typeof actionSchema>;
    try {
        parsed = actionSchema.parse(JSON.parse(rawBody));
    } catch (error) {
        return NextResponse.json(
            { error: "Invalid payload", details: String(error) },
            { status: 400 },
        );
    }

    try {
        switch (parsed.action) {
            case "provision": {
                const bots = await provisionBots({
                    count: parsed.count,
                    gameId: parsed.gameId,
                    origin: parsed.origin,
                });
                return NextResponse.json({ bots });
            }
            case "claim": {
                const bots = await claimBots({
                    count: parsed.count,
                    gameId: parsed.gameId,
                    roomId: parsed.roomId,
                    topUp: parsed.topUp,
                });
                return NextResponse.json({ bots });
            }
            case "release": {
                const released = await releaseBots({ roomId: parsed.roomId });
                return NextResponse.json({ released });
            }
            case "release-stale": {
                const released = await releaseStaleBotLeases({
                    maxAgeMs: parsed.maxAgeMs,
                });
                return NextResponse.json({ released });
            }
            case "stats": {
                const available = await countAvailableBots(parsed.gameId);
                return NextResponse.json({ available });
            }
            case "resolve": {
                const brain = await resolveAttachedBrain({
                    userId: parsed.userId,
                    gameId: parsed.gameId,
                });
                return NextResponse.json({ brain });
            }
        }
    } catch (error) {
        return NextResponse.json(
            { error: "Bot operation failed", details: String(error) },
            { status: 502 },
        );
    }
}
