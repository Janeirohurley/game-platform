/**
 * money.ts — integer minor units are the ONLY representation. These
 * tests pin the two directions (major string ↔ minor integer), the
 * rounding-free conversion, and every rejection path: no float ever
 * survives contact with an amount.
 */

import { describe, expect, test } from "bun:test";

import {
  formatMoney,
  isAmountMinor,
  MAX_AMOUNT_MINOR,
  minorToMajorString,
  MoneyError,
  parseMajorToMinor,
  sumMinor,
} from "./money";

describe("parseMajorToMinor", () => {
  test("converts 2-decimal currencies exactly", () => {
    expect(parseMajorToMinor("10.00", "USD")).toBe(1000);
    expect(parseMajorToMinor("0.01", "USD")).toBe(1);
    expect(parseMajorToMinor("19.99", "EUR")).toBe(1999);
  });

  test("zero-exponent currencies concatenate digits", () => {
    expect(parseMajorToMinor("5000", "BIF")).toBe(5000);
    expect(parseMajorToMinor("10000", "RWF")).toBe(10000);
  });

  test("accepts bare fractions and strips space/apostrophe groups", () => {
    expect(parseMajorToMinor(".5", "USD")).toBe(50);
    expect(parseMajorToMinor("1 234.50", "USD")).toBe(123450);
    expect(parseMajorToMinor("1'234.50", "USD")).toBe(123450);
    // A comma is a DECIMAL mark, not a thousands separator.
    expect(parseMajorToMinor("1,50", "USD")).toBe(150);
    expect(() => parseMajorToMinor("1,234.50", "USD")).toThrow(MoneyError);
  });

  test("rejects junk, negatives and zero", () => {
    expect(() => parseMajorToMinor("abc", "USD")).toThrow(MoneyError);
    expect(() => parseMajorToMinor("-5", "USD")).toThrow(MoneyError);
    expect(() => parseMajorToMinor("0", "USD")).toThrow(MoneyError);
    expect(() => parseMajorToMinor("", "USD")).toThrow(MoneyError);
  });

  test("rejects more precision than the currency has", () => {
    expect(() => parseMajorToMinor("10.005", "USD")).toThrow(
      /at most 2 decimal/,
    );
    expect(() => parseMajorToMinor("1.5", "BIF")).toThrow(
      /at most 0 decimal/,
    );
  });

  test("rejects unsupported currencies and overflow", () => {
    expect(() => parseMajorToMinor("1", "XYZ")).toThrow(/Unsupported/);
    expect(() => parseMajorToMinor("9".repeat(30), "USD")).toThrow(
      /out of range/,
    );
    expect(() => parseMajorToMinor(String(MAX_AMOUNT_MINOR + 1), "BIF")).toThrow(
      /out of range/,
    );
  });
});

describe("minorToMajorString", () => {
  test("splits by the currency exponent", () => {
    expect(minorToMajorString(1999, "USD")).toBe("19.99");
    expect(minorToMajorString(5, "USD")).toBe("0.05");
    expect(minorToMajorString(10000, "BIF")).toBe("10000");
  });

  test("round-trips through parseMajorToMinor", () => {
    for (const [major, currency] of [
      ["10.00", "USD"],
      ["0.07", "USD"],
      ["123456", "BIF"],
      ["999.99", "EUR"],
    ] as const) {
      expect(parseMajorToMinor(major, currency)).toBe(
        parseMajorToMinor(minorToMajorString(parseMajorToMinor(major, currency), currency), currency),
      );
    }
  });
});

describe("formatMoney", () => {
  test("groups the exact integer and appends the code", () => {
    expect(formatMoney(1234567, "USD", "en-US")).toBe("12,345.67 USD");
    expect(formatMoney(10000, "BIF", "en-US")).toBe("10,000 BIF");
  });

  test("falls back to plain output for unknown currencies", () => {
    expect(formatMoney(123, "XYZ")).toBe("123 XYZ");
  });
});

describe("guards", () => {
  test("isAmountMinor accepts only positive safe integers within bounds", () => {
    expect(isAmountMinor(100)).toBe(true);
    expect(isAmountMinor(MAX_AMOUNT_MINOR)).toBe(true);
    expect(isAmountMinor(-5)).toBe(false);
    expect(isAmountMinor(0)).toBe(false);
    expect(isAmountMinor(1.5)).toBe(false);
    expect(isAmountMinor("100")).toBe(false);
    expect(isAmountMinor(MAX_AMOUNT_MINOR + 1)).toBe(false);
    expect(isAmountMinor(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });

  test("sumMinor adds integers and refuses drift", () => {
    expect(sumMinor([1, 2, 3])).toBe(6);
    expect(sumMinor([])).toBe(0);
    expect(() => sumMinor([1.5])).toThrow(MoneyError);
  });
});
