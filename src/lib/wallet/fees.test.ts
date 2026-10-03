/**
 * fees.ts — every fee is explicit, integer and rounded half-up in
 * BigInt (no float money). A corrupted fee schedule must throw rather
 * than silently price money.
 */

import { describe, expect, test } from "bun:test";

import { computeFees, parseFeeSchedule, type FeeSchedule } from "./fees";
import { MoneyError } from "./money";

describe("computeFees", () => {
  test("zero schedule → zero fees", () => {
    expect(computeFees(10_000, {})).toEqual({
      providerFee: 0,
      platformFee: 0,
      totalFee: 0,
    });
    expect(computeFees(10_000, null)).toEqual({
      providerFee: 0,
      platformFee: 0,
      totalFee: 0,
    });
  });

  test("basis points of the gross amount", () => {
    // 2% of 10,000 = 200
    expect(computeFees(10_000, { platformBps: 200 })).toEqual({
      providerFee: 0,
      platformFee: 200,
      totalFee: 200,
    });
    // 1.5% + 0.5% of 10,000
    expect(computeFees(10_000, { platformBps: 150, providerBps: 50 })).toEqual({
      providerFee: 50,
      platformFee: 150,
      totalFee: 200,
    });
  });

  test("rounds half-up, exactly", () => {
    // 50 bps of 101 = 0.505 → 1 (half-up), not 0 and not 0.505
    expect(computeFees(101, { platformBps: 50 }).platformFee).toBe(1);
    // 50 bps of 99 = 0.495 → 0
    expect(computeFees(99, { platformBps: 50 }).platformFee).toBe(0);
  });

  test("fixed components add to the bps component", () => {
    expect(
      computeFees(10_000, { providerBps: 100, providerFixedMinor: 300 }),
    ).toEqual({ providerFee: 400, platformFee: 0, totalFee: 400 });
  });

  test("rejects non-integer or non-positive amounts", () => {
    expect(() => computeFees(0, {})).toThrow(MoneyError);
    expect(() => computeFees(-1, {})).toThrow(MoneyError);
    expect(() => computeFees(1.5, {})).toThrow(MoneyError);
  });
});

describe("parseFeeSchedule", () => {
  test("nullish → empty schedule", () => {
    expect(parseFeeSchedule(null)).toEqual({});
    expect(parseFeeSchedule(undefined)).toEqual({});
  });

  test("round-trips a valid schedule and drops unknown fields", () => {
    expect(
      parseFeeSchedule({
        platformBps: 200,
        providerBps: 50,
        platformFixedMinor: 10,
        providerFixedMinor: 20,
        someFutureKnob: "ignored",
      }),
    ).toEqual({
      platformBps: 200,
      providerBps: 50,
      platformFixedMinor: 10,
      providerFixedMinor: 20,
    });
  });

  test("throws on negative, non-integer or out-of-range values", () => {
    expect(() => parseFeeSchedule({ platformBps: -1 })).toThrow(MoneyError);
    expect(() => parseFeeSchedule({ platformBps: 1.5 })).toThrow(MoneyError);
    expect(() => parseFeeSchedule({ platformBps: 10_001 })).toThrow(MoneyError);
    expect(() => parseFeeSchedule({ providerFixedMinor: -5 })).toThrow(
      MoneyError,
    );
    expect(() => parseFeeSchedule("not an object")).toThrow(MoneyError);
  });
});

describe("schedule as configured in the database", () => {
  test("a realistic two-sided schedule stays integer", () => {
    const schedule: FeeSchedule = {
      platformBps: 250, // 2.5%
      providerBps: 100, // 1%
      providerFixedMinor: 100,
    };
    const result = computeFees(7_777, schedule);
    // 1% of 7777 = 77.77 → 78 (half-up) + 100 fixed = 178
    expect(result.providerFee).toBe(78 + 100);
    // 2.5% of 7777 = 194.425 → 194
    expect(result.platformFee).toBe(194);
    expect(result.totalFee).toBe(result.providerFee + result.platformFee);
  });
});
