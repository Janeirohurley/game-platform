import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isGameId } from "@/lib/games/registry";
import {
    ensureProfilesForParticipants,
    ensureAchievementCatalogue,
    ingestMatchResult,
} from "@/lib/profile/queries";

/**
 * Realtime match-result ingestion.
 *
 * The Colyseus server (server-games) calls this after `finishMatch()`
 * with the result of every seated player. It is the ONLY writer of
 * profile stats, ratings and XP:
 *
 *   - authenticated by a per-request HMAC of the raw body, keyed by the
 *     shared REALTIME_TOKEN_SECRET (the same secret that signs realtime
 *     join tokens — one shared secret, two uses, both server-side);
 *   - replay-proof: dedupe happens on (roomId, userId) inside the
 *     ingestion transaction;
 *   - unauthenticated clients never reach the mutation.
 *
 * Server-to-server, so the body is raw JSON — the HMAC is computed on
 * the exact bytes to avoid any canonicalisation mismatch.
 */

const participantSchema = z.object({
    userId: z.string().min(1).max(64),
    outcome: z.enum(["win", "loss", "draw"]),
    seat: z.number().int().min(0).max(255).optional(),
    durationSeconds: z.number().min(0).max(4 * 60 * 60).optional(),
});

const ingestionSchema = z.object({
    gameId: z.string().refine(isGameId, "Unknown game id"),
    roomId: z.string().min(1).max(64),
    participants: z.array(participantSchema).min(1).max(8),
});

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
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
    const rawBody = await request.text();

    if (
        !verifySignature(
            rawBody,
            request.headers.get("x-realtime-signature"),
        )
    ) {
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401 },
        );
    }

    let parsedJson: unknown;
    try {
        parsedJson = JSON.parse(rawBody);
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const parsed = ingestionSchema.safeParse(parsedJson);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 },
        );
    }

    const { gameId, roomId, participants } = parsed.data;

    try {
        // Reference data first (cheap, idempotent), then profiles, then
        // the transactional apply. Failures surface as 502 so the game
        // server knows nothing was recorded.
        await ensureAchievementCatalogue();
        await ensureProfilesForParticipants(participants);

        const outcomes = await ingestMatchResult({
            gameId,
            roomId,
            participants: participants.map((participant) => ({
                userId: participant.userId,
                gameId,
                outcome: participant.outcome,
                playerCount: participants.length,
                seat: participant.seat,
                durationSeconds: participant.durationSeconds ?? 0,
                currentStreak: 0, // replaced inside the transaction
                bestStreak: 0,
            })),
        });

        // The transaction re-reads real streak state; the placeholders
        // above only satisfy the type. Outcomes carry the truth.
        return NextResponse.json({ ingested: outcomes.length, outcomes });
    } catch (error) {
        console.error("[profile] match ingestion failed:", error);
        return NextResponse.json(
            { error: "Ingestion failed" },
            { status: 502 },
        );
    }
}
