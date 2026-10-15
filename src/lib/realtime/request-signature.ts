/**
 * Server-to-server request signing.
 *
 * The Colyseus game server (server-games) authenticates its internal
 * calls — match reports, bot pool, match stakes — with a per-request
 * HMAC of the RAW body, keyed by the shared REALTIME_TOKEN_SECRET (the
 * same secret that signs realtime join tokens; one shared secret,
 * several server-side uses). No client ever holds it.
 *
 * The body is signed as exact bytes (no canonicalisation), so callers
 * must verify against the untouched request text.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time compare of an `sha256=<hex>` signature against the body. */
export function verifyRealtimeSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret || secret.length < 16) return false;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signature.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
