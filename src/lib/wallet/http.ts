/**
 * Shared HTTP plumbing for the wallet routes: one error wire shape,
 * one schema parser (body + query), one rate-limit responder and one
 * no-store JSON helper. Handlers stay thin and uniform:
 *
 *   session → rate limit → validate → service call → response
 *
 * Every thrown value funnels through `walletErrorResponse`, so an
 * internal message or provider fragment can never leak to a client —
 * unknown errors collapse to the generic 500 body in errors.ts.
 */

import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { WalletError, toWalletErrorBody } from "./errors";
import type { RateLimitDecision } from "./rate-limit";

/** Map any thrown value onto the wallet error wire shape. */
export function walletErrorResponse(error: unknown): NextResponse {
  const { status, body } = toWalletErrorBody(error);
  return NextResponse.json(body, { status });
}

/** Validate raw data against a schema; failures throw typed 400s. */
export function parseInput<T>(
  schema: ZodType<T>,
  data: unknown,
  what = "payload",
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field =
      issue && issue.path.length > 0 ? String(issue.path[0]) : undefined;
    throw new WalletError(
      "validation",
      issue?.message ?? `Invalid ${what}.`,
      field ? { field } : undefined,
    );
  }
  return parsed.data;
}

/** Read and validate a JSON request body. */
export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new WalletError("validation", "Request body must be valid JSON.");
  }
  return parseInput(schema, raw);
}

/** Validate URL search params against a schema (coercion included). */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const raw: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    raw[key] = value;
  }
  return parseInput(schema, raw, "query");
}

/** 429 with a Retry-After header (seconds, always ≥ 1). */
export function rateLimitResponse(decision: RateLimitDecision): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "rate_limited",
        message: "Too many requests — please try again shortly.",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
      },
    },
  );
}

/** Best-effort caller identity for unauthenticated endpoints (webhooks). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** JSON response that must never be cached (balances, money state). */
export function walletJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
