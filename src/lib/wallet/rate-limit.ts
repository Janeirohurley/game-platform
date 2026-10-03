/**
 * In-memory fixed-window rate limiter for money endpoints (deposits,
 * withdrawals, webhook deliveries). Per-instance by design — a best-effort
 * brake against accidental loops and credential-free abuse, NOT a
 * substitute for edge/WAF limits. Fully injectable clock, unit-tested.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Milliseconds until the current window resets (when denied). */
  retryAfterMs: number;
  remaining: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum hits allowed per window per key. */
  max: number;
  /** Injectable clock (tests). */
  now?: () => number;
  /** Safety cap on tracked keys — oldest windows are evicted first. */
  maxKeys?: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
    this.now = options.now ?? Date.now;
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  /** Count one hit against `key` and decide. */
  consume(key: string): RateLimitDecision {
    const now = this.now();
    this.evict(now);

    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0, remaining: this.max - 1 };
    }

    if (existing.count >= this.max) {
      return {
        allowed: false,
        retryAfterMs: Math.max(0, existing.resetAt - now),
        remaining: 0,
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: this.max - existing.count,
    };
  }

  reset(key?: string): void {
    if (key === undefined) this.buckets.clear();
    else this.buckets.delete(key);
  }

  private evict(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    // Hard cap: drop arbitrary oldest-expiring entries (Map preserves
    // insertion order — good enough for a best-effort limiter).
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done) break;
      this.buckets.delete(oldest.value);
    }
  }
}

/** Money endpoints: per user (or IP for anonymous webhook callers). */
export const depositLimiter = new RateLimiter({ windowMs: 60_000, max: 10 });
export const withdrawalLimiter = new RateLimiter({ windowMs: 60_000, max: 10 });
export const webhookLimiter = new RateLimiter({ windowMs: 60_000, max: 120 });
export const connectLimiter = new RateLimiter({ windowMs: 60_000, max: 6 });
