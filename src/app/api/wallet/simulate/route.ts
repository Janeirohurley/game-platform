/**
 * POST /api/wallet/simulate — DEV/SANDBOX ONLY settlement trigger.
 *
 * Settles an EXISTING transaction by producing a real signed webhook
 * from the sandbox adapter and pushing it through the normal,
 * fully-verified webhook path — the simulation never bypasses
 * signature verification, dedupe or amount cross-checks.
 *
 * Guards:
 *   - requires a session AND ownership of the transaction (admins may
 *     act on any);
 *   - the service refuses anything whose effective environment is not
 *     `sandbox` — production rails have no such hook, so this can
 *     never move real money.
 */

import { z } from "zod";

import { getTransactionRow } from "@/lib/wallet/engine";
import { simulateProviderSettlement } from "@/lib/wallet/events";
import { getWalletById } from "@/lib/wallet/wallet";
import { WalletError } from "@/lib/wallet/errors";
import { parseJsonBody, walletJson, walletErrorResponse } from "@/lib/wallet/http";
import { requireWalletSession } from "@/lib/wallet/session";

const simulateSchema = z.object({
  transactionId: z.string().min(1).max(64),
  outcome: z.enum(["succeeded", "failed"]).default("succeeded"),
});

export async function POST(request: Request) {
  try {
    const session = await requireWalletSession(request.headers);
    const body = await parseJsonBody(request, simulateSchema);

    const row = await getTransactionRow(body.transactionId);
    if (!row) {
      throw new WalletError("not_found", "Transaction not found.");
    }
    const wallet = await getWalletById(row.walletId);
    const isOwner = wallet?.userId === session.user.id;
    if (!isOwner && session.user.role !== "admin") {
      // Same answer as "does not exist" — no existence oracle.
      throw new WalletError("not_found", "Transaction not found.");
    }
    if (!row.provider || !row.providerTransactionId) {
      throw new WalletError(
        "invalid_state",
        "This transaction has not reached the provider yet.",
      );
    }

    const result = await simulateProviderSettlement({
      transactionId: row.id,
      providerId: row.provider,
      providerTransactionId: row.providerTransactionId,
      reference: row.id,
      outcome: body.outcome,
    });
    return walletJson(result);
  } catch (error) {
    return walletErrorResponse(error);
  }
}
