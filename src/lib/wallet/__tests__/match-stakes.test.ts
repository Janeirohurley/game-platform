/**
 * Match-stakes lifecycle — service orchestration against the real database.
 *
 * Pins the higher-level invariants on top of postInternalMovement:
 *   - createMatchStake is idempotent per room;
 *   - holdStake debits the seat into escrow and grows the pot (idempotent);
 *   - cancelHold refunds a seat and shrinks the pot;
 *   - voidStakes refunds every held seat and voids the match;
 *   - settleStakes pays the winner the pot MINUS rake (draws refund all).
 *
 * Skipped when DATABASE_URL is absent. Creates its own users/wallets and
 * removes them afterwards. JET is the internal stake token (no provider).
 */

import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { ledgerEntries, wallets, walletTransactions } from "@/lib/db/schema/wallet";
import { matchStakeHolds, matchStakes } from "@/lib/db/schema/match-stakes";
import { postLedger } from "../ledger";
import { getBalanceMinor } from "../ledger";

import {
  createMatchStake,
  holdStake,
  cancelHold,
  voidStakes,
  settleStakes,
  getMatchStake,
} from "../match-stakes";

const HAS_DB = !!process.env.DATABASE_URL;
const dbSuite = HAS_DB ? describe : describe.skip;

const CURRENCY = "JET";
const USER_A = `test-mstake-a-${randomUUID().slice(0, 12)}`;
const USER_B = `test-mstake-b-${randomUUID().slice(0, 12)}`;

let walletA = "";
let walletB = "";

function room(): string {
  return `room-${randomUUID().slice(0, 8)}`;
}

/** Test-only faucet: seed a JET wallet with a balanced double-entry credit. */
async function fund(walletId: string, amountMinor: number): Promise<void> {
  const id = randomUUID();
  await db.insert(walletTransactions).values({
    id,
    walletId,
    type: "deposit",
    status: "succeeded",
    currency: CURRENCY,
    grossAmount: amountMinor,
    netAmount: amountMinor,
    idempotencyKey: `faucet-${id}`,
    completedAt: new Date(),
  });
  await postLedger(db, {
    transactionId: id,
    currency: CURRENCY,
    posting: {
      legs: [
        { account: "wallet", walletId, amountMinor },
        { account: "external:test-faucet", walletId: null, amountMinor: -amountMinor },
      ],
    },
  });
}

async function holdsFor(matchStakeId: string) {
  return db
    .select()
    .from(matchStakeHolds)
    .where(eq(matchStakeHolds.matchStakeId, matchStakeId));
}

