/**
 * Sandbox Mobile Money — the REFERENCE provider adapter.
 *
 * It behaves like a real asynchronous mobile-money API without needing
 * real credentials:
 *  - creates pending operations with provider-side ids and expiry,
 *  - settles them through an HMAC-SHA256-signed webhook that the wallet
 *    verifies exactly like a production rail would,
 *  - exposes status/verification/listing for polling and reconciliation,
 *  - is idempotent on the idempotency key it is given.
 *
 * Everything provider-specific lives in THIS file: payload shapes,
 * signature header, status vocabulary ("successful" vs "succeeded"),
 * in-memory provider state. The wallet core only ever sees the
 * contract in ./types.ts. A production adapter replaces the internals
 * below and registers the same way (see providers/index.ts).
 *
 * State note: like many sandbox SDKs, provider-side records live in
 * process memory (per instance). That is a sandbox limitation, not an
 * architectural one — a real adapter keeps state at the provider and
 * reads it back over HTTP.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { BasePaymentProvider } from "./base";
import { ProviderError } from "./types";
import type {
  PaymentProvider,
  ProviderBalanceInput,
  ProviderBalanceResult,
  ProviderCancelInput,
  ProviderConfirmDepositInput,
  ProviderCreateDepositInput,
  ProviderCreateWithdrawalInput,
  ProviderInfo,
  ProviderListRange,
  ProviderListedTransaction,
  ProviderOperationResult,
  ProviderRefundInput,
  ProviderStatusInput,
  ProviderStatusResult,
  ProviderVerificationResult,
  ProviderWebhookInput,
  ProviderWebhookResult,
  ProviderTransactionStatus,
  ProviderEventType,
} from "./types";

export const SANDBOX_MOMO_ID = "sandbox-momo";

/** Webhook signature header (provider-specific by design). */
export const SANDBOX_MOMO_SIGNATURE_HEADER = "x-sandbox-momo-signature";

/** Credentials come from the environment — never from the database. */
const SECRET_ENV = "SANDBOX_MOMO_WEBHOOK_SECRET";
/** Optional artificial latency, in ms (timeout-path demos/tests). */
const LATENCY_ENV = "SANDBOX_MOMO_LATENCY_MS";

const SUPPORTED_CURRENCIES = ["BIF", "RWF", "TZS", "KES", "UGX", "USD"];
const DEFAULT_EXPIRY_SECONDS = 900;

/** Provider-side status vocabulary — deliberately NOT the internal one. */
type SandboxStatus =
  | "processing"
  | "successful"
  | "failed"
  | "expired"
  | "cancelled"
  | "reversed";

type SandboxOperation = "deposit" | "withdrawal" | "refund";

const STATUS_TO_INTERNAL: Record<
  SandboxStatus,
  ProviderTransactionStatus | "reversed"
> = {
  processing: "processing",
  successful: "succeeded",
  failed: "failed",
  expired: "expired",
  cancelled: "cancelled",
  reversed: "reversed",
};

interface SandboxRecord {
  providerTransactionId: string;
  /** Internal correlation (our transaction id, or tx:refund suffix). */
  reference: string;
  idempotencyKey: string;
  operation: SandboxOperation;
  /** Principal the provider moved (gross for both directions). */
  grossAmountMinor: number;
  /** Deposit: what the rail collects (gross + fees). */
  railAmountMinor: number;
  currency: string;
  status: SandboxStatus;
  failureReason?: string;
  createdAt: number;
  expiresAt: number;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Strip control chars and cap length — safe to show/log. */
function safeText(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

function getSecret(): string | null {
  const secret = process.env[SECRET_ENV];
  return secret && secret.length >= 16 ? secret : null;
}

/** HMAC-SHA256 hex over the exact body bytes ("sha256=<hex>" header). */
export function signSandboxWebhook(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export class SandboxMobileMoneyProvider extends BasePaymentProvider {
  /** providerTransactionId → provider-side record (sandbox "API"). */
  private readonly records = new Map<string, SandboxRecord>();
  /** Provider-side idempotency: same key + operation → same record. */
  private readonly byIdempotency = new Map<string, string>();

  getProviderInfo(): ProviderInfo {
    return {
      id: SANDBOX_MOMO_ID,
      name: "Sandbox Mobile Money",
      description:
        "Reference mobile-money rail — full async lifecycle with signed webhooks, no real money.",
      environment: "sandbox",
      capabilities: [
        "DEPOSIT",
        "WITHDRAWAL",
        "REFUND",
        "WEBHOOK",
        "BALANCE_CHECK",
        "TRANSACTION_STATUS",
        "RECONCILIATION",
      ],
      supportedCurrencies: SUPPORTED_CURRENCIES,
      supportedCountries: ["BI", "RW", "TZ", "KE", "UG"],
    };
  }

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    if (!getSecret()) {
      return {
        available: false,
        reason: `${SECRET_ENV} is not configured (min 16 characters)`,
      };
    }
    return { available: true };
  }

  // -----------------------------------------------------------------------
  // Sandbox "API" internals
  // -----------------------------------------------------------------------

  private async simulateLatency(): Promise<void> {
    const raw = process.env[LATENCY_ENV];
    const ms = raw ? Number(raw) : 0;
    if (Number.isFinite(ms) && ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(ms, 30_000)));
    }
  }

