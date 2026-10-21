/**
 * GET /api/wallet/transactions/[id] — full detail for the OWNER:
 * the transaction and its double-entry ledger legs (audit trail).
 * Ownership is enforced in the query (wallet join), so someone else's
 * id is a 404.
 */

import { WalletError } from "@/lib/wallet/errors";
import { walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { getTransactionDetailForUser } from "@/lib/wallet/queries";
import { requireWalletSession } from "@/lib/wallet/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireWalletSession(request.headers);
    const { id } = await context.params;

    const detail = await getTransactionDetailForUser(session.user.id, id);
    if (!detail) {
      throw new WalletError("not_found", "Transaction not found.");
    }
    return walletJson(detail);
  } catch (error) {
    return walletErrorResponse(error);
  }
}
