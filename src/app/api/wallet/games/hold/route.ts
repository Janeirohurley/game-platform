/**
 * POST /api/wallet/games/hold — a seat funds its stake.
 *
 * Session-authenticated (the player consents to the hold). Flow:
 * session → rate limit → validate → `holdStake` (posts the stake into the
 * per-match escrow, idempotent per `match:<roomId>:hold:<userId>`). The
 * seat is marked HELD and the pot grows; a replay returns the same
 * transaction without a second debit.
 */

import { NextResponse } from "next/server";

import { holdStake } from "@/lib/wallet/match-stakes";
import {
  parseJsonBody,
  rateLimitResponse,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { stakeLimiter } from "@/lib/wallet/rate-limit";
import { requireWalletSession } from "@/lib/wallet/session";
import { stakeHoldSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = stakeLimiter.consume(`stake:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, stakeHoldSchema);

    const result = await holdStake({
      userId: session.user.id,
      roomId: body.roomId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      idempotencyKey: body.idempotencyKey,
    });

    return NextResponse.json(
      { transactionId: result.transactionId, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    return walletErrorResponse(error);
  }
}
