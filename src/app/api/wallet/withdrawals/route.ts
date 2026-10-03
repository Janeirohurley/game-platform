/**
 * POST /api/wallet/withdrawals — open a withdrawal.
 *
 * Funds are RESERVED (debited under a wallet row lock) in the same
 * database transaction that creates the row — an overdraft race is
 * impossible. Provider rejection / cancel / expiry posts the inverse
 * posting; success simply completes against the reserve.
 */

import { createOperation } from "@/lib/wallet/engine";
import {
  parseJsonBody,
  rateLimitResponse,
  walletJson,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { withdrawalLimiter } from "@/lib/wallet/rate-limit";
import { requireWalletSession } from "@/lib/wallet/session";
import { withdrawalSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = withdrawalLimiter.consume(`withdrawal:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, withdrawalSchema);
    const outcome = await createOperation({
      userId: session.user.id,
      type: "withdrawal",
      provider: body.provider,
      amountMinor: body.amount,
      currency: body.currency,
      providerAccountId: body.providerAccountId,
      destinationRef: body.destinationRef,
      idempotencyKey: body.idempotencyKey,
    });

    return walletJson(
      {
        transaction: outcome.transaction,
        duplicate: outcome.duplicate,
      },
      outcome.duplicate ? 200 : 201,
    );
  } catch (error) {
    return walletErrorResponse(error);
  }
}
