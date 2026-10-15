/**
 * ledger.ts — PURE posting builders. These tests pin the game-stake
 * accounting BEFORE any database code runs:
 *   - every posting sums to exactly ZERO (the double-entry invariant);
 *   - the pot can never be short or over (payouts + rake = pot);
 *   - a refund is the exact inverse of its hold (no money created);
 *   - escrow legs are system legs (no walletId), wallet legs carry one.
 */

import { describe, expect, test } from "bun:test";

import {
  assertBalanced,
  invert,
  payoutPosting,
  stakePosting,
  stakeRefundPosting,
  type Posting,
  type PostingLeg,
} from "./ledger";
import { WalletError } from "./errors";

/** Sum of a posting's legs — must be 0 for a valid posting. */
function sum(posting: Posting): number {
  return posting.legs.reduce((total, leg) => total + leg.amountMinor, 0);
}

function leg(
  posting: Posting,
  account: string,
  walletId: string | null = null,
): PostingLeg | undefined {
  return posting.legs.find(
    (l) => l.account === account && l.walletId === walletId,
  );
}

describe("assertBalanced", () => {
  test("accepts a balanced posting", () => {
    expect(() =>
      assertBalanced({
        legs: [
          { account: "wallet", walletId: "w1", amountMinor: -500 },
          { account: "escrow:r1", walletId: null, amountMinor: 500 },
        ],
      }),
    ).not.toThrow();
  });

  test("rejects an unbalanced posting", () => {
    expect(() =>
      assertBalanced({
        legs: [
          { account: "wallet", walletId: "w1", amountMinor: -500 },
          { account: "escrow:r1", walletId: null, amountMinor: 499 },
        ],
      }),
    ).toThrow(WalletError);
  });

  test("rejects zero, fractional and non-safe leg amounts", () => {
    expect(() =>
      assertBalanced({
        legs: [
          { account: "wallet", walletId: "w1", amountMinor: 0 },
          { account: "escrow:r1", walletId: null, amountMinor: 0 },
        ],
      }),
    ).toThrow(WalletError);
    expect(() =>
      assertBalanced({
        legs: [
          { account: "wallet", walletId: "w1", amountMinor: -1.5 },
          { account: "escrow:r1", walletId: null, amountMinor: 1.5 },
        ],
      }),
    ).toThrow(WalletError);
  });
});

describe("stakePosting", () => {
  test("moves the stake from the wallet into escrow", () => {
    const posting = stakePosting({ walletId: "w1", roomId: "r1", amountMinor: 1000 });
    expect(sum(posting)).toBe(0);
    expect(posting.legs).toHaveLength(2);
    expect(leg(posting, "wallet", "w1")?.amountMinor).toBe(-1000);
    expect(leg(posting, "escrow:r1")?.amountMinor).toBe(1000);
    // Escrow is a system account: it carries NO walletId.
    expect(leg(posting, "escrow:r1")?.walletId).toBeNull();
  });
});

describe("payoutPosting", () => {
  test("winner takes the whole pot when rake is zero", () => {
    const posting = payoutPosting({
      roomId: "r1",
      potMinor: 2000,
      rakeMinor: 0,
      payouts: [{ walletId: "winner", amountMinor: 2000 }],
    });
    expect(sum(posting)).toBe(0);
    expect(leg(posting, "escrow:r1")?.amountMinor).toBe(-2000);
    expect(leg(posting, "wallet", "winner")?.amountMinor).toBe(2000);
    // No rake → no platform fee leg at all.
    expect(leg(posting, "fees:platform")).toBeUndefined();
  });

  test("rake is carved out of the pot to the platform", () => {
    const posting = payoutPosting({
      roomId: "r1",
      potMinor: 2000,
      rakeMinor: 100,
      payouts: [{ walletId: "winner", amountMinor: 1900 }],
    });
    expect(sum(posting)).toBe(0);
    expect(leg(posting, "wallet", "winner")?.amountMinor).toBe(1900);
    expect(leg(posting, "fees:platform")?.amountMinor).toBe(100);
  });

  test("splits a shared pot across several winners", () => {
    const posting = payoutPosting({
      roomId: "r1",
      potMinor: 3000,
      rakeMinor: 0,
      payouts: [
        { walletId: "a", amountMinor: 1500 },
        { walletId: "b", amountMinor: 1500 },
      ],
    });
    expect(sum(posting)).toBe(0);
    expect(leg(posting, "wallet", "a")?.amountMinor).toBe(1500);
    expect(leg(posting, "wallet", "b")?.amountMinor).toBe(1500);
  });

  test("refuses a pot that does not close exactly (no mint, no burn)", () => {
    expect(() =>
      payoutPosting({
        roomId: "r1",
        potMinor: 2000,
        rakeMinor: 0,
        payouts: [{ walletId: "winner", amountMinor: 1900 }],
      }),
    ).toThrow(/does not close the pot/);
    expect(() =>
      payoutPosting({
        roomId: "r1",
        potMinor: 2000,
        rakeMinor: 200,
        payouts: [{ walletId: "winner", amountMinor: 1900 }],
      }),
    ).toThrow(/does not close the pot/);
  });
});

describe("stakeRefundPosting", () => {
  test("is the exact inverse of the hold", () => {
    const hold = stakePosting({ walletId: "w1", roomId: "r1", amountMinor: 1000 });
    const refund = stakeRefundPosting({ walletId: "w1", roomId: "r1", amountMinor: 1000 });
    expect(sum(refund)).toBe(0);
    expect(refund).toEqual(invert(hold));
    expect(leg(refund, "wallet", "w1")?.amountMinor).toBe(1000);
    expect(leg(refund, "escrow:r1")?.amountMinor).toBe(-1000);
  });
});
