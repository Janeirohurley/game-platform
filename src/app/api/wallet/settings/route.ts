/**
 * GET /api/wallet/settings — the public tariff surface.
 *
 * Exposes only what a player needs: the two rates, the withdrawal
 * minimum, the stake bounds and the "buy points" contact instructions.
 * `updatedBy` and other admin metadata never leave the server.
 */

import { getWalletSettings } from "@/lib/wallet/settings";
import { POINTS_CURRENCY } from "@/lib/wallet/points-types";
import { walletErrorResponse, walletJson } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

export async function GET(request: Request) {
  try {
    await requireWalletSession(request.headers);
    const settings = await getWalletSettings();
    return walletJson({
      settings: {
        pointsCurrency: POINTS_CURRENCY,
        currency: settings.currency,
        buyPointsPerUnit: settings.buyPointsPerUnit,
        sellMinorPerPoint: settings.sellMinorPerPoint,
        minWithdrawalPoints: settings.minWithdrawalPoints,
        minStakePoints: settings.minStakePoints,
        maxStakePoints: settings.maxStakePoints,
        contactInstructions: settings.contactInstructions,
      },
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
