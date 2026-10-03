/**
 * POST /api/wallet/webhooks/[provider] — the provider→platform
 * settlement entry point.
 *
 * Security model:
 *   - raw body is read FIRST (the HMAC covers the exact bytes);
 *   - signature verification is owned by the ADAPTER (each provider
 *     has its own scheme) and runs before anything is parsed;
 *   - rate limited per IP (delivery-retry friendly, abuse-braked);
 *   - dedupe is database-side: (provider, provider_event_id) unique,
 *     inserted in the SAME transaction as the settlement, so a
 *     redelivered event can never double-credit;
 *   - amounts/currency are cross-checked against our own transaction
 *     before any money moves (a lying webhook writes a reconciliation
 *     issue, not a balance).
 *
 * No session — this is server-to-server. 401 = bad signature,
 * 404 = unknown provider endpoint. Response is always fast and safe
 * to acknowledge (processed / duplicate / ignored / unresolved).
 */

import { processProviderWebhook } from "@/lib/wallet/events";
import {
  clientIp,
  rateLimitResponse,
  walletErrorResponse,
} from "@/lib/wallet/http";
import { webhookLimiter } from "@/lib/wallet/rate-limit";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(request: Request, context: RouteContext) {
  // Raw bytes first — verification happens on exactly what was signed.
  const rawBody = await request.text();
  const { provider } = await context.params;

  const decision = webhookLimiter.consume(`webhook:${provider}:${clientIp(request)}`);
  if (!decision.allowed) return rateLimitResponse(decision);

  try {
    const result = await processProviderWebhook({
      providerId: provider,
      rawBody,
      headers: request.headers,
    });
    return NextResponse.json(
      { received: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return walletErrorResponse(error);
  }
}
