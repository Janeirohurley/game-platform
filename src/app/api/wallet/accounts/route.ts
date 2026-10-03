/**
 * /api/wallet/accounts — connected provider accounts (a masked
 * phone/account reference the user picked for one-tap deposits).
 *
 *   GET  → list this wallet's accounts; the external ref is MASKED in
 *          every response (the full ref never leaves the database)
 *   POST → connect one (rate-limited; the provider must be
 *          registered, enabled and available)
 */

import {
  connectProviderAccount,
  toPublicAccount,
} from "@/lib/wallet/provider-accounts";
import {
  parseJsonBody,
  rateLimitResponse,
  walletJson,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { connectLimiter } from "@/lib/wallet/rate-limit";
import { listProviderAccountsForUser } from "@/lib/wallet/queries";
import { requireWalletSession } from "@/lib/wallet/session";
import { connectRequestSchema } from "@/lib/validation/wallet";

export async function GET(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);
    const rows = await listProviderAccountsForUser(session.user.id);
    const accounts = rows.map((row) => toPublicAccount(row.provider_accounts));
    return walletJson({ accounts });
  } catch (error) {
    return walletErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const decision = connectLimiter.consume(`connect:${session.user.id}`);
    if (!decision.allowed) return rateLimitResponse(decision);

    const body = await parseJsonBody(request, connectRequestSchema);
    const account = await connectProviderAccount({
      userId: session.user.id,
      provider: body.provider,
      account: {
        providerAccountId: body.providerAccountId,
        accountType: body.accountType,
        displayName: body.displayName,
        currency: body.currency,
      },
    });
    return walletJson({ account: toPublicAccount(account) }, 201);
  } catch (error) {
    return walletErrorResponse(error);
  }
}
