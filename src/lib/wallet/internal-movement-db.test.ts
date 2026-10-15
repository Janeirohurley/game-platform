/**
 * postInternalMovement — game stakes against the real database.
 *
 * These tests pin the money invariants that make stakes safe to ship:
 *   - a stake debits the wallet into the per-match escrow (no provider);
 *   - IDEMPOTENCY: replaying a key posts NOTHING a second time, and a
 *     DIFFERENT request on a reused key is rejected;
 *   - NO OVERDRAFT: a stake larger than the balance is refused, and the
 *     escrow can never pay out more than it holds;
 *   - a payout drains the escrow to the winner; a draw refunds each owner
 *     and leaves the escrow at exactly zero;
 *   - currency mixing is rejected (a match is one currency);
 *   - the ledger stays DOUBLE-ENTRY: every transaction sums to zero.
 *
 * Skipped when DATABASE_URL is absent. Creates its own users/wallets and
 * removes them afterwards. JET is the internal stake token (no provider).
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

process.env.WALLET_DEFAULT_CURRENCY ??= "BIF";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { ledgerEntries, wallets, walletTransactions } from "@/lib/db/schema/wallet";
import { WalletError, type WalletErrorCode } from "./errors";
import { postInternalMovement } from "./engine";
import {
  getBalanceMinor,
  getLedgerForTransaction,
  payoutPosting,
  postLedger,
  stakePosting,
  stakeRefundPosting,
} from "./ledger";
import { ensureWallet } from "./wallet";

const HAS_DB = !!process.env.DATABASE_URL;
const dbSuite = HAS_DB ? describe : describe.skip;

const CURRENCY = "JET";
const USER_A = `test-stake-a-${randomUUID().slice(0, 12)}`;
const USER_B = `test-stake-b-${randomUUID().slice(0, 12)}`;

let walletA = "";
let walletB = "";

async function expectWalletError(code: WalletErrorCode, run: () => Promise<unknown>): Promise<void> {
  let thrown: unknown = null;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(WalletError);
  expect((thrown as WalletError).code).toBe(code);
}

/**
 * Test-only faucet: seeds a wallet with JET by posting a balanced
 * double-entry credit (wallet +amount / external:test-faucet −amount).
 * There is no provider for JET, so the seed must be an honest posting.
 */
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
    provider: "test-faucet",
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

