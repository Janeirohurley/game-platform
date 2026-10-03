/**
 * POST /api/wallet/transactions/[id]/confirm — explicit user
 * confirmation for rails that need one: the engine asks the provider
 * to confirm, then verifies and settles through the normal audited
 * path. Idempotent — confirming a settled deposit changes nothing.
 *
 * The confirmation hint (e.g. a one-time code) is used for the
 * provider call and NEVER persisted.
 */

import { z } from "zod";

import { confirmDepositOperation } from "@/lib/wallet/engine";
import { parseInput, walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

const confirmSchema = z.object({
  confirmation: z.string().trim().min(1).max(64).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireWalletSession(request.headers);
    const { id } = await context.params;

    // Body is optional — an empty confirm is valid for most rails.
    const raw = await request.json().catch(() => ({}));
    const body = parseInput(confirmSchema, raw ?? {});

    const result = await confirmDepositOperation({
      userId: session.user.id,
      transactionId: id,
      confirmation: body.confirmation,
    });
    return walletJson({
      transaction: result.transaction,
      settled: result.settled,
      recognized: result.recognized,
      reason: result.reason ?? null,
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
