/**
 * POST /api/internal/match-stakes/:roomId/void — cancel a staked match.
 *
 * Server-to-server (HMAC, like the create route). Refunds every HELD seat
 * back to its owner and marks the match VOID. Idempotent: a void on an
 * already settled/void match is a no-op.
 */

import { NextResponse } from "next/server";

import { voidStakes } from "@/lib/wallet/match-stakes";
import { verifyRealtimeSignature } from "@/lib/realtime/request-signature";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const rawBody = await request.text();

  if (
    !verifyRealtimeSignature(
      rawBody,
      request.headers.get("x-realtime-signature"),
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { roomId } = await params;

  try {
    await voidStakes(roomId);
    return NextResponse.json({ ok: true, roomId });
  } catch (error) {
    console.error("[match-stakes] void failed:", error);
    return NextResponse.json({ error: "Void failed" }, { status: 502 });
  }
}