  private idemKey(idempotencyKey: string, operation: SandboxOperation): string {
    return `${operation}:${idempotencyKey}`;
  }

  private findByIdempotency(
    idempotencyKey: string,
    operation: SandboxOperation,
  ): SandboxRecord | undefined {
    const id = this.byIdempotency.get(this.idemKey(idempotencyKey, operation));
    return id ? this.records.get(id) : undefined;
  }

  private byReference(reference: string): SandboxRecord | undefined {
    for (const record of this.records.values()) {
      if (record.reference === reference || record.reference.startsWith(`${reference}:`)) {
        return record;
      }
    }
    return undefined;
  }

  private mustFind(
    providerTransactionId?: string,
    reference?: string,
  ): SandboxRecord {
    const record =
      (providerTransactionId
        ? this.records.get(providerTransactionId)
        : undefined) ?? (reference ? this.byReference(reference) : undefined);
    if (!record) {
      throw new ProviderError("not_found", "Unknown provider transaction");
    }
    return record;
  }

  private assertMoney(amountMinor: number, currency: string): void {
    if (!isPositiveInt(amountMinor)) {
      throw new ProviderError(
        "invalid_request",
        "Amount must be a positive integer of minor units",
        { retryable: false },
      );
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ProviderError(
        "invalid_request",
        "Currency must be an ISO-4217 code",
        { retryable: false },
      );
    }
  }

  private toOperationResult(
    record: SandboxRecord,
    extra?: { instructions?: string; metadata?: Record<string, unknown> },
  ): ProviderOperationResult {
    const internal = STATUS_TO_INTERNAL[record.status];
    return {
      providerTransactionId: record.providerTransactionId,
      status: internal === "reversed" ? "failed" : internal,
      expiresAt: new Date(record.expiresAt).toISOString(),
      instructions: extra?.instructions,
      metadata: extra?.metadata,
    };
  }

  private toStatusResult(record: SandboxRecord): ProviderStatusResult {
    const internal = STATUS_TO_INTERNAL[record.status];
    return {
      status: internal === "reversed" ? "failed" : internal,
      amountMinor: record.railAmountMinor,
      currency: record.currency,
      occurredAt: new Date(record.createdAt).toISOString(),
      failureReason: record.failureReason
        ? safeText(record.failureReason)
        : undefined,
    };
  }

  // -----------------------------------------------------------------------
  // Operations
  // -----------------------------------------------------------------------

