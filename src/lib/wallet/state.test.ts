/**
 * state.ts — the lifecycle is a pure table. These tests pin the
 * invariants the engine relies on under row locks:
 *   - terminal states accept NOTHING;
 *   - succeeded only moves to compensating states (never backwards);
 *   - failed/cancelled/expired may still turn into succeeded (the
 *     late-webhook edge), but only the engine takes it;
 *   - unknown statuses fail closed (treated as terminal).
 */

import { describe, expect, test } from "bun:test";

import { WALLET_TRANSACTION_STATUSES } from "./constants";
import {
  allStatuses,
  assertTransition,
  canTransition,
  isCancellable,
  isPendingState,
  isSettled,
  isTerminal,
} from "./state";

describe("canTransition", () => {
  test("forward happy path", () => {
    expect(canTransition("created", "pending")).toBe(true);
    expect(canTransition("pending", "processing")).toBe(true);
    expect(canTransition("processing", "succeeded")).toBe(true);
    expect(canTransition("created", "succeeded")).toBe(true);
  });

  test("failure and expiry edges", () => {
    expect(canTransition("processing", "failed")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
    expect(canTransition("pending", "expired")).toBe(true);
  });

  test("late success from a failed state (authoritative source only)", () => {
    expect(canTransition("failed", "succeeded")).toBe(true);
    expect(canTransition("cancelled", "succeeded")).toBe(true);
    expect(canTransition("expired", "succeeded")).toBe(true);
  });

  test("succeeded never moves backwards", () => {
    expect(canTransition("succeeded", "pending")).toBe(false);
    expect(canTransition("succeeded", "processing")).toBe(false);
    expect(canTransition("succeeded", "failed")).toBe(false);
    expect(canTransition("succeeded", "cancelled")).toBe(false);
    expect(canTransition("succeeded", "expired")).toBe(false);
  });

  test("terminal states accept nothing", () => {
    for (const terminal of ["refunded", "reversed"] as const) {
      for (const target of WALLET_TRANSACTION_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });
});

describe("assertTransition", () => {
  test("throws a descriptive error on an illegal edge", () => {
    expect(() => assertTransition("succeeded", "pending")).toThrow(
      /succeeded → pending/,
    );
    expect(() => assertTransition("created", "pending")).not.toThrow();
  });
});

describe("predicates", () => {
  test("isTerminal", () => {
    expect(isTerminal("refunded")).toBe(true);
    expect(isTerminal("reversed")).toBe(true);
    expect(isTerminal("succeeded")).toBe(false);
    expect(isTerminal("processing")).toBe(false);
    // Unknown statuses fail closed — the engine will not touch them.
    expect(isTerminal("bogus")).toBe(true);
  });

  test("isSettled / isPendingState / isCancellable", () => {
    expect(isSettled("succeeded")).toBe(true);
    expect(isSettled("failed")).toBe(false);

    expect(isPendingState("created")).toBe(true);
    expect(isPendingState("processing")).toBe(true);
    expect(isPendingState("succeeded")).toBe(false);

    expect(isCancellable("pending")).toBe(true);
    expect(isCancellable("succeeded")).toBe(false);
    // Unknown statuses are never cancellable.
    expect(isCancellable("bogus")).toBe(false);
  });

  test("allStatuses matches the constants table", () => {
    expect([...allStatuses()]).toEqual([...WALLET_TRANSACTION_STATUSES]);
  });
});
