/**
 * /api/wallet/withdrawals — MANUAL payout requests.
 *
 * POST: the points are debited immediately (same transaction as the
 *       request row), so an overdraft race is impossible and the balance
 *       the user sees is always the spendable one.
 * GET : the caller's own request history.
 *
 * No provider, no rail: an administrator pays outside the app and then
 * marks the request as paid.
 */

import {
  createWithdrawalRequest,
  listWithdrawalRequestsForUser,
  withdrawalEstimate,
} from "@/lib/wallet/withdrawal-requests";
import { getWalletSettings } from "@/lib/wallet/settings";
import {
  parseJsonBody,
  rateLimitResponse,
  walletErrorResponse,
  walletJson,
} from "@/lib/wallet/http";
import { withdrawalLimiter } from "@/lib/wallet/rate-limit";
import { requireWalletSession } from "@/lib/wallet/session";
import { withdrawalRequestSchema } from "@/lib/validation/wallet";

export async function GET(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);
    const rows = await listWithdrawalRequestsForUser(session.user.id);
    return walletJson({ requests: rows });
  } catch (error) {
    return walletErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = withdrawalLimiter.consume(`withdrawal:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, withdrawalRequestSchema);
    const settings = await getWalletSettings();
    const result = await createWithdrawalRequest({
      userId: session.user.id,
      points: body.points,
      userNote: body.note ?? null,
      idempotencyKey: body.idempotencyKey,
    });

    return walletJson(
      {
        request: result.request,
        balanceMinor: result.balanceMinor,
        duplicate: result.duplicate,
        estimate: withdrawalEstimate(settings, result.request.amountMinor),
      },
      result.duplicate ? 200 : 201,
    );
  } catch (error) {
    return walletErrorResponse(error);
  }
}
