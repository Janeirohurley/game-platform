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
import type { TransactionListRow } from "@/lib/wallet/queries";
import type { CurrencyInfo } from "@/lib/wallet/currencies";
import type { WalletRow } from "@/lib/wallet/wallet";
import type { getLedgerForTransaction } from "@/lib/wallet/ledger";

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
  rows: TransactionListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type LedgerRow = Awaited<ReturnType<typeof getLedgerForTransaction>>[number];

export interface TransactionDetailResponse {
  transaction: TransactionRow;
  ledger: LedgerRow[];
}

/** Public tariff rows — no admin identifiers. */
export interface WalletSettingsDto {
  pointsCurrency: string;
  currency: string;
  buyPointsPerUnit: number;
  sellMinorPerPoint: number;
  minWithdrawalPoints: number;
  minStakePoints: number;
  maxStakePoints: number;
  contactInstructions: string;
}

/** Withdrawal request as serialized by the API (dates are ISO strings)
 *  or handed straight from a Server Component (Date objects). */
export interface WithdrawalRequestDto {
  id: string;
  amountMinor: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "rejected";
  userNote: string | null;
  adminNote: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  decidedAt: string | Date | null;
  paidAt: string | Date | null;
}

export interface WithdrawalRequestCreateResponse {
  request: WithdrawalRequestDto;
  balanceMinor: number;
  duplicate: boolean;
  estimate: { points: number; amountMinor: number; currency: string };
}

// ---- endpoints ----------------------------------------------------------

export const walletApi = {
  overview: () => request<OverviewResponse>("/api/wallet"),

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

  settings: () => request<{ settings: WalletSettingsDto }>("/api/wallet/settings"),

  withdrawalRequests: () =>
    request<{ requests: WithdrawalRequestDto[] }>("/api/wallet/withdrawals"),

  createWithdrawalRequest: (body: {
    points: number;
    note?: string;
    idempotencyKey: string;
  }) =>
    request<WithdrawalRequestCreateResponse>("/api/wallet/withdrawals", {
      method: "POST",
      json: body,
    }),
};

/** Every transfer-relevant status still awaiting an outcome. */
export function isPendingStatus(status: string): boolean {
  return status === "created" || status === "pending" || status === "processing";
}
