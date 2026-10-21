/**
 * Manual points vocabulary — PURE module (no drizzle, no server imports)
 * shared by the schema, the services, the API layer and the browser.
 *
 * Points are an internal currency (see `currencies.ts`): they are
 * credited by an administrator after an off-platform payment and
 * withdrawn through a manual request workflow. No provider, no rail.
 */

/** The single internal currency used for every point balance. */
export const POINTS_CURRENCY = "PTS";

/** Lifecycle of a withdrawal request. */
export const WITHDRAWAL_REQUEST_STATUSES = [
  /** Created by the user; the points are already debited. */
  "pending",
  /** An administrator accepted it; the manual payment is in progress. */
  "approved",
  /** The administrator paid the user outside the app. Terminal. */
  "paid",
  /** Refused; the points are refunded. Terminal. */
  "rejected",
] as const;

export type WithdrawalRequestStatus =
  (typeof WITHDRAWAL_REQUEST_STATUSES)[number];

/** Static, safe-to-interpolate SQL list for CHECK constraints. */
export const WITHDRAWAL_REQUEST_STATUS_SQL = WITHDRAWAL_REQUEST_STATUSES.map(
  (status) => `'${status}'`,
).join(", ");

export function isWithdrawalRequestStatus(
  value: string,
): value is WithdrawalRequestStatus {
  return (WITHDRAWAL_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Statuses from which no further transition is possible. */
export const WITHDRAWAL_REQUEST_TERMINAL_STATUSES: readonly WithdrawalRequestStatus[] =
  ["paid", "rejected"];

/** The single settings row id — the table always holds exactly one row. */
export const WALLET_SETTINGS_ID = "default";

/**
 * Sanity bounds for the configurable tariffs. They keep an admin typo
 * from producing an absurd payout scale; the service validates too.
 */
export const MAX_RATE_VALUE = 1_000_000;
export const MAX_POINTS_AMOUNT = 9_000_000_000_000;
