/**
 * Match stakes service — orchestration of staked games.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { matchStakeHolds, matchStakes } from "@/lib/db/schema/match-stakes";
import { postInternalMovement, postInternalMovementInTx } from "./engine";
import {
  payoutPosting,
  stakePosting,
  stakeRefundPosting,
} from "./ledger";
import { WalletError } from "./errors";
import { ensureWallet } from "./wallet";
import type { GameId } from "@/lib/games/registry";

export interface MatchStakeOutcomes {
  userId: string;
  outcome: "win" | "loss" | "draw";
}

function computeRakeMinor(potMinor: number, rakeBps: number): number {
  if (rakeBps <= 0) return 0;
  const rake = Math.floor((potMinor * rakeBps) / 10000);
  return rake >= 0 ? rake : 0;
}

export async function createMatchStake(input: {
  roomId: string;
  gameId: GameId;
  currency: string;
  stakeMinor: number;
  rakeBps?: number;
}): Promise<typeof matchStakes.$inferSelect> {
  const inserted = await db
    .insert(matchStakes)
    .values({
      id: crypto.randomUUID(),
      roomId: input.roomId,
      gameId: input.gameId,
      currency: input.currency,
      stakeMinor: input.stakeMinor,
      rakeBps: Math.max(0, Math.min(10000, input.rakeBps ?? 0)),
      status: "open",
      potMinor: 0,
    })
    .onConflictDoNothing({ target: matchStakes.roomId })
    .returning();

  if (inserted[0]) return inserted[0];
  const existing = await db
    .select()
    .from(matchStakes)
    .where(eq(matchStakes.roomId, input.roomId))
    .limit(1);
  if (!existing[0]) {
    throw new WalletError("internal", "Unable to create match stake.");
  }
  return existing[0];
}
export async function getMatchStake(roomId: string) {
  const rows = await db
    .select()
    .from(matchStakes)
    .where(eq(matchStakes.roomId, roomId))
    .limit(1);
  return rows[0] ?? null;
}

/** The caller's view of a staked room: the match, plus their own seat. */
export async function getStakeStateForUser(roomId: string, userId: string) {
  const stake = await getMatchStake(roomId);
  if (!stake) return null;
  const hold = await db
    .select()
    .from(matchStakeHolds)
    .where(
      and(
        eq(matchStakeHolds.matchStakeId, stake.id),
        eq(matchStakeHolds.userId, userId),
      ),
    )
    .limit(1);
  return { stake, hold: hold[0] ?? null };
}

