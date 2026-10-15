/**
 * POST /api/wallet/games/:roomId/cancel — the player takes their stake back.
 *
 * Session-authenticated. Only valid while the match has not started:
 * `cancelHold` refunds this seat's HELD stake and shrinks the pot. A
 * no-op when the seat is not held (already released, paid, or never
 * funded), so it is safe to retry.
 */

import { NextResponse } from "next/server";

import { cancelHold } from "@/lib/wallet/match-stakes";
import {
  parseJsonBody,
  rateLimitResponse,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { stakeLimiter } from "@/lib/wallet/rate-limit";
import { requireWalletSession } from "@/lib/wallet/session";
import { stakeCancelSchema } from "@/lib/validation/wallet";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = stakeLimiter.consume(`stake:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, stakeCancelSchema);
    const { roomId } = await params;

    await cancelHold({
      userId: session.user.id,
      roomId,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json({ ok: true, roomId });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
