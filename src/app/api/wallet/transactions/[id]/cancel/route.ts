/**
 * POST /api/wallet/transactions/[id]/cancel — cancel a pending
 * operation. Enforces the state machine + row lock inside the engine;
 * a withdrawal whose provider already accepted it is cancelled at the
 * rail FIRST, and its reserved funds are un-reserved with a
 * compensating ledger posting (never a delete).
 */

import { cancelOperation } from "@/lib/wallet/engine";
import { walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireWalletSession(request.headers);
    const { id } = await context.params;

    const transaction = await cancelOperation({
      userId: session.user.id,
      transactionId: id,
    });
    return walletJson({ transaction });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
