/**
 * GET /api/wallet/games/:roomId — the caller's stake state in a room.
 *
 * Session-authenticated read model for the lobby UI: the match stake
 * (amount, currency, pot, status) plus this player's own seat
 * (`hold.status` = held/released/paid/forfeited, or null if unfunded).
 * Returns 404 when the room has no stake.
 */

import { NextResponse } from "next/server";

import { getStakeStateForUser } from "@/lib/wallet/match-stakes";
import { walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const session = await requireWalletSession(request.headers);
    const { roomId } = await params;

    const state = await getStakeStateForUser(roomId, session.user.id);
    if (!state) {
      return NextResponse.json({ error: "No stake for this room" }, { status: 404 });
    }

    const { stake, hold } = state;
    return NextResponse.json({
      roomId: stake.roomId,
      gameId: stake.gameId,
      currency: stake.currency,
      stakeMinor: stake.stakeMinor,
      rakeBps: stake.rakeBps,
      potMinor: stake.potMinor,
      status: stake.status,
      winnerUserId: stake.winnerUserId,
      myHold: hold
        ? { amountMinor: hold.amountMinor, status: hold.status }
        : null,
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
