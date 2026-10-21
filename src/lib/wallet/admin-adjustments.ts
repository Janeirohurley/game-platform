/**
 * Administrator point adjustments — the ONLY path that moves a user's
 * points on their behalf. Every adjustment carries a MANDATORY reason,
 * is posted as a `wallet_transactions` row of type `adjustment`, and is
 * mirrored into `admin_audit_log` by the calling server action.
 *
 * The engine enforces the invariants: integer amount, one currency,
 * wallet locked `FOR UPDATE`, and no overdraft on a debit.
 */

import { randomUUID } from "node:crypto";

import { getBalanceMinor, manualCreditPosting, manualDebitPosting } from "./ledger";
import { postInternalMovement } from "./engine";
import { ensureWallet } from "./wallet";
import { WalletError } from "./errors";
import { POINTS_CURRENCY } from "./points-types";

export interface AdjustPointsInput {
  targetUserId: string;
  /** Positive integer magnitude, in points. */
  amountMinor: number;
  direction: "credit" | "debit";
  /** Mandatory, human-readable justification. */
  reason: string;
  adminId: string;
  /** Optional caller key; generated when absent. */
  idempotencyKey?: string;
}

export interface AdjustPointsResult {
  transactionId: string;
  walletId: string;
  balanceMinor: number;
  duplicate: boolean;
}

export async function adjustUserPoints(
  input: AdjustPointsInput,
): Promise<AdjustPointsResult> {
  const reason = input.reason.trim();
  if (!reason) {
    throw new WalletError("validation", "A reason is required.");
  }
  if (
    typeof input.amountMinor !== "number" ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0
  ) {
    throw new WalletError(
      "validation",
      "amountMinor must be a positive integer.",
    );
  }
  if (input.direction !== "credit" && input.direction !== "debit") {
    throw new WalletError("validation", "direction must be credit or debit.");
  }

  const wallet = await ensureWallet(input.targetUserId, POINTS_CURRENCY);
  const posting =
    input.direction === "credit"
      ? manualCreditPosting({ walletId: wallet.id, amountMinor: input.amountMinor })
      : manualDebitPosting({ walletId: wallet.id, amountMinor: input.amountMinor });

  const outcome = await postInternalMovement({
    type: "adjustment",
    walletId: wallet.id,
    currency: POINTS_CURRENCY,
    posting,
    idempotencyKey:
      input.idempotencyKey ?? `adjustment:${wallet.id}:${randomUUID()}`,
    metadata: {
      reason,
      adminId: input.adminId,
      direction: input.direction,
    },
  });

  return {
    transactionId: outcome.transaction.id,
    walletId: wallet.id,
    balanceMinor: await getBalanceMinor(wallet.id),
    duplicate: outcome.duplicate,
  };
}
