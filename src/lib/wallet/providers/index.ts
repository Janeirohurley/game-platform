/**
 * Provider registration — THE file to touch when a new payment rail
 * arrives.
 *
 *   1. implement `PaymentProvider` (extend BasePaymentProvider),
 *   2. add its constructor to BUILTIN below,
 *   3. configure it (provider_configs row / environment secrets).
 *
 * The wallet core, the engine, the routes and the UI never change —
 * they read adapters from the registry (lib/wallet/provider-config.ts
 * merges adapters with their runtime configuration).
 */

import { paymentProviderRegistry } from "./registry";
import { SandboxMobileMoneyProvider } from "./sandbox-momo";

/** One entry per built-in adapter, in registration order. */
const BUILTIN: (() => import("./types").PaymentProvider)[] = [
  () => new SandboxMobileMoneyProvider(),
];

let initialized = false;

/**
 * Idempotent: importing this module registers every built-in adapter
 * once per process. Adapters already present (tests registering their
 * own) are left alone.
 */
export function ensureBuiltinProviders(): void {
  if (initialized) return;
  initialized = true;
  for (const create of BUILTIN) {
    const provider = create();
    const id = provider.getProviderInfo().id;
    if (!paymentProviderRegistry.has(id)) {
      paymentProviderRegistry.register(provider);
    }
  }
}

// Import-time registration (see docblock).
ensureBuiltinProviders();

export { paymentProviderRegistry, PaymentProviderRegistry } from "./registry";
export { BasePaymentProvider } from "./base";
export { SandboxMobileMoneyProvider, SANDBOX_MOMO_ID } from "./sandbox-momo";
export * from "./types";
