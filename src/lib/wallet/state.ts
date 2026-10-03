/**
 * Transaction lifecycle — a pure, explicit state machine.
 *
 * The engine consults this before EVERY status change and performs the
 * change under a row lock inside a database transaction, so concurrent
 * webhook + poll + user action can never race a terminal state.
 * Terminal statuses (refunded, reversed) accept no further transition;
 * succeeded only ever moves to a compensating state (never back to
 * pending), so history is append-only.
 */

import {
  CANCELLABLE_STATUSES,
  NON_TERMINAL_STATUSES,
  WALLET_TRANSACTION_STATUSES,
  type WalletTransactionStatus,
} from "./constants";

/**
 * Allowed transitions. Note the deliberate late-success edges
 * (failed/cancelled/expired → succeeded): a provider whose callback
 * arrives after an internal timeout may still settle a deposit. The
 * engine only takes those edges from an AUTHORITATIVE source
 * (verified webhook / provider verification) and never for a
 * withdrawal whose cancellation already reversed its ledger posting —
 * in that case it records a reconciliation issue instead.
 */
const TRANSITIONS: Record<
  WalletTransactionStatus,
  readonly WalletTransactionStatus[]
> = {
  created: ["pending", "processing", "succeeded", "failed", "cancelled", "expired"],
  pending: ["processing", "succeeded", "failed", "cancelled", "expired"],
  processing: ["succeeded", "failed", "cancelled", "expired"],
  succeeded: ["refunded", "reversed"],
  failed: ["succeeded"],
  cancelled: ["succeeded"],
  expired: ["succeeded"],
  refunded: [],
  reversed: [],
};

export function canTransition(
  from: WalletTransactionStatus,
  to: WalletTransactionStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throwing variant used by the engine before touching a row. */
export function assertTransition(
  from: WalletTransactionStatus,
  to: WalletTransactionStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal transaction transition: ${from} → ${to}`);
  }
}

/**
 * Predicates below accept plain `string` because rows read straight
 * from postgres are typed `text` — an unknown value simply fails every
 * membership test instead of blowing up.
 */

/** No further movement possible (refunded / reversed). */
export function isTerminal(status: string): boolean {
  return (TRANSITIONS[status as WalletTransactionStatus] ?? []).length === 0;
}

/** Settled in the user's favour — money has moved, nothing reverses it here. */
export function isSettled(status: string): boolean {
  return status === "succeeded";
}

/** Still awaiting an external outcome (drives pending UI + sweeps). */
export function isPendingState(status: string): boolean {
  return NON_TERMINAL_STATUSES.includes(status as WalletTransactionStatus);
}

/** User-cancelable states (provider cancellation where supported). */
export function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.includes(status as WalletTransactionStatus);
}

/** All statuses, for exhaustive switches and UI filters. */
export function allStatuses(): readonly WalletTransactionStatus[] {
  return WALLET_TRANSACTION_STATUSES;
}
