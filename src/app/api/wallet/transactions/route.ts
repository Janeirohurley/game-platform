/**
 * GET /api/wallet/transactions — one page of the user's transactions,
 * newest first, with URL-driven filters (type/status/search).
 * All pagination happens SQL-side; the client only ever sees rows
 * belonging to its own wallets (ownership is in the join itself).
 */

import { listTransactionsForUser } from "@/lib/wallet/queries";
import { parseQuery, walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";
import { transactionFilterSchema } from "@/lib/validation/wallet";

export async function GET(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);
    const filter = parseQuery(request, transactionFilterSchema);
    const result = await listTransactionsForUser(session.user.id, filter);
    return walletJson(result);
  } catch (error) {
    return walletErrorResponse(error);
  }
}
