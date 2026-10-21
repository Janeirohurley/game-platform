/**
 * Wallet error taxonomy — one vocabulary from the engine through the
 * API routes to the UI. Every error carries an HTTP status so route
 * handlers map mechanically, and a machine-readable `code` the client
 * surfaces without parsing prose.
 *
 * Nothing here ever carries a secret: messages are written to be shown
 * to a user; raw payloads never reach them.
 */

export type WalletErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "idempotency_conflict"
  | "insufficient_funds"
  | "invalid_state"
  | "currency_mismatch"
  | "amount_mismatch"
  | "rate_limited"
  | "internal";

const STATUS_BY_CODE: Record<WalletErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation: 400,
  idempotency_conflict: 409,
  insufficient_funds: 409,
  invalid_state: 409,
  currency_mismatch: 409,
  amount_mismatch: 409,
  rate_limited: 429,
  internal: 500,
};

export class WalletError extends Error {
  readonly code: WalletErrorCode;
  readonly status: number;
  /** Optional, sanitized structured context (ids, limits — no secrets). */
  readonly details?: Record<string, unknown>;

  constructor(
    code: WalletErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WalletError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function isWalletError(error: unknown): error is WalletError {
  return error instanceof WalletError;
}

/** Wire shape of every wallet API error response. */
export interface WalletErrorBody {
  error: {
    code: WalletErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Map any thrown value to a safe response body + status. Unknown errors
 * collapse to a generic 500: internal messages may contain raw internal
 * fragments and must not leak to clients.
 */
export function toWalletErrorBody(
  error: unknown,
): { status: number; body: WalletErrorBody } {
  if (isWalletError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "internal",
        message: "An unexpected error occurred. Please try again.",
      },
    },
  };
}
