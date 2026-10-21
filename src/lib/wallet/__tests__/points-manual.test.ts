/**
 * Manual points layer — the money-critical invariants, against the real
 * database:
 *   - simultaneous withdrawal requests can never double-spend;
 *   - an insufficient balance rolls the request back (no orphan row);
 *   - a rejection restores exactly once, and re-rejecting is a no-op;
 *   - admin credit/debit is append-only and requires a reason;
 *   - tariffs reject nonsensical values.
 *
 * Skipped when DATABASE_URL is absent. Creates its own users and removes
 * them afterwards. Points are the PTS currency (exponent 0).
 */

import "dotenv/config";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { withdrawalRequests } from "@/lib/db/schema/points";
import {
  ledgerEntries,
  wallets,
  walletTransactions,
} from "@/lib/db/schema/wallet";
import { WalletError } from "../errors";
import { getBalanceMinor } from "../ledger";
import { POINTS_CURRENCY } from "../points-types";
import { adjustUserPoints } from "../admin-adjustments";
import { ensureWallet } from "../wallet";
import {
  createWithdrawalRequest,
  rejectWithdrawalRequest,
} from "../withdrawal-requests";
import {
  getWalletSettings,
  updateWalletSettings,
} from "../settings";

const HAS_DB = !!process.env.DATABASE_URL;
const dbSuite = HAS_DB ? describe : describe.skip;

const USER = `test-points-${randomUUID().slice(0, 12)}`;
const ADMIN = "test-admin-points";

let walletId = "";
let originalSettings: Awaited<ReturnType<typeof getWalletSettings>> | null = null;

async function balance(): Promise<number> {
  return getBalanceMinor(walletId);
}

function idem(): string {
  return randomUUID();
}

