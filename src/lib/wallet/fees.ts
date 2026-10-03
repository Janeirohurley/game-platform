/**
 * Fee computation — explicit, integer, never hidden inside an amount.
 *
 *   Requested amount: 10,000 BIF
 *   Provider fee:       500 BIF   (providerBps or providerFixedMinor)
 *   Platform fee:       200 BIF   (platformBps or platformFixedMinor)
 *   Total:           10,700 BIF
 *
 * All math runs in BigInt (basis points of the gross amount + fixed
 * minor-unit components, rounded half-up) and the result is validated
 * back into a safe integer. Fee schedules come from the provider
 * configuration (provider_configs.fees) — zero fees by default.
 */

import { MAX_AMOUNT_MINOR, MoneyError } from "./money";

export interface FeeSchedule {
  /** Basis points (1 bps = 0.01%) of the gross amount. */
  platformBps?: number;
  providerBps?: number;
  /** Fixed components in integer minor units. */
  platformFixedMinor?: number;
  providerFixedMinor?: number;
}

export interface FeeBreakdown {
  providerFee: number;
  platformFee: number;
  totalFee: number;
}

const BPS_DIVISOR = BigInt(10_000);

function requireNonNegativeInt(value: unknown, field: string): bigint {
  if (value === undefined || value === null) return BigInt(0);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new MoneyError(`Invalid fee schedule field: ${field}`);
  }
  return BigInt(value);
}

/**
 * Validate a fee schedule coming from JSON config. Unknown fields are
 * ignored (forward-compatible), invalid values throw — a corrupted
 * config must never silently price money.
 */
export function parseFeeSchedule(raw: unknown): FeeSchedule {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new MoneyError("Invalid fee schedule");
  }
  const record = raw as Record<string, unknown>;
  const schedule: FeeSchedule = {};
  const bps = requireNonNegativeInt(record.platformBps, "platformBps");
  const providerBps = requireNonNegativeInt(record.providerBps, "providerBps");
  const platformFixed = requireNonNegativeInt(
    record.platformFixedMinor,
    "platformFixedMinor",
  );
  const providerFixed = requireNonNegativeInt(
    record.providerFixedMinor,
    "providerFixedMinor",
  );
  if (bps > BigInt(10_000) || providerBps > BigInt(10_000)) {
    throw new MoneyError("Fee schedule bps out of range (max 10000)");
  }
  if (record.platformBps !== undefined && record.platformBps !== null) {
    schedule.platformBps = Number(bps);
  }
  if (record.providerBps !== undefined && record.providerBps !== null) {
    schedule.providerBps = Number(providerBps);
  }
  if (
    record.platformFixedMinor !== undefined &&
    record.platformFixedMinor !== null
  ) {
    schedule.platformFixedMinor = Number(platformFixed);
  }
  if (
    record.providerFixedMinor !== undefined &&
    record.providerFixedMinor !== null
  ) {
    schedule.providerFixedMinor = Number(providerFixed);
  }
  return schedule;
}

/** amount * bps / 10000, rounded half-up, in BigInt. */
function bpsOf(amount: bigint, bps: bigint): bigint {
  const product = amount * bps;
  return (product + BPS_DIVISOR / BigInt(2)) / BPS_DIVISOR;
}

/**
 * Compute the explicit fee breakdown for an amount. Never throws for
 * "too big" totals beyond the shared safe-integer guard — callers
 * validate the amount first via money.ts.
 */
export function computeFees(
  amountMinor: number,
  schedule: FeeSchedule | null | undefined,
): FeeBreakdown {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new MoneyError("Amount must be a positive integer of minor units");
  }
  const s = schedule ?? {};
  const amount = BigInt(amountMinor);

  const providerFee =
    bpsOf(amount, requireNonNegativeInt(s.providerBps, "providerBps")) +
    requireNonNegativeInt(s.providerFixedMinor, "providerFixedMinor");
  const platformFee =
    bpsOf(amount, requireNonNegativeInt(s.platformBps, "platformBps")) +
    requireNonNegativeInt(s.platformFixedMinor, "platformFixedMinor");

  const total = providerFee + platformFee;
  if (total > BigInt(MAX_AMOUNT_MINOR) || amount > BigInt(MAX_AMOUNT_MINOR)) {
    throw new MoneyError("Fee computation out of range");
  }

  return {
    providerFee: Number(providerFee),
    platformFee: Number(platformFee),
    totalFee: Number(total),
  };
}
