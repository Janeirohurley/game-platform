/**
 * Wallet input validation — internal points only: the client sends
 * `{ amount/points, currency }`, never a provider-shaped payload.
 * Amounts are INTEGER MINOR UNITS, so no float ever crosses the wire.
 *
 * Absent from every schema BY DESIGN: status, fees, balances, ledger
 * fields — those are server-owned and structurally unreachable from a
 * client payload.
 */

import { z } from "zod";

import { isGameId } from "@/lib/games/registry";
import { MAX_AMOUNT_MINOR } from "@/lib/wallet/money";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/wallet/currencies";
import {
  WALLET_TRANSACTION_STATUSES,
  WALLET_TRANSACTION_TYPES,
} from "@/lib/wallet/constants";

/** Integer minor units — the only amount representation on the wire. */
export const amountSchema = z
  .number()
  .int("Amount must be an integer of minor units")
  .positive("Amount must be positive")
  .max(MAX_AMOUNT_MINOR, "Amount is too large");

export const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter ISO-4217 code")
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => (SUPPORTED_CURRENCY_CODES as readonly string[]).includes(value),
    "Unsupported currency",
  );

/**
 * Client-supplied idempotency key — REQUIRED for money movement so a
 * retried request can never open a second transaction.
 */
export const idempotencyKeySchema = z
  .string()
  .min(8, "Idempotency key must be at least 8 characters")
  .max(128, "Idempotency key is too long")
  .regex(/^[A-Za-z0-9_.:-]+$/, "Invalid idempotency key");

/** Transaction list filters (user + admin read models). */
export const transactionFilterSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  type: z
    .enum(WALLET_TRANSACTION_TYPES)
    .optional(),
  status: z
    .enum(WALLET_TRANSACTION_STATUSES)
    .optional(),
  currency: currencySchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export type TransactionFilter = z.infer<typeof transactionFilterSchema>;

/** A seat's hold on a match stake (POST /api/wallet/games/hold). */
export const stakeHoldSchema = z.object({
  roomId: z.string().min(1).max(64),
  amountMinor: amountSchema,
  currency: currencySchema,
  idempotencyKey: idempotencyKeySchema,
});

export type StakeHoldInput = z.infer<typeof stakeHoldSchema>;

/** Releasing one's own seat before the match starts (cancel route body). */
export const stakeCancelSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
});

export type StakeCancelInput = z.infer<typeof stakeCancelSchema>;

/** Room → platform: open a match stake (POST /api/internal/match-stakes). */
export const matchStakeCreateSchema = z.object({
  roomId: z.string().min(1).max(64),
  gameId: z.string().refine(isGameId, "Unknown game id"),
  currency: currencySchema,
  stakeMinor: amountSchema,
  rakeBps: z.number().int().min(0).max(10_000).optional(),
});

export type MatchStakeCreateInput = z.infer<typeof matchStakeCreateSchema>;

// ---------------------------------------------------------------------------
// Manual points — the provider-free replacement surface.
// ---------------------------------------------------------------------------

/** POST /api/wallet/withdrawals — request a manual payout. */
export const withdrawalRequestSchema = z.object({
  points: amountSchema,
  note: z.string().trim().max(240).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type WithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;

/** Admin manual credit/debit (mandatory reason). */
export const adminAdjustPointsSchema = z.object({
  targetUserId: z.string().min(1).max(64),
  amount: amountSchema,
  direction: z.enum(["credit", "debit"]),
  reason: z
    .string()
    .trim()
    .min(3, "A reason is required")
    .max(240, "Reason is too long"),
});

export type AdminAdjustPointsInput = z.infer<typeof adminAdjustPointsSchema>;

/** Admin tariff update. */
export const walletSettingsUpdateSchema = z.object({
  currency: currencySchema,
  buyPointsPerUnit: z.number().int().positive().max(1_000_000),
  sellMinorPerPoint: z.number().int().positive().max(1_000_000),
  minWithdrawalPoints: amountSchema,
  minStakePoints: amountSchema,
  maxStakePoints: amountSchema,
  contactInstructions: z.string().trim().max(2000),
});

export type WalletSettingsUpdateInput = z.infer<
  typeof walletSettingsUpdateSchema
>;

/** Admin withdrawal decision (rejection reason is mandatory). */
export const withdrawalDecisionSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});