dbSuite("manual points (database)", () => {
  beforeAll(async () => {
    await db.insert(user).values({
      id: USER,
      name: "Points Test",
      email: `${USER}@example.test`,
    });
    walletId = (await ensureWallet(USER, POINTS_CURRENCY)).id;
    originalSettings = await getWalletSettings();
    // Keep the configured minimum reachable with small test amounts.
    await updateWalletSettings({
      ...originalSettings,
      minWithdrawalPoints: 100,
      updatedBy: ADMIN,
    });
  }, 120_000);

  afterAll(async () => {
    if (originalSettings) {
      await updateWalletSettings({
        currency: originalSettings.currency,
        buyPointsPerUnit: originalSettings.buyPointsPerUnit,
        sellMinorPerPoint: originalSettings.sellMinorPerPoint,
        minWithdrawalPoints: originalSettings.minWithdrawalPoints,
        minStakePoints: originalSettings.minStakePoints,
        maxStakePoints: originalSettings.maxStakePoints,
        contactInstructions: originalSettings.contactInstructions,
        updatedBy: ADMIN,
      });
    }
    const txScope = sql`(select id from wallet_transactions where wallet_id = ${walletId})`;
    await db
      .delete(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, USER));
    await db.delete(ledgerEntries).where(sql`transaction_id in ${txScope}`);
    await db.delete(walletTransactions).where(eq(walletTransactions.walletId, walletId));
    await db.delete(wallets).where(eq(wallets.userId, USER));
    await db.delete(user).where(eq(user.id, USER));
  }, 120_000);

  test("adjustment credits then debits, append-only", async () => {
    const credited = await adjustUserPoints({
      targetUserId: USER,
      amountMinor: 1_000,
      direction: "credit",
      reason: "test funding",
      adminId: ADMIN,
    });
    expect(credited.balanceMinor).toBe(1_000);

    const debited = await adjustUserPoints({
      targetUserId: USER,
      amountMinor: 200,
      direction: "debit",
      reason: "test correction",
      adminId: ADMIN,
    });
    expect(debited.balanceMinor).toBe(800);
    expect(await balance()).toBe(800);

    await expect(
      adjustUserPoints({
        targetUserId: USER,
        amountMinor: 10,
        direction: "credit",
        reason: "   ",
        adminId: ADMIN,
      }),
    ).rejects.toBeInstanceOf(WalletError);
  }, 120_000);

  test("insufficient balance rolls back the request and the debit", async () => {
    const before = await balance();
    await expect(
      createWithdrawalRequest({
        userId: USER,
        points: before + 1_000,
        idempotencyKey: idem(),
      }),
    ).rejects.toBeInstanceOf(WalletError);

    const rows = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, USER));
    expect(rows.length).toBe(0);
    expect(await balance()).toBe(before);
  }, 120_000);

  test("simultaneous requests with the same key debit exactly once", async () => {
    const before = await balance();
    const key = idem();
    const [first, second] = await Promise.all([
      createWithdrawalRequest({ userId: USER, points: 100, idempotencyKey: key }),
      createWithdrawalRequest({ userId: USER, points: 100, idempotencyKey: key }),
    ]);

    expect(first.request.id).toBe(second.request.id);
    expect([first.duplicate, second.duplicate].filter(Boolean).length).toBe(1);
    expect(await balance()).toBe(before - 100);

    const debits = await db
      .select()
      .from(walletTransactions)
      .where(
        sql`${walletTransactions.walletId} = ${walletId} and ${walletTransactions.type} = 'withdrawal'`,
      );
    expect(debits.length).toBe(1);
  }, 120_000);

  test("simultaneous distinct requests cannot overdraw", async () => {
    const before = await balance();
    const results = await Promise.allSettled([
      createWithdrawalRequest({
        userId: USER,
        points: before,
        idempotencyKey: idem(),
      }),
      createWithdrawalRequest({
        userId: USER,
        points: before,
        idempotencyKey: idem(),
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      WalletError,
    );
    expect(await balance()).toBe(0);
  }, 120_000);

  test("rejection restores exactly once, and re-rejecting is a no-op", async () => {
    await adjustUserPoints({
      targetUserId: USER,
      amountMinor: 1_000,
      direction: "credit",
      reason: "test refund funding",
      adminId: ADMIN,
    });
    const before = await balance();
    expect(before).toBe(1_000);

    const created = await createWithdrawalRequest({
      userId: USER,
      points: 400,
      idempotencyKey: idem(),
    });
    expect(await balance()).toBe(600);

    const first = await rejectWithdrawalRequest({
      requestId: created.request.id,
      adminId: ADMIN,
      reason: "test rejection",
    });
    expect(first.duplicate).toBe(false);
    expect(await balance()).toBe(1_000);

    const second = await rejectWithdrawalRequest({
      requestId: created.request.id,
      adminId: ADMIN,
      reason: "test rejection again",
    });
    expect(second.duplicate).toBe(true);
    expect(await balance()).toBe(1_000);

    const refunds = await db
      .select()
      .from(walletTransactions)
      .where(
        sql`${walletTransactions.walletId} = ${walletId} and ${walletTransactions.type} = 'refund' and ${walletTransactions.metadata}->>'withdrawalRequestId' = ${created.request.id}`,
      );
    expect(refunds.length).toBe(1);
  }, 120_000);

  test("tariff updates reject nonsensical values and persist valid ones", async () => {
    const current = await getWalletSettings();

    await expect(
      updateWalletSettings({
        ...current,
        minStakePoints: 500,
        maxStakePoints: 100,
        updatedBy: ADMIN,
      }),
    ).rejects.toBeInstanceOf(WalletError);

    await expect(
      updateWalletSettings({
        ...current,
        buyPointsPerUnit: 0,
        updatedBy: ADMIN,
      }),
    ).rejects.toBeInstanceOf(WalletError);

    const updated = await updateWalletSettings({
      ...current,
      buyPointsPerUnit: 250,
      sellMinorPerPoint: 5,
      updatedBy: ADMIN,
    });
    expect(updated.buyPointsPerUnit).toBe(250);
    expect(updated.sellMinorPerPoint).toBe(5);
  }, 120_000);
});
