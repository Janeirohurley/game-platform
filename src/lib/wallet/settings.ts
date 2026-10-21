/**
 * Tariff service — the single `wallet_settings` row.
 *
 * Tariffs are DATA, never hard-coded: the administrator changes the buy
 * rate, the withdrawal rate and the stake bounds from the console and
 * every screen reads them back from here.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { walletSettings } from "@/lib/db/schema/points";
import { WalletError } from "./errors";
import {
  MAX_POINTS_AMOUNT,
  MAX_RATE_VALUE,
  WALLET_SETTINGS_ID,
} from "./points-types";

export const DEFAULT_SETTINGS = {
  id: WALLET_SETTINGS_ID,
  currency: "BIF",
  buyPointsPerUnit: 100,
  sellMinorPerPoint: 10,
  minWithdrawalPoints: 1000,
  minStakePoints: 10,
  maxStakePoints: 100_000,
  contactInstructions: "",
} as const;

export type WalletSettingsRow = typeof walletSettings.$inferSelect;

function requirePositiveInt(value: unknown, field: string, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > max
  ) {
    throw new WalletError("validation", `${field} must be an integer in 1..${max}.`);
  }
  return value;
}

function requireCurrency(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Z]{3}$/.test(value)) {
    throw new WalletError("validation", "currency must be a 3-letter code.");
  }
  return value;
}

/** Read the settings row, creating it with sane defaults on first use. */
export async function getWalletSettings(): Promise<WalletSettingsRow> {
  const existing = await db
    .select()
    .from(walletSettings)
    .where(eq(walletSettings.id, WALLET_SETTINGS_ID))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await db
    .insert(walletSettings)
    .values({ ...DEFAULT_SETTINGS })
    .onConflictDoNothing({ target: walletSettings.id })
    .returning();
  if (inserted[0]) return inserted[0];

  const raced = await db
    .select()
    .from(walletSettings)
    .where(eq(walletSettings.id, WALLET_SETTINGS_ID))
    .limit(1);
  if (!raced[0]) {
    throw new WalletError("internal", "Wallet settings row is missing.");
  }
  return raced[0];
}

export interface UpdateWalletSettingsInput {
  currency: string;
  buyPointsPerUnit: number;
  sellMinorPerPoint: number;
  minWithdrawalPoints: number;
  minStakePoints: number;
  maxStakePoints: number;
  contactInstructions: string;
  updatedBy: string;
}

/** Validate then persist the tariff row (admin only — caller authorizes). */
export async function updateWalletSettings(
  input: UpdateWalletSettingsInput,
): Promise<WalletSettingsRow> {
  const currency = requireCurrency(input.currency.toUpperCase());
  const buyPointsPerUnit = requirePositiveInt(
    input.buyPointsPerUnit,
    "buyPointsPerUnit",
    MAX_RATE_VALUE,
  );
  const sellMinorPerPoint = requirePositiveInt(
    input.sellMinorPerPoint,
    "sellMinorPerPoint",
    MAX_RATE_VALUE,
  );
  const minWithdrawalPoints = requirePositiveInt(
    input.minWithdrawalPoints,
    "minWithdrawalPoints",
    MAX_POINTS_AMOUNT,
  );
  const minStakePoints = requirePositiveInt(
    input.minStakePoints,
    "minStakePoints",
    MAX_POINTS_AMOUNT,
  );
  const maxStakePoints = requirePositiveInt(
    input.maxStakePoints,
    "maxStakePoints",
    MAX_POINTS_AMOUNT,
  );
  if (maxStakePoints < minStakePoints) {
    throw new WalletError(
      "validation",
      "maxStakePoints must be greater than or equal to minStakePoints.",
    );
  }

  await getWalletSettings();

  const updated = await db
    .update(walletSettings)
    .set({
      currency,
      buyPointsPerUnit,
      sellMinorPerPoint,
      minWithdrawalPoints,
      minStakePoints,
      maxStakePoints,
      contactInstructions: input.contactInstructions.trim(),
      updatedBy: input.updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(walletSettings.id, WALLET_SETTINGS_ID))
    .returning();

  if (!updated[0]) {
    throw new WalletError("internal", "Wallet settings row is missing.");
  }
  return updated[0];
}

/**
 * Estimated payout for `points`, in `currency` MINOR units. Integer
 * arithmetic only — no floating-point money.
 */
export function estimateWithdrawalMinor(
  settings: Pick<WalletSettingsRow, "sellMinorPerPoint">,
  points: number,
): number {
  if (!Number.isSafeInteger(points) || points <= 0) {
    throw new WalletError("validation", "points must be a positive integer.");
  }
  const amount = settings.sellMinorPerPoint * points;
  if (!Number.isSafeInteger(amount) || amount > Number.MAX_SAFE_INTEGER) {
    throw new WalletError("validation", "The estimated amount is out of range.");
  }
  return amount;
}
