/**
 * BasePaymentProvider — the graceful-rejection rule lives HERE:
 * calling an UNDECLARED capability fails with a typed
 * `capability_not_supported` before any I/O, while a DECLARED but
 * not-overridden method fails as `provider_error` (a bug the shared
 * contract tests catch).
 */

import { describe, expect, test } from "bun:test";

import { BasePaymentProvider } from "./base";
import {
  ProviderError,
  type ProviderCreateWithdrawalInput,
  type ProviderInfo,
} from "./types";

class DepositOnlyProvider extends BasePaymentProvider {
  getProviderInfo(): ProviderInfo {
    return {
      id: "deposit-only",
      name: "Deposit Only",
      environment: "sandbox",
      capabilities: ["DEPOSIT"],
      supportedCurrencies: ["BIF"],
    };
  }
}

const withdrawalInput = {} as ProviderCreateWithdrawalInput;

describe("BasePaymentProvider", () => {
  test("supports() reflects the declared capabilities", () => {
    const provider = new DepositOnlyProvider();
    expect(provider.supports("DEPOSIT")).toBe(true);
    expect(provider.supports("WITHDRAWAL")).toBe(false);
    expect(provider.supports("REFUND")).toBe(false);
  });

  test("requireCapability rejects UNDECLARED capabilities with a typed error", () => {
    const provider = new DepositOnlyProvider();
    try {
      provider.requireCapability("WITHDRAWAL");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("capability_not_supported");
    }
  });

  test("an undeclared operation rejects BEFORE any I/O", async () => {
    const provider = new DepositOnlyProvider();
    try {
      await provider.createWithdrawal(withdrawalInput);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("capability_not_supported");
    }
  });

  test("a DECLARED but un-overridden method fails as provider_error (contract bug)", async () => {
    const provider = new DepositOnlyProvider();
    // DEPOSIT is declared, but the default implementation was kept —
    // requireCapability passes, notImplemented fires.
    try {
      await provider.createDeposit({} as never);
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("provider_error");
    }
  });

  test("availability defaults to true (config layer gates on top)", async () => {
    const provider = new DepositOnlyProvider();
    expect(await provider.checkAvailability()).toEqual({ available: true });
  });
});