  async createDeposit(
    input: ProviderCreateDepositInput,
  ): Promise<ProviderOperationResult> {
    this.requireCapability("DEPOSIT");
    this.assertMoney(input.amountMinor, input.currency);
    if (!isPositiveInt(input.totalToCollectMinor)) {
      throw new ProviderError("invalid_request", "Invalid total to collect", {
        retryable: false,
      });
    }
    await this.simulateLatency();

    const replay = this.findByIdempotency(input.idempotencyKey, "deposit");
    if (replay) return this.toOperationResult(replay);

    const now = Date.now();
    const record: SandboxRecord = {
      providerTransactionId: `momo_${randomUUID().replace(/-/g, "")}`,
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      operation: "deposit",
      grossAmountMinor: input.amountMinor,
      railAmountMinor: input.totalToCollectMinor,
      currency: input.currency,
      status: "processing",
      createdAt: now,
      expiresAt: now +
        (input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000,
    };
    this.records.set(record.providerTransactionId, record);
    this.byIdempotency.set(
      this.idemKey(input.idempotencyKey, "deposit"),
      record.providerTransactionId,
    );

    return this.toOperationResult(record, {
      instructions: `Dial *150*1*${record.providerTransactionId.slice(-6)}# and confirm with your PIN (sandbox — no real money moves).`,
      metadata: {
        collectAmountMinor: record.railAmountMinor,
        currency: record.currency,
      },
    });
  }

  async confirmDeposit(
    input: ProviderConfirmDepositInput,
  ): Promise<ProviderOperationResult> {
    this.requireCapability("DEPOSIT");
    const record = this.mustFind(input.providerTransactionId, input.reference);
    if (record.operation !== "deposit") {
      throw new ProviderError("invalid_request", "Not a deposit", {
        retryable: false,
      });
    }
    // The sandbox has no real PIN to check; a confirmation re-asserts
    // the current state (the webhook remains the settlement channel).
    return this.toOperationResult(record);
  }

  async createWithdrawal(
    input: ProviderCreateWithdrawalInput,
  ): Promise<ProviderOperationResult> {
    this.requireCapability("WITHDRAWAL");
    this.assertMoney(input.amountMinor, input.currency);
    await this.simulateLatency();

    const replay = this.findByIdempotency(input.idempotencyKey, "withdrawal");
    if (replay) return this.toOperationResult(replay);

    const now = Date.now();
    const record: SandboxRecord = {
      providerTransactionId: `momo_${randomUUID().replace(/-/g, "")}`,
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      operation: "withdrawal",
      grossAmountMinor: input.amountMinor,
      railAmountMinor: input.amountMinor,
      currency: input.currency,
      status: "processing",
      createdAt: now,
      expiresAt: now +
        (input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000,
    };
    this.records.set(record.providerTransactionId, record);
    this.byIdempotency.set(
      this.idemKey(input.idempotencyKey, "withdrawal"),
      record.providerTransactionId,
    );

    return this.toOperationResult(record, {
      instructions: `Payout queued to ${safeText(input.destinationRef) ?? "the connected account"} (sandbox).`,
      metadata: {
        deliverAmountMinor: record.grossAmountMinor,
        currency: record.currency,
      },
    });
  }

  async cancelWithdrawal(
    input: ProviderCancelInput,
  ): Promise<ProviderOperationResult> {
    this.requireCapability("WITHDRAWAL");
    const record = this.mustFind(input.providerTransactionId, input.reference);
    if (record.operation !== "withdrawal") {
      throw new ProviderError("invalid_request", "Not a withdrawal", {
        retryable: false,
      });
    }
    if (record.status !== "processing") {
      throw new ProviderError(
        "invalid_request",
        `Withdrawal is already ${record.status}`,
        { retryable: false },
      );
    }
    record.status = "cancelled";
    record.failureReason = "Cancelled by user";
    return this.toOperationResult(record);
  }

  async getTransactionStatus(
    input: ProviderStatusInput,
  ): Promise<ProviderStatusResult> {
    this.requireCapability("TRANSACTION_STATUS");
    return this.toStatusResult(
      this.mustFind(input.providerTransactionId, input.reference),
    );
  }

  async verifyTransaction(
    input: ProviderStatusInput,
  ): Promise<ProviderVerificationResult> {
    this.requireCapability("TRANSACTION_STATUS");
    try {
      const record = this.mustFind(
        input.providerTransactionId,
        input.reference,
      );
      return { verified: true, ...this.toStatusResult(record) };
    } catch (error) {
      if (error instanceof ProviderError && error.code === "not_found") {
        // Authoritative negative: the provider does not know this id.
        return {
          verified: false,
          status: "failed",
          failureReason: "Not recognized by provider",
        };
      }
      throw error;
    }
  }

  async refundTransaction(
    input: ProviderRefundInput,
  ): Promise<ProviderOperationResult> {
    this.requireCapability("REFUND");
    this.assertMoney(input.amountMinor, input.currency);

    const original = this.mustFind(input.providerTransactionId, input.reference);
    if (original.status !== "successful") {
      throw new ProviderError(
        "invalid_request",
        "Only a successful transaction can be refunded",
        { retryable: false },
      );
    }

    // Idempotent per original reference: a retried refund returns the
    // same provider transaction instead of creating a second one.
    const refundReference = `${input.reference}:refund`;
    const existing = this.byReference(refundReference);
    if (existing) return this.toOperationResult(existing);

    const now = Date.now();
    const record: SandboxRecord = {
      providerTransactionId: `momo_${randomUUID().replace(/-/g, "")}`,
      reference: refundReference,
      idempotencyKey: `refund:${input.reference}`,
      operation: "refund",
      grossAmountMinor: input.amountMinor,
      railAmountMinor: input.amountMinor,
      currency: input.currency,
      status: "processing",
      createdAt: now,
      expiresAt: now + DEFAULT_EXPIRY_SECONDS * 1000,
    };
    this.records.set(record.providerTransactionId, record);
    this.byIdempotency.set(
      this.idemKey(record.idempotencyKey, "refund"),
      record.providerTransactionId,
    );

    return this.toOperationResult(record, {
      instructions: "Refund queued to the original payment method (sandbox).",
      metadata: { refundAmountMinor: record.grossAmountMinor },
    });
  }

  async getAccountBalance(
    input: ProviderBalanceInput,
  ): Promise<ProviderBalanceResult> {
    this.requireCapability("BALANCE_CHECK");
    this.assertMoney(1, input.currency);
    // Deterministic sandbox float — clearly not a real balance.
    return { balanceMinor: 100_000_000, currency: input.currency };
  }

  async listTransactions(
    range: ProviderListRange,
  ): Promise<ProviderListedTransaction[]> {
    this.requireCapability("RECONCILIATION");
    const from = range.from.getTime();
    const to = range.to.getTime();
    const listed: ProviderListedTransaction[] = [];
    for (const record of this.records.values()) {
      if (record.createdAt < from || record.createdAt > to) continue;
      const internal = STATUS_TO_INTERNAL[record.status];
      listed.push({
        providerTransactionId: record.providerTransactionId,
        reference: record.reference,
        walletType: record.operation,
        status: internal === "reversed" ? "failed" : internal,
        amountMinor: record.railAmountMinor,
        currency: record.currency,
        occurredAt: new Date(record.createdAt).toISOString(),
      });
    }
    return listed;
  }

  // -----------------------------------------------------------------------
  // Webhook — verify, parse, NORMALIZE. Nothing above this line ever
  // sees a raw provider payload; nothing below the return ever will.
  // -----------------------------------------------------------------------

  async handleWebhook(
    input: ProviderWebhookInput,
  ): Promise<ProviderWebhookResult> {
    this.requireCapability("WEBHOOK");

    const secret = getSecret();
    if (!secret) {
      return { valid: false, reason: "Webhook secret not configured" };
    }

    const provided = input.headers.get(SANDBOX_MOMO_SIGNATURE_HEADER);
    if (!provided?.startsWith("sha256=")) {
      return { valid: false, reason: "Missing signature header" };
    }
    const expected = signSandboxWebhook(input.rawBody, secret);
    if (!timingSafeEqualStrings(expected, provided)) {
      return { valid: false, reason: "Signature mismatch" };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(input.rawBody);
    } catch {
      return { valid: false, reason: "Malformed JSON body" };
    }
    if (typeof payload !== "object" || payload === null) {
      return { valid: false, reason: "Unexpected payload shape" };
    }    const body = payload as {
      event?: { id?: unknown; type?: unknown; created_at?: unknown };
      data?: {
        transaction_ref?: unknown;
        operation?: unknown;
        status?: unknown;
        amount?: unknown;
        currency?: unknown;
        merchant_reference?: unknown;
        failure_reason?: unknown;
      };
    };

    const event = body.event;
    const data = body.data;
    if (
      !event ||
      typeof event.id !== "string" ||
      event.id.length < 1 ||
      event.id.length > 128
    ) {
      return { valid: false, reason: "Missing event id" };
    }
    if (event.type !== "payment.settled") {
      // Correctly signed but an event type we do not model: acknowledge
      // so the provider stops retrying, without persisting anything.
      return { valid: true, reason: "Unsupported event type" };
    }
    if (
      !data ||
      typeof data.transaction_ref !== "string" ||
      data.transaction_ref.length > 128
    ) {
      return { valid: false, reason: "Missing transaction reference" };
    }
    const operation = data.operation;
    const status = data.status;
    if (
      (operation !== "deposit" && operation !== "withdrawal" && operation !== "refund") ||
      typeof status !== "string" ||
      !(status in STATUS_TO_INTERNAL)
    ) {
      return { valid: false, reason: "Unknown operation or status" };
    }
    if (!isPositiveInt(data.amount) || typeof data.currency !== "string" || !/^[A-Z]{3}$/.test(data.currency)) {
      return { valid: false, reason: "Invalid amount or currency" };
    }

    const type = mapEventType(
      operation as SandboxOperation,
      status as SandboxStatus,
    );
    if (!type) {
      return { valid: true, reason: "Unsupported event type" };
    }

    const occurredAt =
      typeof event.created_at === "string" &&
      !Number.isNaN(Date.parse(event.created_at))
        ? new Date(event.created_at).toISOString()
        : new Date().toISOString();

    return {
      valid: true,
      event: {
        providerEventId: event.id,
        type,
        status: STATUS_TO_INTERNAL[status as SandboxStatus],
        providerTransactionId: data.transaction_ref,
        reference:
          typeof data.merchant_reference === "string"
            ? safeText(data.merchant_reference, 128)
            : undefined,
        amountMinor: data.amount,
        currency: data.currency,
        occurredAt,
        failureReason: safeText(data.failure_reason),
        data: { operation },
      },
    };
  }

  async simulateSettlement({
    reference,
    providerTransactionId,
    outcome,
  }: {
    reference: string;
    providerTransactionId: string;
    outcome: "succeeded" | "failed";
  }): Promise<ProviderWebhookInput> {
    const secret = getSecret();
    if (!secret) {
      throw new ProviderError(
        "unavailable",
        `Webhook secret not configured (${SECRET_ENV})`,
      );
    }
    const record = this.mustFind(providerTransactionId, reference);
    if (record.status !== "processing") {
      throw new ProviderError(
        "invalid_request",
        `Transaction is already ${record.status}`,
        { retryable: false },
      );
    }

    record.status = outcome === "succeeded" ? "successful" : "failed";
    if (outcome === "failed") record.failureReason = "Sandbox-reported failure";

    const payload = {
      event: {
        id: `evt_${randomUUID().replace(/-/g, "")}`,
        type: "payment.settled",
        created_at: new Date().toISOString(),
      },
      data: {
        transaction_ref: record.providerTransactionId,
        merchant_reference: record.reference,
        operation: record.operation,
        status: record.status,
        amount: record.railAmountMinor,
        currency: record.currency,
        ...(record.failureReason
          ? { failure_reason: record.failureReason }
          : {}),
      },
    };
    const rawBody = JSON.stringify(payload);
    const headers = new Headers({
      "content-type": "application/json",
      [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, secret),
    });
    return { rawBody, headers };
  }
}

/** Provider-operation + provider-status → normalized event type. */
function mapEventType(
  operation: SandboxOperation,
  status: SandboxStatus,
): ProviderEventType | null {
  switch (operation) {
    case "deposit":
      if (status === "successful") return "deposit.succeeded";
      if (status === "failed") return "deposit.failed";
      if (status === "expired") return "deposit.expired";
      if (status === "processing") return "deposit.processing";
      return null;
    case "withdrawal":
      if (status === "successful") return "withdrawal.succeeded";
      if (status === "failed" || status === "cancelled") {
        return "withdrawal.failed";
      }
      if (status === "reversed") return "withdrawal.reversed";
      if (status === "expired") return "withdrawal.expired";
      return null;
    case "refund":
      if (status === "successful") return "refund.succeeded";
      if (status === "failed") return "refund.failed";
      return null;
  }
}

/** Structural check used by tooling and contract tests. */
export function isSandboxProvider(
  provider: PaymentProvider,
): provider is SandboxMobileMoneyProvider {
  return provider.getProviderInfo().id === SANDBOX_MOMO_ID;
}
