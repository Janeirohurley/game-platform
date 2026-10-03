/**
 * registry — the catalogue every layer reads adapters from. Adding a
 * provider is one `register()`; these tests pin the invariants that
 * make that safe (validated ids, no silent double registration,
 * typed lookups).
 */

import { describe, expect, test } from "bun:test";

import { BasePaymentProvider } from "./base";
import { PaymentProviderRegistry } from "./registry";
import { ProviderError, type ProviderInfo } from "./types";

function info(id: string): ProviderInfo {
  return {
    id,
    name: `Provider ${id}`,
    environment: "sandbox",
    capabilities: ["DEPOSIT"],
    supportedCurrencies: ["BIF"],
  };
}

class FakeProvider extends BasePaymentProvider {
  constructor(private readonly providerInfo: ProviderInfo) {
    super();
  }
  getProviderInfo(): ProviderInfo {
    return this.providerInfo;
  }
}

describe("PaymentProviderRegistry", () => {
  test("register → get/has/ids/list", () => {
    const registry = new PaymentProviderRegistry();
    const provider = new FakeProvider(info("fake-rail"));
    registry.register(provider);

    expect(registry.has("fake-rail")).toBe(true);
    expect(registry.get("fake-rail")).toBe(provider);
    expect(registry.ids()).toEqual(["fake-rail"]);
    expect(registry.list()).toEqual([provider]);
    expect(registry.get("nope")).toBeUndefined();
  });

  test("rejects malformed provider ids", () => {
    const registry = new PaymentProviderRegistry();
    expect(() => registry.register(new FakeProvider(info("")))).toThrow(
      /Invalid provider id/,
    );
    expect(() => registry.register(new FakeProvider(info("Bad_Id")))).toThrow(
      /Invalid provider id/,
    );
    expect(() => registry.register(new FakeProvider(info("-leading")))).toThrow(
      /Invalid provider id/,
    );
  });

  test("never silently double-registers", () => {
    const registry = new PaymentProviderRegistry();
    registry.register(new FakeProvider(info("dup-rail")));
    expect(() => registry.register(new FakeProvider(info("dup-rail")))).toThrow(
      /already registered/,
    );
  });

  test("require() throws a typed ProviderError for unknown ids", () => {
    const registry = new PaymentProviderRegistry();
    try {
      registry.require("ghost");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("unavailable");
    }
  });

  test("clear() empties the catalogue (test seam)", () => {
    const registry = new PaymentProviderRegistry();
    registry.register(new FakeProvider(info("temp-rail")));
    registry.clear();
    expect(registry.ids()).toEqual([]);
    expect(registry.has("temp-rail")).toBe(false);
  });
});
