/**
 * Withdrawal requests — the MANUAL payout queue.
 *
 * Money rules:
 *  - creating a request DEBITS the wallet immediately (the user's balance
 *    always reflects spendable points); the debit is a normal ledger
 *    movement (`type: "withdrawal"`, counterpart `external:manual`);
 *  - a rejection posts the exact INVERSE movement (`type: "refund"`);
 *  - approving and marking paid only advance the request status — the
 *    payment itself happens outside the application.
 *
 * Everything is idempotent and serialized: the request row is locked
 * `FOR UPDATE` on every decision, and the underlying movement carries its
 * own idempotency key.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ledgerEntries,
  wallets,
} from "@/lib/db/schema/wallet";
import { withdrawalRequests } from "@/lib/db/schema/points";
import { user } from "@/lib/db/schema/auth";
import { manualCreditPosting, manualDebitPosting, toAmount } from "./ledger";
import { postInternalMovementInTx, type DbTx } from "./engine";
import { getWalletSettings } from "./settings";
import { ensureWallet } from "./wallet";
import { WalletError } from "./errors";
import type { WalletSettingsRow } from "./settings";
import { POINTS_CURRENCY } from "./points-types";

export type WithdrawalRequestRow = typeof withdrawalRequests.$inferSelect;

export interface CreateWithdrawalRequestInput {
  userId: string;
  /** Points to withdraw — integer, at least the configured minimum. */
  points: number;
  userNote?: string | null;
  /** Client-supplied key; namespaced per user before being stored. */
  idempotencyKey: string;
}

export interface CreateWithdrawalRequestResult {
  request: WithdrawalRequestRow;
  balanceMinor: number;
  duplicate: boolean;
}

async function balanceInTx(tx: DbTx, walletId: string): Promise<number> {
  const rows = await tx
    .select({
      total: sql<string | null>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.walletId, walletId));
  return toAmount(rows[0]?.total ?? 0);
}

function assertPoints(points: unknown): number {
  if (
    typeof points !== "number" ||
    !Number.isSafeInteger(points) ||
    points <= 0
  ) {
    throw new WalletError("validation", "points must be a positive integer.");
  }
  return points;
}

/**
 * Create a withdrawal request. The debit and the request row commit
 * together, so the queue can never show a request whose points were not
 * actually taken (nor take points without a request).
 */
export async function createWithdrawalRequest(
  input: CreateWithdrawalRequestInput,
): Promise<CreateWithdrawalRequestResult> {
  const points = assertPoints(input.points);
  if (!input.idempotencyKey.trim()) {
    throw new WalletError("validation", "idempotencyKey is required.");
  }

  const settings = await getWalletSettings();
  if (points < settings.minWithdrawalPoints) {
    throw new WalletError(
      "validation",
      `The minimum withdrawal is ${settings.minWithdrawalPoints} points.`,
      { minWithdrawalPoints: settings.minWithdrawalPoints },
    );
  }

  const wallet = await ensureWallet(input.userId, POINTS_CURRENCY);
  const storedKey = `withdrawal-request:${input.userId}:${input.idempotencyKey.trim()}`;

  return db.transaction(async (tx) => {
    const own = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, wallet.id))
      .limit(1)
      .for("update");
    if (!own[0]) {
      throw new WalletError("not_found", "Wallet not found.");
    }

    const existing = await tx
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.idempotencyKey, storedKey))
      .limit(1);
    if (existing[0]) {
      return {
        request: existing[0],
        balanceMinor: await balanceInTx(tx, wallet.id),
        duplicate: true,
      };
    }

    const requestId = randomUUID();
    const inserted = await tx
      .insert(withdrawalRequests)
      .values({
        id: requestId,
        userId: input.userId,
        walletId: wallet.id,
        amountMinor: points,
        currency: POINTS_CURRENCY,
        status: "pending",
        idempotencyKey: storedKey,
        userNote: input.userNote?.trim() || null,
      })
      .onConflictDoNothing({ target: withdrawalRequests.idempotencyKey })
      .returning();

    if (!inserted[0]) {
      // A concurrent retry won the insert — return its row, post nothing.
      const raced = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.idempotencyKey, storedKey))
        .limit(1);
      if (!raced[0]) {
        throw new WalletError("internal", "Unable to create the request.");
      }
      return {
        request: raced[0],
        balanceMinor: await balanceInTx(tx, wallet.id),
        duplicate: true,
      };
    }

    // Debit under the same transaction. If the balance is insufficient the
    // whole transaction rolls back — no request, no debit.
    const movement = await postInternalMovementInTx(tx, {
      type: "withdrawal",
      walletId: wallet.id,
      currency: POINTS_CURRENCY,
      posting: manualDebitPosting({ walletId: wallet.id, amountMinor: points }),
      idempotencyKey: `withdrawal:${requestId}`,
      metadata: {
        withdrawalRequestId: requestId,
        reason: "withdrawal_request",
      },
    });

    const updated = await tx
      .update(withdrawalRequests)
      .set({ debitTransactionId: movement.transaction.id })
      .where(eq(withdrawalRequests.id, requestId))
      .returning();

    return {
      request: updated[0] ?? inserted[0],
      balanceMinor: await balanceInTx(tx, wallet.id),
      duplicate: false,
    };
  });
}

