/**
 * Wallet input validation — provider-agnostic on purpose: the client
 * sends `{ provider, amount, currency }`, never a provider-shaped
 * payload. Amounts are INTEGER MINOR UNITS (`amount`), so no float
 * ever crosses the wire.
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

export const providerIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Invalid provider id");

/**
 * Client-supplied idempotency key — REQUIRED for money movement so a
 * retried request can never open a second transaction.
 */
export const idempotencyKeySchema = z
  .string()
  .min(8, "Idempotency key must be at least 8 characters")
  .max(128, "Idempotency key is too long")
  .regex(/^[A-Za-z0-9_.:-]+$/, "Invalid idempotency key");

export const depositSchema = z.object({
  provider: providerIdSchema,
  amount: amountSchema,
  currency: currencySchema,
  /** Connected provider account to collect from, when the user picked one. */
  providerAccountId: z.string().min(1).max(64).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawalSchema = z.object({
  provider: providerIdSchema,
  amount: amountSchema,
  currency: currencySchema,
  providerAccountId: z.string().min(1).max(64).optional(),
  /** Sanitized payout hint (e.g. the ref of a connected account). */
  destinationRef: z.string().min(1).max(64).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

/** Fee preview before confirmation ("see fees before you confirm"). */
export const quoteSchema = z.object({
  provider: providerIdSchema,
  type: z.enum(["deposit", "withdrawal"]),
  amount: amountSchema,
  currency: currencySchema,
});

export type QuoteInput = z.infer<typeof quoteSchema>;

const ACCOUNT_TYPES = [
  "mobile_money",
  "bank",
  "card",
  "digital_wallet",
  "other",
] as const;

export const connectProviderSchema = z.object({
  /** External identifier: masked phone/account/card-token reference. */
  providerAccountId: z
    .string()
    .min(4)
    .max(64)
    .regex(
      /^\+?[A-Za-z0-9-]{4,64}$/,
      "Invalid account reference",
    ),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  /** Optional user label; masked automatically when omitted. */
  displayName: z.string().trim().min(2).max(48).optional(),
  currency: currencySchema.optional(),
});

export type ConnectProviderInput = z.infer<typeof connectProviderSchema>;

/** POST /api/wallet/accounts — provider id travels with the account. */
export const connectRequestSchema = connectProviderSchema.extend({
  provider: providerIdSchema,
});

export type ConnectRequestInput = z.infer<typeof connectRequestSchema>;

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
  provider: providerIdSchema.optional(),
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
