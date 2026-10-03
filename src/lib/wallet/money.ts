/**
 * Money math — INTEGER MINOR UNITS ONLY.
 *
 * Every amount in the wallet domain is a safe integer count of minor
 * units (10000 BIF, 1999 = 19.99 USD). Nothing in this module ever
 * multiplies, divides or adds fractional money with floats:
 *
 *  - parsing a user string goes through BigInt/string slicing,
 *  - formatting builds the decimal string and only hands EXACT
 *    integers to Intl for grouping,
 *  - fee math (see fees.ts) runs in BigInt.
 */

import { currencyExponent, type CurrencyCode } from "./currencies";

/** Largest amount we accept anywhere (well below 2^53, fee-safe). */
export const MAX_AMOUNT_MINOR = 9_000_000_000_000_000; // 9e15 minor units

export class MoneyError extends Error {}

export function isAmountMinor(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_AMOUNT_MINOR
  );
}

export function assertAmountMinor(value: unknown): asserts value is number {
  if (!isAmountMinor(value)) {
    throw new MoneyError(
      `Amount must be an integer of minor units between 1 and ${MAX_AMOUNT_MINOR}`,
    );
  }
}

/**
 * Parse a human decimal string ("19.99", "10 000", "10000") into minor
 * units for a currency. String-based: no float ever enters.
 */
export function parseMajorToMinor(input: string, currency: string): number {
  const exponent = currencyExponent(currency);
  if (exponent === null) {
    throw new MoneyError(`Unsupported currency: ${currency}`);
  }

  const cleaned = input.trim().replace(/[\s\xA0']/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$|^\d*\.\d+$/.test(cleaned)) {
    throw new MoneyError(`Invalid amount: ${input}`);
  }

  const [wholeRaw = "0", fractionRaw = ""] = cleaned.split(".");
  if (fractionRaw.length > exponent) {
    throw new MoneyError(
      `${currency} supports at most ${exponent} decimal place(s)`,
    );
  }
  const fraction = fractionRaw.padEnd(exponent, "0");
  const minor = BigInt(wholeRaw + fraction); // pure integer concatenation
  if (minor <= BigInt(0) || minor > BigInt(MAX_AMOUNT_MINOR)) {
    throw new MoneyError("Amount out of range");
  }
  return Number(minor);
}

/**
 * Minor units → plain decimal string WITHOUT grouping ("1999" USD →
 * "19.99"; 10000 BIF → "10000"). Pure string construction.
 */
export function minorToMajorString(minor: number, currency: string): string {
  const exponent = currencyExponent(currency);
  if (exponent === null) {
    throw new MoneyError("Unsupported currency: " + currency);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError("Amount must be a safe integer of minor units");
  }
  const negative = minor < 0;
  const digits = Math.abs(minor).toString().padStart(exponent + 1, "0");
  const whole = digits.slice(0, digits.length - exponent) || "0";
  const fraction =
    exponent > 0 ? digits.slice(digits.length - exponent) : "";
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * Display formatting: locale grouping for the (exact, integer) whole
 * part, the fraction appended as text, code as suffix.
 * e.g. formatMoney(1234567, "USD") → "12,345.67 USD"
 *      formatMoney(10000, "BIF") → "10,000 BIF"
 */
export function formatMoney(
  minor: number,
  currency: string,
  locale = "fr-FR",
): string {
  const exponent = currencyExponent(currency);
  if (exponent === null) return `${minor} ${currency.toUpperCase()}`;

  const major = minorToMajorString(minor, currency);
  const [whole = "0", fraction = ""] = major.split(".");
  // Number(whole) is an EXACT integer (amounts are bounded far below
  // 2^53) — Intl only adds thousands separators, no precision is lost.
  const grouped = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(Number(whole));
  return fraction ? `${grouped}.${fraction} ${currency}` : `${grouped} ${currency}`;
}

/** Sum with an overflow guard (all values must already be integers). */
export function sumMinor(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new MoneyError("Non-integer amount in sum");
    }
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new MoneyError("Amount overflow");
    }
  }
  return total;
}

/** Strict currency code check (3 uppercase letters). */
export function isCurrencyCode(value: string): value is CurrencyCode {
  return /^[A-Z]{3}$/.test(value);
}
