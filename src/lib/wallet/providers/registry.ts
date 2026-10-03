/**
 * PaymentProviderRegistry — the central catalogue of adapters.
 *
 * Mirrors the platform's game registry pattern: a module-level
 * singleton the app registers adapters into. Adding a provider =
 * implement `PaymentProvider` + one `register()` call (see
 * providers/index.ts) — the wallet core is never touched.
 *
 * The registry holds ADAPTERS only. Runtime enable/disable, limits and
 * fees live in the database (provider_configs, see
 * lib/wallet/provider-config.ts) so configuration changes need no
 * deploy — and configuration can only NARROW what an adapter declares,
 * never widen it.
 */

import { ProviderError, type PaymentProvider } from "./types";

export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  register(provider: PaymentProvider): void {
    const { id } = provider.getProviderInfo();
    if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw new Error(`Invalid provider id: "${id}"`);
    }
    if (this.providers.has(id)) {
      throw new Error(`Provider "${id}" is already registered`);
    }
    this.providers.set(id, provider);
  }

  /** Typed lookup — undefined when the provider is unknown. */
  get(id: string): PaymentProvider | undefined {
    return this.providers.get(id);
  }

  /** Throwing lookup for call sites that must have one. */
  require(id: string): PaymentProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderError(
        "unavailable",
        `Unknown payment provider "${id}"`,
      );
    }
    return provider;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  list(): PaymentProvider[] {
    return [...this.providers.values()];
  }

  ids(): string[] {
    return [...this.providers.keys()];
  }

  /** Test seam — never called by application code. */
  clear(): void {
    this.providers.clear();
  }
}

/** Process-wide registry instance. */
export const paymentProviderRegistry = new PaymentProviderRegistry();
