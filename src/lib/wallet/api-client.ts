/**
 * Typed fetch layer for the wallet UI — the ONLY way the browser
 * talks to the wallet API. Every error carries the server's
 * machine-readable `code` (insufficient_funds, rate_limited,
 * idempotency_conflict, …) so panels can react precisely instead of
 * parsing prose. Amounts are always INTEGER MINOR UNITS.
 *
 * Type-only imports from the server modules — nothing server-side
 * executes in the browser.
 */

import type { WalletErrorCode } from "@/lib/wallet/errors";
import type { TransactionRow } from "@/lib/wallet/engine";
import type { CurrencyInfo } from "@/lib/wallet/currencies";
import type { WalletRow } from "@/lib/wallet/wallet";
import type { PublicProvider } from "@/lib/wallet/provider-config";
import type { ProviderAccountRow } from "@/lib/wallet/provider-accounts";
import type { getLedgerForTransaction } from "@/lib/wallet/ledger";
import type { getEventsForTransaction } from "@/lib/wallet/events";

export class WalletApiError extends Error {
  readonly code: WalletErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: WalletErrorCode,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WalletApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init?.method ?? "GET",
      headers:
        init?.json !== undefined
          ? { "Content-Type": "application/json" }
          : (init?.headers ?? {}),
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      cache: "no-store",
    });
  } catch {
    throw new WalletApiError(
      "Network error — check your connection and try again.",
      "internal",
      0,
    );
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as { error?: Record<string, unknown> } | null)?.error;
    throw new WalletApiError(
      typeof error?.message === "string"
        ? error.message
        : "Something went wrong. Please try again.",
      (typeof error?.code === "string" ? error.code : "internal") as WalletErrorCode,
      response.status,
      (error?.details as Record<string, unknown> | undefined) ?? undefined,
    );
  }
  return data as T;
}

// ---- response shapes ----------------------------------------------------

export interface OverviewResponse {
  wallet: WalletRow;
  balanceMinor: number;
  currency: CurrencyInfo | null;
}

export interface TransactionListResponse {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type LedgerRow = Awaited<ReturnType<typeof getLedgerForTransaction>>[number];
export type ProviderEventRow = Awaited<ReturnType<typeof getEventsForTransaction>>[number];

export interface TransactionDetailResponse {
  transaction: TransactionRow;
  ledger: LedgerRow[];
  events: ProviderEventRow[];
}

export interface QuoteResponse {
  provider: string;
  providerName: string;
  type: "deposit" | "withdrawal";
  currency: string;
  grossAmount: number;
  providerFee: number;
  platformFee: number;
  totalFee: number;
  netAmount: number;
  totalAmount: number;
}

export interface OperationResponse {
  transaction: TransactionRow;
  duplicate: boolean;
}

export interface WebhookSimulateResponse {
  outcome: "processed" | "duplicate" | "ignored" | "unresolved";
  applied: boolean;
  transactionId?: string;
  reason?: string;
}

export type AccountRow = ProviderAccountRow;

// ---- endpoints ----------------------------------------------------------

export const walletApi = {
  overview: () => request<OverviewResponse>("/api/wallet"),

  providers: () =>
    request<{ providers: PublicProvider[] }>("/api/wallet/providers"),

  accounts: () => request<{ accounts: AccountRow[] }>("/api/wallet/accounts"),

  connectAccount: (body: {
    provider: string;
    providerAccountId: string;
    accountType?: string;
    displayName?: string;
    currency?: string;
  }) =>
    request<{ account: AccountRow }>("/api/wallet/accounts", {
      method: "POST",
      json: body,
    }),

  disconnectAccount: (id: string) =>
    request<{ account: AccountRow }>(`/api/wallet/accounts/${id}`, {
      method: "DELETE",
    }),

  transactions: (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    const query = search.toString();
    return request<TransactionListResponse>(
      `/api/wallet/transactions${query ? `?${query}` : ""}`,
    );
  },

  detail: (id: string) =>
    request<TransactionDetailResponse>(`/api/wallet/transactions/${id}`),

  quote: (body: {
    provider: string;
    type: "deposit" | "withdrawal";
    amount: number;
    currency: string;
  }) => request<QuoteResponse>("/api/wallet/quote", { method: "POST", json: body }),

  deposit: (body: {
    provider: string;
    amount: number;
    currency: string;
    providerAccountId?: string;
    idempotencyKey: string;
  }) =>
    request<OperationResponse>("/api/wallet/deposits", {
      method: "POST",
      json: body,
    }),

  withdrawal: (body: {
    provider: string;
    amount: number;
    currency: string;
    providerAccountId?: string;
    destinationRef?: string;
    idempotencyKey: string;
  }) =>
    request<OperationResponse>("/api/wallet/withdrawals", {
      method: "POST",
      json: body,
    }),

  cancel: (id: string) =>
    request<{ transaction: TransactionRow }>(
      `/api/wallet/transactions/${id}/cancel`,
      { method: "POST", json: {} },
    ),

  confirm: (id: string, confirmation?: string) =>
    request<{
      transaction: TransactionRow;
      settled: boolean;
      recognized: boolean;
      reason: string | null;
    }>(`/api/wallet/transactions/${id}/confirm`, {
      method: "POST",
      json: { confirmation },
    }),

  refund: (id: string, idempotencyKey: string) =>
    request<OperationResponse>(`/api/wallet/transactions/${id}/refund`, {
      method: "POST",
      json: { idempotencyKey },
    }),

  simulate: (transactionId: string, outcome: "succeeded" | "failed") =>
    request<WebhookSimulateResponse>("/api/wallet/simulate", {
      method: "POST",
      json: { transactionId, outcome },
    }),
};

/** Every transfer-relevant status still awaiting an outcome. */
export function isPendingStatus(status: string): boolean {
  return status === "created" || status === "pending" || status === "processing";
}
