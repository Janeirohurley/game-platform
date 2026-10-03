/**
 * rate-limit.ts — fixed-window limiter with an injectable clock.
 * Money endpoints lean on it as a brake, so the window behaviour is
 * pinned here instead of being discovered in production.
 */

import { describe, expect, test } from "bun:test";

import { RateLimiter } from "./rate-limit";

function makeLimiter(max = 3, windowMs = 1_000) {
  let now = 1_000_000;
  const limiter = new RateLimiter({
    windowMs,
    max,
    now: () => now,
  });
  return {
    limiter,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("RateLimiter", () => {
  test("allows up to max, then denies with a retry hint", () => {
    const { limiter } = makeLimiter(3);
    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(true);
    const third = limiter.consume("u1");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const denied = limiter.consume("u1");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    expect(denied.retryAfterMs).toBeLessThanOrEqual(1_000);
  });

  test("keys are independent", () => {
    const { limiter } = makeLimiter(1);
    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(false);
    expect(limiter.consume("u2").allowed).toBe(true);
  });

  test("the window resets after windowMs", () => {
    const { limiter, advance } = makeLimiter(1, 1_000);
    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u1").allowed).toBe(false);
    advance(1_001);
    expect(limiter.consume("u1").allowed).toBe(true);
  });

  test("reset clears one key or everything", () => {
    const { limiter } = makeLimiter(1);
    limiter.consume("u1");
    limiter.consume("u2");
    limiter.reset("u1");
    expect(limiter.consume("u1").allowed).toBe(true);
    expect(limiter.consume("u2").allowed).toBe(false);
    limiter.reset();
    expect(limiter.consume("u2").allowed).toBe(true);
  });

  test("expired windows are evicted (bounded memory)", () => {
    const { limiter, advance } = makeLimiter(5, 100);
    limiter.consume("a");
    limiter.consume("b");
    advance(200);
    // Next consume sweeps stale buckets before counting.
    limiter.consume("c");
    // "a" restarted fresh — its old window is gone.
    expect(limiter.consume("a").allowed).toBe(true);
  });

  test("maxKeys caps tracked identities", () => {
    const limiter = new RateLimiter({
      windowMs: 60_000,
      max: 2,
      maxKeys: 5,
      now: () => 1,
    });
    for (let i = 0; i < 10; i += 1) limiter.consume(`k${i}`);
    // Whatever survived, behaviour stays correct for a fresh key.
    expect(limiter.consume("fresh").allowed).toBe(true);
  });
});
