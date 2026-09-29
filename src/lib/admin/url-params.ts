/**
 * Shared searchParams helpers for admin list pages. Kept tiny and
 * server-safe: every admin page parses its own URL state the same way.
 */

/** Positive int from a query param, falling back when absent/invalid. */
export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