export async function holdStake(input: {
  userId: string;
  roomId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
}): Promise<{ transactionId: string; duplicate: boolean }> {
  const stake = await getMatchStake(input.roomId);
  if (!stake) {
    throw new WalletError("not_found", "Match stake not found for this room.");
  }
  if (stake.status === "settled" || stake.status === "void") {
    throw new WalletError("invalid_state", "This match is already settled.");
  }
  if (stake.stakeMinor !== input.amountMinor) {
    throw new WalletError("amount_mismatch", "Stake amount does not match the room stake.");
  }
  if (stake.currency !== input.currency) {
    throw new WalletError("currency_mismatch", "Currency mismatch for this stake.");
  }

  const idemKey = input.idempotencyKey || `match:${input.roomId}:hold:${input.userId}`;
  const walletId = (await ensureWallet(input.userId, input.currency)).id;

  const mv = await postInternalMovement({
    type: "stake",
    walletId,
    currency: input.currency,
    posting: stakePosting({
      walletId,
      roomId: input.roomId,
      amountMinor: input.amountMinor,
    }),
    idempotencyKey: idemKey,
    metadata: { roomId: input.roomId, userId: input.userId },
  });

  await db
    .insert(matchStakeHolds)
    .values({
      matchStakeId: stake.id,
      userId: input.userId,
      amountMinor: input.amountMinor,
      transactionId: mv.transaction.id,
      status: "held",
    })
    .onConflictDoNothing({
      target: [matchStakeHolds.matchStakeId, matchStakeHolds.userId],
    });

  await db
    .update(matchStakes)
    .set({
      potMinor: stake.potMinor + (mv.duplicate ? 0 : input.amountMinor),
      status: "funded",
    })
    .where(eq(matchStakes.id, stake.id));

  return { transactionId: mv.transaction.id, duplicate: mv.duplicate };
}
export async function cancelHold(input: {
  userId: string;
  roomId: string;
  idempotencyKey: string;
}): Promise<void> {
  const pre = await getMatchStake(input.roomId);
  if (!pre) throw new WalletError("not_found", "Match stake not found.");
  const walletId = (await ensureWallet(input.userId, pre.currency)).id;

  await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(matchStakes)
      .where(eq(matchStakes.roomId, input.roomId))
      .limit(1)
      .for("update");
    const stake = locked[0];
    if (!stake) throw new WalletError("not_found", "Match stake not found.");

    const hold = (
      await tx
        .select()
        .from(matchStakeHolds)
        .where(
          and(
            eq(matchStakeHolds.matchStakeId, stake.id),
            eq(matchStakeHolds.userId, input.userId),
          ),
        )
        .limit(1)
    )[0];
    if (!hold || hold.status !== "held") return;

    await postInternalMovementInTx(tx, {
      type: "refund",
      walletId,
      currency: stake.currency,
      posting: stakeRefundPosting({
        walletId,
        roomId: input.roomId,
        amountMinor: hold.amountMinor,
      }),
      idempotencyKey:
        input.idempotencyKey || `match:${input.roomId}:cancel:${input.userId}`,
      metadata: { roomId: input.roomId, userId: input.userId, reason: "cancel" },
    });

    await tx
      .update(matchStakeHolds)
      .set({ status: "released" })
      .where(
        and(
          eq(matchStakeHolds.matchStakeId, stake.id),
          eq(matchStakeHolds.userId, input.userId),
        ),
      );
    await tx
      .update(matchStakes)
      .set({ potMinor: Math.max(0, stake.potMinor - hold.amountMinor) })
      .where(eq(matchStakes.id, stake.id));
  });
}

