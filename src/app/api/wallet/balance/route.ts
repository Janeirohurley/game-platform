/**
 * GET /api/wallet/balance — lightweight balance poll (header badge,
 * post-operation refresh). Balance is ALWAYS summed from the ledger
 * at read time — there is no cached balance to go stale.
 */

import { getCurrency } from "@/lib/wallet/currencies";
import { walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { getWalletOverview } from "@/lib/wallet/queries";
import { requireWalletSession } from "@/lib/wallet/session";

export async function GET(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);
    const overview = await getWalletOverview(session.user.id);
    return walletJson({
      walletId: overview.wallet.id,
      currency: overview.wallet.currency,
      balanceMinor: overview.balanceMinor,
      display: getCurrency(overview.wallet.currency),
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
