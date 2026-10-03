/**
 * POST /api/wallet/quote — see the EXACT fee breakdown before you
 * confirm. Nothing is created; the quote is computed from the same
 * fee schedule the operation itself will use, so the numbers shown
 * are the numbers that will be charged.
 */

import {
  parseJsonBody,
  walletJson,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { quoteFees } from "@/lib/wallet/provider-config";
import { requireWalletSession } from "@/lib/wallet/session";
import { quoteSchema } from "@/lib/validation/wallet";

export async function POST(request: Request) {
  try {
    await requireWalletSession(request.headers);

    const body = await parseJsonBody(request, quoteSchema);
    const quote = await quoteFees({
      provider: body.provider,
      type: body.type,
      amountMinor: body.amount,
      currency: body.currency,
    });
    return walletJson(quote);
  } catch (error) {
    return walletErrorResponse(error);
  }
}
