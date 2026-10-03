/**
 * The payment provider contract — the ONLY thing the wallet core knows
 * about external money rails.
 *
 * An adapter implements `PaymentProvider` and translates between this
 * provider-agnostic vocabulary and one provider's API. The wallet
 * engine never sees a provider payload, a provider URL or a provider
 * status string: it sees capabilities, normalized results and
 * normalized webhook events.
 *
 * Rules for every adapter:
 *  - declare capabilities honestly (the wallet rejects operations the
 *    adapter does not declare, BEFORE calling it);
 *  - never store secrets in inputs/outputs/metadata — credentials come
 *    from the environment;
 *  - sanitize anything user-facing (`instructions`, `metadata`,
 *    `failureReason`) before returning it;
 *  - translate webhooks into `NormalizedProviderEvent` — provider
 *    payload shapes must never leak past `handleWebhook`.
 */

import type { WalletTransactionType } from "../constants";

// ---------------------------------------------------------------------------
// Capabilities — explicit, declared, intersected with configuration.
// ---------------------------------------------------------------------------

export const PROVIDER_CAPABILITIES = [
  "DEPOSIT",
  "WITHDRAWAL",
  "REFUND",
  "PAYMENT",
  "TRANSFER",
  "WEBHOOK",
  "BALANCE_CHECK",
  "TRANSACTION_STATUS",
  /**
   * Optional extra: the adapter can LIST its own transactions for a
   * time range, which powers reconciliation's "missing on either side"
   * detection. Adapters without it still get ledger-side checks.
   */
  "RECONCILIATION",
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export function isProviderCapability(value: string): value is ProviderCapability {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}

export type ProviderEnvironment = "sandbox" | "production";

export interface ProviderInfo {
  /** Stable registry id ("sandbox-momo"). */
  id: string;
  name: string;
  description?: string;
  environment: ProviderEnvironment;
  capabilities: readonly ProviderCapability[];
  supportedCurrencies: readonly string[];
  supportedCountries?: readonly string[];
}

// ---------------------------------------------------------------------------
// Normalized statuses — the provider vocabulary AFTER adapter mapping.
// ---------------------------------------------------------------------------

export type ProviderTransactionStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type ProviderEventType =
  | "deposit.succeeded"
  | "deposit.failed"
  | "deposit.expired"
  | "deposit.processing"
  | "withdrawal.succeeded"
  | "withdrawal.failed"
  | "withdrawal.reversed"
  | "withdrawal.expired"
  | "refund.succeeded"
  | "refund.failed"
  | "unknown";

/**
 * The single shape a webhook may become. Adapters produce this from
 * whatever their provider sends; the engine consumes ONLY this.
 */
export interface NormalizedProviderEvent {
  /** Provider-assigned event id — the global dedupe key. */
  providerEventId: string;
  type: ProviderEventType;
  status: ProviderTransactionStatus | "reversed";
  /** External transaction id, when the payload carries one. */
  providerTransactionId?: string;
  /** Our internal reference, when the provider echoes it back. */
  reference?: string;
  amountMinor?: number;
  currency?: string;
  /** ISO-8601 timestamp assigned by the provider. */
  occurredAt: string;
  /** Sanitized human-readable failure summary, when failed. */
  failureReason?: string;
  /** Sanitized, provider-specific extras for the event log only. */
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Inputs / outputs
// ---------------------------------------------------------------------------

export interface ProviderCreateDepositInput {
  /** Internal transaction id — echoed by the provider in callbacks. */
  reference: string;
  /** Our idempotency key — the provider must dedupe on it too. */
  idempotencyKey: string;
  /** Gross amount credited to the wallet on success (minor units). */
  amountMinor: number;
  /** What the rail should actually collect (gross + explicit fees). */
  totalToCollectMinor: number;
  currency: string;
  /** Connected provider account to collect from, when the user picked one. */
  providerAccountId?: string | null;
  expiresInSeconds?: number;
}

export interface ProviderCreateWithdrawalInput {
  reference: string;
  idempotencyKey: string;
  /** Gross amount the beneficiary should receive (minor units). */
  amountMinor: number;
  /** What the wallet debits (gross + explicit fees). */
  totalToDebitMinor: number;
  currency: string;
  /** Connected provider account (payout target), when picked. */
  providerAccountId?: string | null;
  /** Sanitized payout hint (e.g. masked phone number). */
  destinationRef?: string;
  expiresInSeconds?: number;
}

export interface ProviderOperationResult {
  providerTransactionId: string;
  status: ProviderTransactionStatus;
  /** Provider-side expiry (ISO-8601), when it assigns one. */
  expiresAt?: string;
  /** Sanitized, user-facing next step ("Dial *123#…"). */
  instructions?: string;
  /** Provider-hosted page, when the rail has one. */
  paymentUrl?: string;
  /** Sanitized extras safe to persist on the transaction. */
  metadata?: Record<string, unknown>;
}

export interface ProviderConfirmDepositInput {
  reference: string;
  providerTransactionId: string;
  /** Whatever the provider requires (OTP token…), never persisted raw. */
  confirmation?: string;
}

export interface ProviderCancelInput {
  reference: string;
  providerTransactionId: string;
}

export interface ProviderStatusInput {
  providerTransactionId: string;
  reference?: string;
  currency?: string;
}

export interface ProviderStatusResult {
  status: ProviderTransactionStatus;
  amountMinor?: number;
  currency?: string;
  /** Provider-side last update (ISO-8601). */
  occurredAt?: string;
  failureReason?: string;
}

export interface ProviderVerificationResult extends ProviderStatusResult {
  /** False = the provider does NOT recognize the transaction at all. */
  verified: boolean;
}

export interface ProviderRefundInput {
  /** Internal id of the ORIGINAL transaction (our correlation). */
  reference: string;
  providerTransactionId: string;
  /** Full refund only — partial refunds are a future domain decision. */
  amountMinor: number;
  currency: string;
  reason?: string;
}

export interface ProviderBalanceInput {
  currency: string;
  providerAccountId?: string | null;
}

export interface ProviderBalanceResult {
  balanceMinor: number;
  currency: string;
}

export interface ProviderListRange {
  from: Date;
  to: Date;
}

export interface ProviderListedTransaction {
  providerTransactionId: string;
  reference?: string;
  walletType: WalletTransactionType;
  status: ProviderTransactionStatus;
  amountMinor: number;
  currency: string;
  occurredAt: string;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface ProviderWebhookInput {
  /** Exact bytes of the request body (signature computed over them). */
  rawBody: string;
  headers: Headers;
}

export interface ProviderWebhookResult {
  /** Signature + payload verification outcome. */
  valid: boolean;
  /** Normalized event — present only when valid AND understood. */
  event?: NormalizedProviderEvent;
  /** Safe, sanitized reason (never the payload itself). */
  reason?: string;
}

/**
 * Sandbox-only test hook (never implemented by production adapters):
 * builds a SIGNED webhook body for a transaction so dev tools and
 * tests can settle a payment through the real, signature-verified
 * webhook path instead of bypassing it.
 */
export interface ProviderSimulateInput {
  reference: string;
  providerTransactionId: string;
  outcome: "succeeded" | "failed";
}

// ---------------------------------------------------------------------------
// The contract
// ---------------------------------------------------------------------------

export interface PaymentProvider {
  getProviderInfo(): ProviderInfo;
  /** Adapter-side availability (credentials configured, API reachable…). */
  checkAvailability(): Promise<{ available: boolean; reason?: string }>;

  getAccountBalance(
    input: ProviderBalanceInput,
  ): Promise<ProviderBalanceResult>;

  createDeposit(
    input: ProviderCreateDepositInput,
  ): Promise<ProviderOperationResult>;
  confirmDeposit(
    input: ProviderConfirmDepositInput,
  ): Promise<ProviderOperationResult>;

  createWithdrawal(
    input: ProviderCreateWithdrawalInput,
  ): Promise<ProviderOperationResult>;
  cancelWithdrawal(
    input: ProviderCancelInput,
  ): Promise<ProviderOperationResult>;

  getTransactionStatus(
    input: ProviderStatusInput,
  ): Promise<ProviderStatusResult>;
  /** Authoritative server-to-server check (used when no webhook arrived). */
  verifyTransaction(
    input: ProviderStatusInput,
  ): Promise<ProviderVerificationResult>;

  handleWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookResult>;

  refundTransaction(input: ProviderRefundInput): Promise<ProviderOperationResult>;

  /** RECONCILIATION capability — list provider-side transactions. */
  listTransactions?(range: ProviderListRange): Promise<ProviderListedTransaction[]>;

  /** Sandbox test hook — see ProviderSimulateInput. */
  simulateSettlement?(input: ProviderSimulateInput): Promise<ProviderWebhookInput>;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type ProviderErrorCode =
  | "capability_not_supported"
  | "unavailable"
  | "timeout"
  | "verification_failed"
  | "invalid_request"
  | "not_found"
  | "provider_error";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  /** Whether a retry could plausibly succeed (drives engine UX). */
  readonly retryable: boolean;

  constructor(
    code: ProviderErrorCode,
    message: string,
    options?: { retryable?: boolean; cause?: unknown },
  ) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.retryable =
      options?.retryable ??
      (code === "timeout" || code === "provider_error" || code === "unavailable");
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}
