import { describe, expect, it } from "bun:test";

import { signedMoney } from "./wallet-shared";

// The display minus is the typographic U+2212, matching formatMoney's
// own negative rendering rather than an ASCII hyphen.
const MINUS = "\u2212";

describe("signedMoney", () => {
  it("credits a deposit (fallback when no ledger delta is present)", () => {
    expect(signedMoney({ type: "deposit", grossAmount: 1000 }, "USD")).toBe(
      "+10.00 USD",
    );
  });

  it("debits a withdrawal (fallback when no ledger delta is present)", () => {
    expect(signedMoney({ type: "withdrawal", grossAmount: 1000 }, "USD")).toBe(
      `${MINUS}10.00 USD`,
    );
  });

  it("credits a payout from its wallet ledger delta, not its type", () => {
    expect(
      signedMoney(
        { type: "payout", grossAmount: 1000, walletDeltaMinor: 900 },
        "USD",
      ),
    ).toBe("+9.00 USD");
  });

  it("credits a stake refund from its wallet ledger delta", () => {
    expect(
      signedMoney(
        { type: "refund", grossAmount: 500, walletDeltaMinor: 500 },
        "USD",
      ),
    ).toBe("+5.00 USD");
  });

  it("debits a deposit refund from its wallet ledger delta", () => {
    expect(
      signedMoney(
        { type: "refund", grossAmount: 500, walletDeltaMinor: -500 },
        "USD",
      ),
    ).toBe(`${MINUS}5.00 USD`);
  });

  it("shows the notional amount unsigned when the wallet is untouched", () => {
    expect(
      signedMoney(
        { type: "stake", grossAmount: 250, walletDeltaMinor: 0 },
        "USD",
      ),
    ).toBe("2.50 USD");
  });
});
