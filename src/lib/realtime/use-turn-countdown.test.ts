import { expect, test } from "bun:test";

import { turnProgressFraction } from "./use-turn-countdown";

test("a fresh window is full", () => {
  expect(turnProgressFraction(0, 30_000)).toBe(1);
});

test("half the budget spent is half the ring left", () => {
  expect(turnProgressFraction(15_000, 30_000)).toBe(0.5);
});

test("a spent budget never goes negative", () => {
  expect(turnProgressFraction(40_000, 30_000)).toBe(0);
});

test("negative elapsed never overflows", () => {
  expect(turnProgressFraction(-1_000, 30_000)).toBe(1);
});

test("a zero or negative budget disables the timer entirely", () => {
  expect(turnProgressFraction(5_000, 0)).toBe(0);
  expect(turnProgressFraction(5_000, -100)).toBe(0);
});