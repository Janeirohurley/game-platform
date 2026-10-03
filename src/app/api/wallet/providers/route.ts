/**
 * GET /api/wallet/providers — the dynamic provider selection surface.
 *
 * The client NEVER hardcodes a provider: it fetches this list, and
 * every entry already reflects adapter ∩ database configuration
 * (enabled, available, capabilities, currencies, limits, fees). The
 * response exposes no configuration knobs or secrets — only what the
 * UI needs to render "add money" / "withdraw" correctly.
 */

import {
  listEffectiveProviders,
  toPublicProvider,
} from "@/lib/wallet/provider-config";
import { walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

export async function GET(request: Request) {
  try {
    await requireWalletSession(request.headers);

    const providers = (await listEffectiveProviders()).map(toPublicProvider);

    return walletJson({ providers });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
