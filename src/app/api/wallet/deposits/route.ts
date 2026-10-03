/**
 * POST /api/wallet/deposits — open a deposit.
 *
 * Flow: session → rate limit → validate (integer minor units) →
 * createOperation (idempotent, provider-gated). The response carries
 * the transaction plus its payment instructions; a replayed
 * idempotency key returns the SAME transaction with 200 instead of
 * opening a second one (201 = newly created).
 */

import { createOperation } from "@/lib/wallet/engine";
import {
  parseJsonBody,
  rateLimitResponse,
  walletJson,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { depositLimiter } from "@/lib/wallet/rate-limit";
import { requireWalletSession } from "@/lib/wallet/session";
import { depositSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = depositLimiter.consume(`deposit:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, depositSchema);
    const outcome = await createOperation({
      userId: session.user.id,
      type: "deposit",
      provider: body.provider,
      amountMinor: body.amount,
      currency: body.currency,
      providerAccountId: body.providerAccountId,
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
