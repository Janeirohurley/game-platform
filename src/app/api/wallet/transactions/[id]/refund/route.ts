/**
 * POST /api/wallet/transactions/[id]/refund — full refund of a
 * succeeded deposit. The refund is its OWN transaction with the same
 * double-entry rigor as a withdrawal (wallet debited the original
 * gross), settled only when the provider confirms. Idempotency key
 * required so a retried tap never opens a second refund.
 */

import { z } from "zod";

import { refundDeposit } from "@/lib/wallet/engine";
import { parseJsonBody, walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";
import { idempotencyKeySchema } from "@/lib/validation/wallet";

const refundSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireWalletSession(request.headers);
    const { id } = await context.params;
    const body = await parseJsonBody(request, refundSchema);

    const outcome = await refundDeposit({
      userId: session.user.id,
      transactionId: id,
      idempotencyKey: body.idempotencyKey,
    });
    return walletJson(
      { transaction: outcome.transaction, duplicate: outcome.duplicate },
      outcome.duplicate ? 200 : 201,
    );
  } catch (error) {
    return walletErrorResponse(error);
  }
}