async function escrowBalance(roomId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint` })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.account, `escrow:${roomId}`));
  return Number(rows[0]?.total ?? 0);
}

function room(): string {
  return `room-${randomUUID().slice(0, 8)}`;
}

dbSuite("postInternalMovement (game stakes, database)", () => {
  beforeAll(async () => {
    await db.insert(user).values([
      { id: USER_A, name: "Stake A", email: `${USER_A}@example.test` },
      { id: USER_B, name: "Stake B", email: `${USER_B}@example.test` },
    ]);
    walletA = (await ensureWallet(USER_A, CURRENCY)).id;
    walletB = (await ensureWallet(USER_B, CURRENCY)).id;
  }, 30_000);

  afterAll(async () => {
    const walletsOf = sql`(select id from wallets where user_id in (${USER_A}, ${USER_B}))`;
    const txScope = sql`(select id from wallet_transactions where wallet_id in ${walletsOf})`;
    await db.delete(ledgerEntries).where(sql`transaction_id in ${txScope}`);
    await db.delete(walletTransactions).where(sql`wallet_id in ${walletsOf}`);
    await db.delete(wallets).where(sql`user_id in (${USER_A}, ${USER_B})`);
    await db.delete(user).where(sql`id in (${USER_A}, ${USER_B})`);
  }, 30_000);

  test("a stake debits the wallet into the per-match escrow", async () => {
    await fund(walletA, 5_000);
    const roomId = room();
    const before = await getBalanceMinor(walletA);

    const res = await postInternalMovement({
      type: "stake",
      walletId: walletA,
      currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
      metadata: { roomId, stakeMinor: 1_000 },
    });

    expect(res.duplicate).toBe(false);
    expect(res.transaction.type).toBe("stake");
    expect(res.transaction.status).toBe("succeeded");
    expect(res.transaction.grossAmount).toBe(1_000);
    expect(res.transaction.provider).toBeNull();
    expect(await getBalanceMinor(walletA)).toBe(before - 1_000);
    expect(await escrowBalance(roomId)).toBe(1_000);
  }, 30_000);

  test("replaying the same key is idempotent (no second debit)", async () => {
    await fund(walletA, 2_000);
    const roomId = room();
    const key = `stake-idem-${randomUUID()}`;
    const posting = stakePosting({ walletId: walletA, roomId, amountMinor: 500 });

    const first = await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY, posting, idempotencyKey: key,
    });
    expect(first.duplicate).toBe(false);
    const afterFirst = await getBalanceMinor(walletA);

    const again = await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY, posting, idempotencyKey: key,
    });
    expect(again.duplicate).toBe(true);
    expect(again.transaction.id).toBe(first.transaction.id);
    // Money moved EXACTLY once.
    expect(await getBalanceMinor(walletA)).toBe(afterFirst);
    expect(await escrowBalance(roomId)).toBe(500);
  }, 30_000);

  test("a different request on a reused idempotency key is rejected", async () => {
    await fund(walletA, 1_000);
    const key = `stake-conflict-${randomUUID()}`;
    await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId: room(), amountMinor: 500 }),
      idempotencyKey: key,
    });
    await expectWalletError("idempotency_conflict", () =>
      postInternalMovement({
        type: "stake", walletId: walletA, currency: CURRENCY,
        posting: stakePosting({ walletId: walletA, roomId: room(), amountMinor: 700 }),
        idempotencyKey: key,
      }),
    );
  }, 30_000);

  test("a stake can never overdraw the wallet", async () => {
    await fund(walletA, 300);
    const before = await getBalanceMinor(walletA);
    await expectWalletError("insufficient_funds", () =>
      postInternalMovement({
        type: "stake", walletId: walletA, currency: CURRENCY,
        posting: stakePosting({ walletId: walletA, roomId: room(), amountMinor: before + 1 }),
        idempotencyKey: `stake-over-${randomUUID()}`,
      }),
    );
    // Nothing changed — no partial debit.
    expect(await getBalanceMinor(walletA)).toBe(before);
  }, 30_000);

  test("concurrent stakes of the same balance: at most one can win", async () => {
    await fund(walletA, 1_000);
    const roomId = room();
    // Stake the FULL current balance, so two concurrent attempts cannot
    // both succeed — only the first holds enough.
    const full = await getBalanceMinor(walletA);
    const attempt = () =>
      postInternalMovement({
        type: "stake", walletId: walletA, currency: CURRENCY,
        posting: stakePosting({ walletId: walletA, roomId, amountMinor: full }),
        idempotencyKey: `stake-race-${randomUUID()}`,
      });

    const settled = await Promise.allSettled([attempt(), attempt()]);
    const wins = settled.filter((r) => r.status === "fulfilled");
    expect(wins.length).toBe(1);
    expect(await escrowBalance(roomId)).toBe(full);
  }, 30_000);

  test("a payout drains the escrow to the winner", async () => {
    // Two players stake 1000 each → pot 2000 in escrow.
    const roomId = room();
    await fund(walletA, 5_000);
    await fund(walletB, 5_000);
    await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });
    await postInternalMovement({
      type: "stake", walletId: walletB, currency: CURRENCY,
      posting: stakePosting({ walletId: walletB, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });
    expect(await escrowBalance(roomId)).toBe(2_000);

    const winnerBefore = await getBalanceMinor(walletA);
    const loserBefore = await getBalanceMinor(walletB);

    const payout = await postInternalMovement({
      type: "payout", walletId: walletA, currency: CURRENCY,
      posting: payoutPosting({ roomId, potMinor: 2_000, rakeMinor: 0, payouts: [{ walletId: walletA, amountMinor: 2_000 }] }),
      idempotencyKey: `payout-${randomUUID()}`,
      metadata: { roomId, potMinor: 2_000, rakeMinor: 0 },
    });

    expect(payout.transaction.type).toBe("payout");
    expect(payout.transaction.grossAmount).toBe(2_000);
    expect(await getBalanceMinor(walletA)).toBe(winnerBefore + 2_000);
    expect(await getBalanceMinor(walletB)).toBe(loserBefore); // loser: nothing more moves
    expect(await escrowBalance(roomId)).toBe(0); // escrow fully drained
  }, 30_000);

  test("the escrow can never pay out more than it holds", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });
    const before = await getBalanceMinor(walletA);
    await expectWalletError("insufficient_funds", () =>
      postInternalMovement({
        type: "payout", walletId: walletA, currency: CURRENCY,
        posting: payoutPosting({ roomId, potMinor: 5_000, rakeMinor: 0, payouts: [{ walletId: walletA, amountMinor: 5_000 }] }),
        idempotencyKey: `payout-over-${randomUUID()}`,
      }),
    );
    // No money appeared anywhere.
    expect(await getBalanceMinor(walletA)).toBe(before);
    expect(await escrowBalance(roomId)).toBe(1_000);
  }, 30_000);

  test("a draw refunds each stake to its owner and empties the escrow", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    await fund(walletB, 5_000);
    await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });
    await postInternalMovement({
      type: "stake", walletId: walletB, currency: CURRENCY,
      posting: stakePosting({ walletId: walletB, roomId, amountMinor: 1_000 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });

    const aBefore = await getBalanceMinor(walletA);
    const bBefore = await getBalanceMinor(walletB);

    await postInternalMovement({
      type: "refund", walletId: walletA, currency: CURRENCY,
      posting: stakeRefundPosting({ walletId: walletA, roomId, amountMinor: 1_000 }),
      idempotencyKey: `refund-${randomUUID()}`,
      metadata: { roomId, reason: "draw" },
    });
    await postInternalMovement({
      type: "refund", walletId: walletB, currency: CURRENCY,
      posting: stakeRefundPosting({ walletId: walletB, roomId, amountMinor: 1_000 }),
      idempotencyKey: `refund-${randomUUID()}`,
      metadata: { roomId, reason: "draw" },
    });

    expect(await getBalanceMinor(walletA)).toBe(aBefore + 1_000);
    expect(await getBalanceMinor(walletB)).toBe(bBefore + 1_000);
    expect(await escrowBalance(roomId)).toBe(0);
  }, 30_000);

  test("mixing currencies is rejected", async () => {
    const roomId = room();
    await fund(walletA, 1_000);
    await expectWalletError("currency_mismatch", () =>
      postInternalMovement({
        type: "stake", walletId: walletA, currency: "BIF",
        posting: stakePosting({ walletId: walletA, roomId, amountMinor: 100 }),
        idempotencyKey: `stake-currency-${randomUUID()}`,
      }),
    );
  }, 30_000);

  test("every posted transaction leaves the ledger balanced (sum = 0)", async () => {
    const roomId = room();
    await fund(walletA, 5_000);
    const stake = await postInternalMovement({
      type: "stake", walletId: walletA, currency: CURRENCY,
      posting: stakePosting({ walletId: walletA, roomId, amountMinor: 400 }),
      idempotencyKey: `stake-${randomUUID()}`,
    });
    const refund = await postInternalMovement({
      type: "refund", walletId: walletA, currency: CURRENCY,
      posting: stakeRefundPosting({ walletId: walletA, roomId, amountMinor: 400 }),
      idempotencyKey: `refund-${randomUUID()}`,
    });

    for (const id of [stake.transaction.id, refund.transaction.id]) {
      const legs = await getLedgerForTransaction(id);
      const total = legs.reduce((sum, leg) => sum + leg.amountMinor, 0);
      expect(total).toBe(0);
      expect(legs.length).toBeGreaterThan(0);
    }
  }, 30_000);
});
