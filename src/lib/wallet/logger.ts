/**
 * Structured wallet logging — correlation-first, secret-hostile.
 *
 * Every money-relevant event is one JSON line carrying the ids needed
 * to trace: user action → wallet transaction → provider request →
 * provider transaction → webhook → ledger entry.
 *
 * NEVER logged: secrets, tokens, signatures, card data, raw provider
 * payloads. `redact()` walks every field and replaces values whose KEY
 * looks sensitive with "[REDACTED]", truncates long strings and caps
 * array depth so a payload can never be dumped wholesale by accident.
 */

export type WalletLogLevel = "info" | "warn" | "error";

export interface WalletLogFields {
  /** Correlation id — defaults to the transaction id at call sites. */
  correlationId?: string;
  eventType?: string;
  userId?: string;
  walletId?: string;
  transactionId?: string;
  provider?: string;
  providerTransactionId?: string;
  providerEventId?: string;
  status?: string;
  currency?: string;
  amountMinor?: number;
  errorCode?: string;
  durationMs?: number;
  source?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY =
  /(secret|token|password|passphrase|authorization|signature|cookie|cvv|cvc|pan|card_?number|api_?key|credential|private_?key|bearer)/i;

const MAX_STRING = 300;
const MAX_DEPTH = 4;
const MAX_ARRAY = 20;

/** Deep redaction: sensitive keys → [REDACTED], long strings truncated. */
export function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING
      ? `${value.slice(0, MAX_STRING)}…[${value.length} chars]`
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY).map((item) => redact(item, depth + 1));
    return value.length > MAX_ARRAY
      ? [...head, `…${value.length - MAX_ARRAY} more`]
      : head;
  }
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(child, depth + 1);
    }
    return out;
  }
  return "[unloggable]";
}

/**
 * One JSON line per event, prefixed for grepping. Best-effort: a
 * logging failure must never break a money operation.
 */
export function walletLog(
  level: WalletLogLevel,
  event: string,
  fields: WalletLogFields = {},
): void {
  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      scope: "wallet",
      event,
      ...(redact(fields) as Record<string, unknown>),
    });
    console[level](`[wallet] ${line}`);
  } catch {
    console[level](`[wallet] ${event} (log serialization failed)`);
  }
}