export async function voidStakes(roomId: string): Promise<void> {
  const pre = await getMatchStake(roomId);
  if (!pre) return;
  const holdsPre = await db
    .select()
    .from(matchStakeHolds)
    .where(eq(matchStakeHolds.matchStakeId, pre.id));
  const walletIdByUser = new Map<string, string>();
  for (const h of holdsPre) {
    walletIdByUser.set(h.userId, (await ensureWallet(h.userId, pre.currency)).id);
  }

  await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(matchStakes)
      .where(eq(matchStakes.roomId, roomId))
      .limit(1)
      .for("update");
    const stake = locked[0];
    if (!stake) return;
    if (stake.status === "settled" || stake.status === "void") return;

    const holds = await tx
      .select()
      .from(matchStakeHolds)
      .where(eq(matchStakeHolds.matchStakeId, stake.id));

    for (const h of holds) {
      if (h.status !== "held") continue;
      const walletId = walletIdByUser.get(h.userId)!;
      await postInternalMovementInTx(tx, {
        type: "refund",
        walletId,
        currency: stake.currency,
        posting: stakeRefundPosting({
          walletId,
          roomId,
          amountMinor: h.amountMinor,
        }),
        idempotencyKey: `match:${roomId}:void:${h.userId}`,
        metadata: { roomId, userId: h.userId, reason: "void" },
      });
    }

    await tx
      .update(matchStakeHolds)
      .set({ status: "released" })
      .where(eq(matchStakeHolds.matchStakeId, stake.id));
    await tx
      .update(matchStakes)
      .set({ status: "void", potMinor: 0, settledAt: new Date() })
      .where(eq(matchStakes.id, stake.id));
  });
}
export async function settleStakes(input: {
  roomId: string;
  outcomes: MatchStakeOutcomes[];
}): Promise<void> {
  // Resolve participant wallets before the transaction: holds were posted
  // through `ensureWallet`, so these are lookups that never leave the tx
  // needing to create rows mid-flight.
  const pre = await getMatchStake(input.roomId);
  if (!pre) return;
  const holdsPre = await db
    .select()
    .from(matchStakeHolds)
    .where(eq(matchStakeHolds.matchStakeId, pre.id));
  const walletIdByUser = new Map<string, string>();
  for (const userId of new Set([
    ...holdsPre.map((h) => h.userId),
    ...input.outcomes.map((o) => o.userId),
  ])) {
    walletIdByUser.set(userId, (await ensureWallet(userId, pre.currency)).id);
  }

  // One transaction: the settlement transition is guarded by a FOR UPDATE
  // lock on `match_stakes`, so concurrent reports (profile ingestion retries
  // included) can never both settle. Idempotency keys on each movement are
  // the second line of defence.
  await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(matchStakes)
      .where(eq(matchStakes.roomId, input.roomId))
      .limit(1)
      .for("update");
    const stake = locked[0];
    if (!stake) return;
    // Replay / already-final: nothing to do.
    if (stake.status === "settled" || stake.status === "void") return;

    const holds = await tx
      .select()
      .from(matchStakeHolds)
      .where(eq(matchStakeHolds.matchStakeId, stake.id));

    if (holds.length === 0) {
      await tx
        .update(matchStakes)
        .set({ status: "void", settledAt: new Date() })
        .where(eq(matchStakes.id, stake.id));
      return;
    }

    const isDraw =
      input.outcomes.length > 0 &&
      input.outcomes.every((o) => o.outcome === "draw");

    if (isDraw) {
      for (const h of holds) {
        if (h.status !== "held") continue;
        const walletId = walletIdByUser.get(h.userId)!;
        await postInternalMovementInTx(tx, {
          type: "refund",
          walletId,
          currency: stake.currency,
          posting: stakeRefundPosting({
            walletId,
            roomId: input.roomId,
            amountMinor: h.amountMinor,
          }),
          idempotencyKey: `match:${input.roomId}:draw:${h.userId}`,
          metadata: { roomId: input.roomId, userId: h.userId, reason: "draw" },
        });
      }
      await tx
        .update(matchStakeHolds)
        .set({ status: "released" })
        .where(eq(matchStakeHolds.matchStakeId, stake.id));
      await tx
        .update(matchStakes)
        .set({ status: "settled", settledAt: new Date(), winnerUserId: null })
        .where(eq(matchStakes.id, stake.id));
      return;
    }

    const winner =
      input.outcomes.find((o) => o.outcome === "win")?.userId ?? null;
    const pot = stake.potMinor;
    const rake = computeRakeMinor(pot, stake.rakeBps);
    const payoutTotal = pot - rake;
    const winnerHold = winner
      ? holds.find((h) => h.userId === winner)
      : undefined;

    if (winner && winnerHold && payoutTotal > 0) {
      const walletId = walletIdByUser.get(winner)!;
      await postInternalMovementInTx(tx, {
        type: "payout",
        walletId,
        currency: stake.currency,
        posting: payoutPosting({
          roomId: input.roomId,
          potMinor: pot,
          rakeMinor: rake,
          payouts: [{ walletId, amountMinor: payoutTotal }],
        }),
        idempotencyKey: `match:${input.roomId}:payout:${winner}`,
        metadata: {
          roomId: input.roomId,
          winnerUserId: winner,
          potMinor: pot,
          rakeMinor: rake,
        },
      });
    }

    // Winner's seat is paid; every other seat forfeits its stake.
    for (const h of holds) {
      await tx
        .update(matchStakeHolds)
        .set({ status: h.userId === winner ? "paid" : "forfeited" })
        .where(
          and(
            eq(matchStakeHolds.matchStakeId, stake.id),
            eq(matchStakeHolds.userId, h.userId),
          ),
        );
    }
    await tx
      .update(matchStakes)
      .set({ status: "settled", settledAt: new Date(), winnerUserId: winner })
      .where(eq(matchStakes.id, stake.id));
  });
}
