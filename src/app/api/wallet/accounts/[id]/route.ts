/**
 * DELETE /api/wallet/accounts/[id] — disconnect an account. Status
 * flip, never a delete: transactions that reference the account must
 * stay readable forever. Ownership is re-verified server-side.
 */

import {
  disconnectProviderAccount,
  toPublicAccount,
} from "@/lib/wallet/provider-accounts";
import { walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireWalletSession(request.headers);
    const { id } = await context.params;

    const account = await disconnectProviderAccount({
      userId: session.user.id,
      accountRowId: id,
    });
    return walletJson({ account: toPublicAccount(account) });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