async function lockRequest(
  tx: DbTx,
  requestId: string,
): Promise<WithdrawalRequestRow> {
  const rows = await tx
    .select()
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.id, requestId))
    .limit(1)
    .for("update");
  if (!rows[0]) {
    throw new WalletError("not_found", "Withdrawal request not found.");
  }
  return rows[0];
}

export interface AdminDecisionInput {
  requestId: string;
  adminId: string;
}

/** pending → approved. No money movement: the points were debited at creation. */
export async function approveWithdrawalRequest(
  input: AdminDecisionInput,
): Promise<WithdrawalRequestRow> {
  return db.transaction(async (tx) => {
    const request = await lockRequest(tx, input.requestId);
    if (request.status === "approved" || request.status === "paid") {
      return request;
    }
    if (request.status !== "pending") {
      throw new WalletError(
        "invalid_state",
        `This request is ${request.status} and cannot be approved.`,
      );
    }
    const updated = await tx
      .update(withdrawalRequests)
      .set({
        status: "approved",
        decidedBy: input.adminId,
        decidedAt: new Date(),
      })
      .where(eq(withdrawalRequests.id, request.id))
      .returning();
    return updated[0];
  });
}

/** approved → paid (the admin paid outside the app). Idempotent. */
export async function markWithdrawalRequestPaid(
  input: AdminDecisionInput,
): Promise<WithdrawalRequestRow> {
  return db.transaction(async (tx) => {
    const request = await lockRequest(tx, input.requestId);
    if (request.status === "paid") return request;
    if (request.status !== "approved") {
      throw new WalletError(
        "invalid_state",
        "Only an approved request can be marked as paid.",
      );
    }
    const updated = await tx
      .update(withdrawalRequests)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(withdrawalRequests.id, request.id))
      .returning();
    return updated[0];
  });
}

export interface RejectWithdrawalInput extends AdminDecisionInput {
  /** Mandatory: why the request was refused (shown to the user). */
  reason: string;
}

/**
 * pending|approved → rejected, refunding the debited points with an
 * inverse movement. The reason is mandatory.
 */
export async function rejectWithdrawalRequest(
  input: RejectWithdrawalInput,
): Promise<{ request: WithdrawalRequestRow; duplicate: boolean }> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new WalletError("validation", "A rejection reason is required.");
  }

  return db.transaction(async (tx) => {
    const request = await lockRequest(tx, input.requestId);
    if (request.status === "rejected") {
      return { request, duplicate: true };
    }
    if (request.status === "paid") {
      throw new WalletError(
        "invalid_state",
        "A paid request cannot be rejected.",
      );
    }

    const movement = await postInternalMovementInTx(tx, {
      type: "refund",
      walletId: request.walletId,
      currency: request.currency,
      posting: manualCreditPosting({
        walletId: request.walletId,
        amountMinor: request.amountMinor,
      }),
      idempotencyKey: `withdrawal-refund:${request.id}`,
      metadata: {
        withdrawalRequestId: request.id,
        reason: "withdrawal_rejected",
      },
    });

    const updated = await tx
      .update(withdrawalRequests)
      .set({
        status: "rejected",
        adminNote: reason,
        decidedBy: input.adminId,
        decidedAt: new Date(),
        refundTransactionId: movement.transaction.id,
      })
      .where(eq(withdrawalRequests.id, request.id))
      .returning();

    return { request: updated[0], duplicate: false };
  });
}

/** The user's own request history, newest first. */
export async function listWithdrawalRequestsForUser(
  userId: string,
  limit = 50,
): Promise<WithdrawalRequestRow[]> {
  return db
    .select()
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.userId, userId))
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export interface AdminWithdrawalQueueRow extends WithdrawalRequestRow {
  userEmail: string;
  userName: string;
}

/** Admin queue, newest first, optionally filtered by status. */
export async function listWithdrawalRequestsAdmin(options?: {
  status?: string;
  limit?: number;
}): Promise<AdminWithdrawalQueueRow[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const rows = await db
    .select({
      request: withdrawalRequests,
      userEmail: user.email,
      userName: user.name,
    })
    .from(withdrawalRequests)
    .innerJoin(user, eq(user.id, withdrawalRequests.userId))
    .where(
      options?.status
        ? eq(withdrawalRequests.status, options.status)
        : sql`true`,
    )
    .orderBy(desc(withdrawalRequests.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.request,
    userEmail: row.userEmail,
    userName: row.userName,
  }));
}

/** How many requests are still waiting for an admin decision. */
export async function countPendingWithdrawals(): Promise<number> {
  const rows = await db
    .select({ count: sql<string>`count(*)::bigint` })
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.status, "pending")));
  return toAmount(rows[0]?.count ?? 0);
}

/** Quote helper: what `points` are worth with the current tariff. */
export function withdrawalEstimate(
  settings: Pick<WalletSettingsRow, "sellMinorPerPoint" | "currency">,
  points: number,
): { points: number; amountMinor: number; currency: string } {
  const safePoints = assertPoints(points);
  const amountMinor = settings.sellMinorPerPoint * safePoints;
  if (!Number.isSafeInteger(amountMinor)) {
    throw new WalletError("validation", "The estimated amount is out of range.");
  }
  return {
    points: safePoints,
    amountMinor,
    currency: settings.currency,
  };
}
