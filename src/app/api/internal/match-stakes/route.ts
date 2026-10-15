/**
 * POST /api/internal/match-stakes — open a staked match.
 *
 * Server-to-server: the Colyseus room calls this when the host fixes the
 * stake, authenticated by a per-request HMAC of the raw body (see
 * `verifyRealtimeSignature`). Creates `match_stakes` in OPEN; seats are
 * funded separately through `/api/wallet/games/hold`.
 */

import { NextResponse } from "next/server";

import { createMatchStake } from "@/lib/wallet/match-stakes";
import { verifyRealtimeSignature } from "@/lib/realtime/request-signature";
import { matchStakeCreateSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (
    !verifyRealtimeSignature(
      rawBody,
      request.headers.get("x-realtime-signature"),
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = matchStakeCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const stake = await createMatchStake(parsed.data);
    return NextResponse.json({
      id: stake.id,
      roomId: stake.roomId,
      gameId: stake.gameId,
      currency: stake.currency,
      stakeMinor: stake.stakeMinor,
      rakeBps: stake.rakeBps,
      status: stake.status,
    });
  } catch (error) {
    console.error("[match-stakes] create failed:", error);
    return NextResponse.json({ error: "Create failed" }, { status: 502 });
  }
}
