/**
 * GET /api/wallet — the wallet overview for the signed-in user:
 * wallet row, balance derived from the ledger, and the currency's
 * display metadata (exponent) so the client never guesses decimals.
 */

import {
  getCurrency,
  normalizeCurrency,
} from "@/lib/wallet/currencies";
import { WalletError } from "@/lib/wallet/errors";
import {
  parseQuery,
  walletErrorResponse,
  walletJson,
} from "@/lib/wallet/http";
import { getWalletOverview } from "@/lib/wallet/queries";
import { requireWalletSession } from "@/lib/wallet/session";
import { z } from "zod";

const overviewQuerySchema = z.object({
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);

    const query = parseQuery(request, overviewQuerySchema);
    let currency: string | undefined;
    if (query.currency) {
      const normalized = normalizeCurrency(query.currency);
      if (!normalized) {
        throw new WalletError("validation", `Unsupported currency: ${query.currency}.`);
      }
      currency = normalized;
    }

    const overview = await getWalletOverview(session.user.id, currency);
    return walletJson({
      wallet: overview.wallet,
      balanceMinor: overview.balanceMinor,
      currency: getCurrency(overview.wallet.currency),
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
