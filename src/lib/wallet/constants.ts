/**
 * Canonical wallet vocabulary — a PURE module (no drizzle, no server
 * imports) so the schema, the engine, the API layer and the browser
 * components all agree on the exact same strings.
 *
 * The database CHECK constraints in `schema/wallet.ts` are built from
 * these arrays, so adding a status here (plus a transition in
 * `state.ts`) is the only place to touch.
 */

/** What kind of movement a wallet transaction is. */
export const WALLET_TRANSACTION_TYPES = [
  "deposit",
  "withdrawal",
  "payment",
  "refund",
  "reversal",
] as const;

export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

/**
 * Explicit lifecycle:
 *
 *   created ─► pending ─► processing ─► succeeded ─► refunded / reversed
 *       └──────────┴──────────┴──► failed / cancelled / expired
 *
 * Only `succeeded` moves money that was waiting on an external party;
 * deposits credit the wallet exclusively at that point (see engine.ts).
 */
export const WALLET_TRANSACTION_STATUSES = [
  "created",
  "pending",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "refunded",
  "reversed",
] as const;

export type WalletTransactionStatus =
  (typeof WALLET_TRANSACTION_STATUSES)[number];

export function isWalletTransactionType(
  value: string,
): value is WalletTransactionType {
  return (WALLET_TRANSACTION_TYPES as readonly string[]).includes(value);
}

export function isWalletTransactionStatus(
  value: string,
): value is WalletTransactionStatus {
  return (WALLET_TRANSACTION_STATUSES as readonly string[]).includes(value);
}

/** Statuses a user may cancel (provider-side cancellation where supported). */
export const CANCELLABLE_STATUSES: readonly WalletTransactionStatus[] = [
  "created",
  "pending",
  "processing",
];

/** Statuses that still await an external outcome (pending-state sweeps). */
export const NON_TERMINAL_STATUSES: readonly WalletTransactionStatus[] = [
  "created",
  "pending",
  "processing",
];
