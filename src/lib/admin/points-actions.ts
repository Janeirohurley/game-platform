"use server";

/**
 * Admin points server actions — the ONLY path that moves a user's points.
 *
 * Every action follows the house rules (lib/admin/actions.ts):
 *   1. re-verifies the caller's `admin` role SERVER-SIDE,
 *   2. validates input against the shared Zod schemas,
 *   3. calls the wallet service (never writes money directly),
 *   4. writes an AUDIT row for ok AND error outcomes,
 *   5. returns { ok, message } — a real result, no fake success.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import { withdrawalRequests } from "@/lib/db/schema/points";
import { adjustUserPoints } from "@/lib/wallet/admin-adjustments";
import { WalletError } from "@/lib/wallet/errors";
import {
  approveWithdrawalRequest,
  markWithdrawalRequestPaid,
  rejectWithdrawalRequest,
} from "@/lib/wallet/withdrawal-requests";
import {
  adminAdjustPointsSchema,
  walletSettingsUpdateSchema,
} from "@/lib/validation/wallet";
import { updateWalletSettings } from "@/lib/wallet/settings";
import { writeAuditLog } from "./audit";
import { requireAdminSession } from "./session";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

function toMessage(error: unknown): string {
  if (error instanceof WalletError) return error.message;
  return "L'opération a échoué côté serveur.";
}

async function targetOf(userId: string) {
  const rows = await db
    .select({
      email: user.email,
      gamerTag: profiles.username,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  return {
    userId,
    email: rows[0]?.email,
    gamerTag: rows[0]?.gamerTag ?? null,
  };
}

/** Credit or debit a user's points, with a mandatory reason. */
export async function adjustPointsAction(
  input: unknown,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
  };

  try {
    const parsed = adminAdjustPointsSchema.parse(input);
    const target = await targetOf(parsed.targetUserId);
    const result = await adjustUserPoints({
      targetUserId: parsed.targetUserId,
      amountMinor: parsed.amount,
      direction: parsed.direction,
      reason: parsed.reason,
      adminId: session.user.id,
    });

    await writeAuditLog({
      action:
        parsed.direction === "credit"
          ? "wallet.points.credit"
          : "wallet.points.debit",
      status: "ok",
      ...audit,
      target,
      details: {
        amountMinor: parsed.amount,
        reason: parsed.reason,
        transactionId: result.transactionId,
        balanceMinor: result.balanceMinor,
      },
    });

    revalidatePath("/admin/wallets");
    revalidatePath("/admin/audit");
    revalidatePath("/wallet");
    return {
      ok: true,
      message:
        parsed.direction === "credit"
          ? `${parsed.amount} points crédités (solde : ${result.balanceMinor}).`
          : `${parsed.amount} points débités (solde : ${result.balanceMinor}).`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.points.adjust",
      status: "error",
      ...audit,
      errorMessage: message,
      details: { input: typeof input === "object" ? input : undefined },
    });
    return { ok: false, message };
  }
}

async function requestTarget(requestId: string) {
  const rows = await db
    .select({ userId: withdrawalRequests.userId })
    .from(withdrawalRequests)
    .where(eq(withdrawalRequests.id, requestId))
    .limit(1);
  return rows[0] ? targetOf(rows[0].userId) : undefined;
}

export async function approveWithdrawalAction(
  requestId: string,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
  };
  try {
    const target = await requestTarget(requestId);
    await approveWithdrawalRequest({ requestId, adminId: session.user.id });
    await writeAuditLog({
      action: "wallet.withdrawal.approve",
      status: "ok",
      ...audit,
      target,
      details: { requestId },
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/audit");
    return { ok: true, message: "Demande approuvée." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.withdrawal.approve",
      status: "error",
      ...audit,
      errorMessage: message,
      details: { requestId },
    });
    return { ok: false, message };
  }
}

export async function rejectWithdrawalAction(input: {
  requestId: string;
  reason: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
  };
  try {
    const target = await requestTarget(input.requestId);
    await rejectWithdrawalRequest({
      requestId: input.requestId,
      adminId: session.user.id,
      reason: input.reason,
    });
    await writeAuditLog({
      action: "wallet.withdrawal.reject",
      status: "ok",
      ...audit,
      target,
      details: { requestId: input.requestId, reason: input.reason },
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/audit");
    revalidatePath("/wallet");
    return { ok: true, message: "Demande rejetée, points restitués." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.withdrawal.reject",
      status: "error",
      ...audit,
      errorMessage: message,
      details: { requestId: input.requestId },
    });
    return { ok: false, message };
  }
}

export async function markWithdrawalPaidAction(
  requestId: string,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
  };
  try {
    const target = await requestTarget(requestId);
    await markWithdrawalRequestPaid({ requestId, adminId: session.user.id });
    await writeAuditLog({
      action: "wallet.withdrawal.paid",
      status: "ok",
      ...audit,
      target,
      details: { requestId },
    });
    revalidatePath("/admin/withdrawals");
    revalidatePath("/admin/audit");
    return { ok: true, message: "Demande marquée comme payée." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.withdrawal.paid",
      status: "error",
      ...audit,
      errorMessage: message,
      details: { requestId },
    });
    return { ok: false, message };
  }
}

export async function updateWalletSettingsAction(
  input: unknown,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
  };
  try {
    const parsed = walletSettingsUpdateSchema.parse(input);
    const updated = await updateWalletSettings({
      ...parsed,
      updatedBy: session.user.id,
    });
    await writeAuditLog({
      action: "wallet.settings.update",
      status: "ok",
      ...audit,
      details: {
        currency: updated.currency,
        buyPointsPerUnit: updated.buyPointsPerUnit,
        sellMinorPerPoint: updated.sellMinorPerPoint,
        minWithdrawalPoints: updated.minWithdrawalPoints,
        minStakePoints: updated.minStakePoints,
        maxStakePoints: updated.maxStakePoints,
      },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/wallet");
    revalidatePath("/admin/audit");
    return { ok: true, message: "Tarifs enregistrés." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.settings.update",
      status: "error",
      ...audit,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}