dbSuite("match-stakes service (database)", () => {
  beforeAll(async () => {
    await db.insert(user).values([
      { id: USER_A, name: "Stake A", email: `${USER_A}@example.test` },
      { id: USER_B, name: "Stake B", email: `${USER_B}@example.test` },
    ]);
    const { ensureWallet } = await import("../wallet");
    walletA = (await ensureWallet(USER_A, CURRENCY)).id;
    walletB = (await ensureWallet(USER_B, CURRENCY)).id;
  }, 120_000);

  afterAll(async () => {
    const walletsOf = sql`(select id from wallets where user_id in (${USER_A}, ${USER_B}))`;
    const txScope = sql`(select id from wallet_transactions where wallet_id in ${walletsOf})`;
    const roomScope = sql`(select id from match_stakes where room_id like 'room-%')`;
    await db.delete(matchStakeHolds).where(sql`match_stake_id in ${roomScope}`);
    await db.delete(matchStakes).where(sql`room_id like 'room-%'`);
    await db.delete(ledgerEntries).where(sql`transaction_id in ${txScope}`);
    await db.delete(walletTransactions).where(sql`wallet_id in ${walletsOf}`);
    await db.delete(wallets).where(sql`user_id in (${USER_A}, ${USER_B})`);
    await db.delete(user).where(sql`id in (${USER_A}, ${USER_B})`);
  }, 120_000);

  test("createMatchStake is idempotent per room", async () => {
    const roomId = room();
    const s = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 500,
      rakeBps: 200,
    });
    expect(s.status).toBe("open");
    expect(s.stakeMinor).toBe(500);
    expect(s.rakeBps).toBe(200);
    expect(s.potMinor).toBe(0);

    const again = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 500,
    });
    expect(again.id).toBe(s.id);
  }, 120_000);

  test("holdStake debits the seat, grows the pot, and is idempotent", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    const stake = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 300,
    });
    const before = await getBalanceMinor(walletA);

    const r1 = await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 300,
      currency: CURRENCY,
      idempotencyKey: `h-${roomId}`,
    });
    expect(r1.duplicate).toBe(false);
    expect(await getBalanceMinor(walletA)).toBe(before - 300);

    const s1 = await getMatchStake(roomId);
    expect(s1!.potMinor).toBe(300);
    expect(s1!.status).toBe("funded");

    const r2 = await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 300,
      currency: CURRENCY,
      idempotencyKey: `h-${roomId}`,
    });
    expect(r2.duplicate).toBe(true);
    expect(await getBalanceMinor(walletA)).toBe(before - 300);

    const s2 = await getMatchStake(roomId);
    expect(s2!.potMinor).toBe(300);
    expect((await holdsFor(stake.id))[0].status).toBe("held");
  }, 120_000);

  test("cancelHold refunds the seat and shrinks the pot", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    const stake = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 200,
    });
    const before = await getBalanceMinor(walletA);
    await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 200,
      currency: CURRENCY,
      idempotencyKey: `h-${roomId}`,
    });
    await cancelHold({ userId: USER_A, roomId, idempotencyKey: `c-${roomId}` });

    expect(await getBalanceMinor(walletA)).toBe(before);
    const holds = await holdsFor(stake.id);
    expect(holds).toHaveLength(1);
    expect(holds[0].status).toBe("released");
    expect((await getMatchStake(roomId))!.potMinor).toBe(0);
  }, 120_000);

  test("voidStakes refunds every held seat and voids the match", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    await fund(walletB, 5_000);
    const stake = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 150,
    });
    const beforeA = await getBalanceMinor(walletA);
    const beforeB = await getBalanceMinor(walletB);
    await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 150,
      currency: CURRENCY,
      idempotencyKey: `h-a-${roomId}`,
    });
    await holdStake({
      userId: USER_B,
      roomId,
      amountMinor: 150,
      currency: CURRENCY,
      idempotencyKey: `h-b-${roomId}`,
    });
    await voidStakes(roomId);

    expect(await getBalanceMinor(walletA)).toBe(beforeA);
    expect(await getBalanceMinor(walletB)).toBe(beforeB);
    const holds = await holdsFor(stake.id);
    expect(holds).toHaveLength(2);
    for (const h of holds) expect(h.status).toBe("released");
    const s = await getMatchStake(roomId);
    expect(s!.status).toBe("void");
    expect(s!.potMinor).toBe(0);
  }, 120_000);

  test("settleStakes draw refunds every seat and settles with no winner", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    await fund(walletB, 5_000);
    const stake = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 100,
    });
    const beforeA = await getBalanceMinor(walletA);
    const beforeB = await getBalanceMinor(walletB);
    await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 100,
      currency: CURRENCY,
      idempotencyKey: `h-a-${roomId}`,
    });
    await holdStake({
      userId: USER_B,
      roomId,
      amountMinor: 100,
      currency: CURRENCY,
      idempotencyKey: `h-b-${roomId}`,
    });
    await settleStakes({
      roomId,
      outcomes: [
        { userId: USER_A, outcome: "draw" },
        { userId: USER_B, outcome: "draw" },
      ],
    });

    expect(await getBalanceMinor(walletA)).toBe(beforeA);
    expect(await getBalanceMinor(walletB)).toBe(beforeB);
    const holds = await holdsFor(stake.id);
    for (const h of holds) expect(h.status).toBe("released");
    const s = await getMatchStake(roomId);
    expect(s!.status).toBe("settled");
    expect(s!.winnerUserId).toBeNull();
  }, 120_000);

  test("settleStakes win pays the winner the pot minus rake", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    await fund(walletB, 5_000);
    const stake = await createMatchStake({
      roomId,
      gameId: "ludo",
      currency: CURRENCY,
      stakeMinor: 100,
      rakeBps: 500, // 5%
    });
    const beforeA = await getBalanceMinor(walletA);
    const beforeB = await getBalanceMinor(walletB);
    await holdStake({
      userId: USER_A,
      roomId,
      amountMinor: 100,
      currency: CURRENCY,
      idempotencyKey: `h-a-${roomId}`,
    });
    await holdStake({
      userId: USER_B,
      roomId,
      amountMinor: 100,
      currency: CURRENCY,
      idempotencyKey: `h-b-${roomId}`,
    });
    await settleStakes({
      roomId,
      outcomes: [
        { userId: USER_A, outcome: "win" },
        { userId: USER_B, outcome: "loss" },
      ],
    });

    // A staked 100, B staked 100 → pot 200, rake 5% = 10, payout 190.
    expect(await getBalanceMinor(walletA)).toBe(beforeA - 100 + 190);
    expect(await getBalanceMinor(walletB)).toBe(beforeB - 100);

    const holds = await holdsFor(stake.id);
    expect(holds).toHaveLength(2);
    const byUser = new Map(holds.map((h) => [h.userId, h.status]));
    expect(byUser.get(USER_A)).toBe("paid");
    expect(byUser.get(USER_B)).toBe("forfeited");
    const s = await getMatchStake(roomId);
    expect(s!.status).toBe("settled");
    expect(s!.winnerUserId).toBe(USER_A);
    expect(s!.potMinor).toBe(200);
  }, 120_000);
});
