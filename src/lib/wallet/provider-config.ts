/**
 * Provider configuration — merges registered ADAPTERS (code) with
 * provider_configs ROWS (database) into the "effective" view every
 * layer consumes.
 *
 *   effective = adapter declarations  ∩  database configuration
 *
 * Configuration can only NARROW what an adapter declares (disable it,
 * drop capabilities, restrict currencies, add limits/fees) — it can
 * never grant an adapter a capability it does not implement. Secrets
 * are read from the environment by the adapter itself, never from
 * these rows.
 *
 * Enabling/disabling a provider = flipping a row here; no code change,
 * no deploy.
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerConfigs } from "@/lib/db/schema/wallet";
import { WalletError } from "./errors";
import { computeFees, parseFeeSchedule, type FeeSchedule } from "./fees";
import {
  ensureBuiltinProviders,
  paymentProviderRegistry,
} from "./providers";
import { ProviderError } from "./providers/types";
import {
  isProviderCapability,
  type PaymentProvider,
  type ProviderCapability,
  type ProviderEnvironment,
  type ProviderInfo,
} from "./providers/types";

export interface EffectiveProviderConfig {
  id: string;
  /** Display name (config override, adapter name as fallback). */
  name: string;
  description?: string;
  environment: ProviderEnvironment;
  enabled: boolean;
  /** Adapter-side availability (credentials configured…). */
  available: boolean;
  unavailableReason?: string;
  /** Adapter's raw declarations (before config narrowing). */
  adapterCapabilities: readonly ProviderCapability[];
  /** What the wallet will actually allow: intersection with config. */
  capabilities: readonly ProviderCapability[];
  /** Currencies allowed after narrowing (adapter ∩ config). */
  supportedCurrencies: readonly string[];
  supportedCountries?: readonly string[];
  minimumAmount: number | null;
  maximumAmount: number | null;
  fees: FeeSchedule;
  /** Non-secret operational knobs (timeoutMs, expirySeconds…). */
  configuration: Record<string, unknown>;
}

function intersect<T>(a: readonly T[], b: readonly T[] | null): T[] {
  if (!b) return [...a];
  return a.filter((item) => b.includes(item));
}

function toEnvironment(value: unknown, fallback: ProviderEnvironment): ProviderEnvironment {
  return value === "production" || value === "sandbox" ? value : fallback;
}

/** Build the effective view for one adapter + its (optional) config row. */
async function toEffective(
  provider: PaymentProvider,
  row: (typeof providerConfigs.$inferSelect) | undefined,
  availability: { available: boolean; reason?: string },
): Promise<EffectiveProviderConfig> {
  const info: ProviderInfo = provider.getProviderInfo();

  // NULL = every capability the adapter declares (schema contract);
  // an explicit array — even an empty one — NARROWS to that set.
  const configCapabilities =
    row?.capabilities == null
      ? null
      : row.capabilities.filter(isProviderCapability);
  const capabilities = intersect(info.capabilities, configCapabilities);

  const configCurrencies = (row?.supportedCurrencies ?? [])
    .map((code) => code.toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code));
  const supportedCurrencies = intersect(
    info.supportedCurrencies.map((c) => c.toUpperCase()),
    configCurrencies.length > 0 ? configCurrencies : null,
  );

  return {
    id: info.id,
    name: row?.displayName?.trim() || info.name,
    description: info.description,
    environment: toEnvironment(row?.environment, info.environment),
    enabled: row?.enabled ?? true,
    available: availability.available,
    unavailableReason: availability.reason,
    adapterCapabilities: info.capabilities,
    capabilities,
    supportedCurrencies,
    supportedCountries:
      (row?.supportedCountries ?? []).length > 0
        ? (row?.supportedCountries ?? [])
        : info.supportedCountries,
    minimumAmount: row?.minimumAmount ?? null,
    maximumAmount: row?.maximumAmount ?? null,
    fees: parseFeeSchedule(row?.fees ?? null),
    configuration:
      row?.configuration && typeof row.configuration === "object"
        ? (row.configuration as Record<string, unknown>)
        : {},
  };
}

/**
 * Every registered provider with its effective configuration, for the
 * API/UI (dynamic provider selection) and the admin console.
 */
export async function listEffectiveProviders(): Promise<
  EffectiveProviderConfig[]
> {
  ensureBuiltinProviders();
  const providers = paymentProviderRegistry.list();
  if (providers.length === 0) return [];

  const rows = await db
    .select()
    .from(providerConfigs)
    .where(inArray(providerConfigs.provider, providers.map((p) => p.getProviderInfo().id)));
  const rowById = new Map(rows.map((row) => [row.provider, row]));

  // Sequential availability checks: adapters are cheap and this keeps
  // error attribution obvious (same discipline as the admin queries).
  const effective: EffectiveProviderConfig[] = [];
  for (const provider of providers) {
    const info = provider.getProviderInfo();
    let availability = { available: true } as {
      available: boolean;
      reason?: string;
    };
    try {
      availability = await provider.checkAvailability();
    } catch (error) {
      availability = {
        available: false,
        reason: error instanceof Error ? error.name : "Availability check failed",
      };
    }
    effective.push(
      await toEffective(provider, rowById.get(info.id), availability),
    );
  }
  return effective;
}

export async function getEffectiveProvider(
  id: string,
): Promise<EffectiveProviderConfig | null> {
  ensureBuiltinProviders();
  const provider = paymentProviderRegistry.get(id);
  if (!provider) return null;
  const row = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.provider, id))
    .limit(1);
  let availability = { available: true } as {
    available: boolean;
    reason?: string;
  };
  try {
    availability = await provider.checkAvailability();
  } catch (error) {
    availability = {
      available: false,
      reason: error instanceof Error ? error.name : "Availability check failed",
    };
  }
  return toEffective(provider, row[0], availability);
}

export interface ResolvedProvider {
  adapter: PaymentProvider;
  config: EffectiveProviderConfig;
}

/**
 * Wire-safe projection of an effective provider: everything the UI
 * needs to render "add money" / "withdraw" (availability, caps,
 * capabilities, fees) and NOTHING operational — no configuration
 * knobs, no adapter internals, no secrets (those never live here).
 */
export interface PublicProvider {
  id: string;
  name: string;
  description: string | null;
  environment: ProviderEnvironment;
  enabled: boolean;
  available: boolean;
  unavailableReason: string | null;
  capabilities: readonly ProviderCapability[];
  supportedCurrencies: readonly string[];
  minimumAmount: number | null;
  maximumAmount: number | null;
  fees: FeeSchedule;
  supportsDeposit: boolean;
  supportsWithdrawal: boolean;
  supportsConnect: boolean;
}

export function toPublicProvider(
  provider: EffectiveProviderConfig,
): PublicProvider {
  return {
    id: provider.id,
    name: provider.name,
    description: provider.description ?? null,
    environment: provider.environment,
    enabled: provider.enabled,
    available: provider.available,
    unavailableReason: provider.unavailableReason ?? null,
    capabilities: provider.capabilities,
    supportedCurrencies: provider.supportedCurrencies,
    minimumAmount: provider.minimumAmount,
    maximumAmount: provider.maximumAmount,
    fees: provider.fees,
    supportsDeposit: provider.capabilities.includes("DEPOSIT"),
    supportsWithdrawal: provider.capabilities.includes("WITHDRAWAL"),
    supportsConnect: provider.capabilities.includes("BALANCE_CHECK"),
  };
}

/**
 * The gate every money operation passes through: registered, enabled,
 * available, capable, currency allowed, amount within limits.
 * Throws a typed WalletError the routes render directly.
 */
export async function requireActiveProvider(input: {
  provider: string;
  currency: string;
  /** Capability the operation needs ("DEPOSIT", "WITHDRAWAL", "REFUND"). */
  capability: ProviderCapability;
  amountMinor?: number;
  /** Disabled providers can still settle/verify EXISTING operations. */
  allowDisabled?: boolean;
}): Promise<ResolvedProvider> {
  ensureBuiltinProviders();

  const adapter = paymentProviderRegistry.get(input.provider);
  const config = await getEffectiveProvider(input.provider);
  if (!adapter || !config) {
    throw new WalletError(
      "provider_unavailable",
      `Payment provider "${input.provider}" is not available.`,
      { provider: input.provider },
    );
  }
  if (!config.enabled && !input.allowDisabled) {
    throw new WalletError(
      "provider_unavailable",
      `${config.name} is currently unavailable.`,
      { provider: input.provider },
    );
  }
  if (!config.available) {
    throw new WalletError(
      "provider_unavailable",
      `${config.name} is temporarily unavailable.`,
      { provider: input.provider, reason: config.unavailableReason },
    );
  }
  if (!config.capabilities.includes(input.capability)) {
    throw new WalletError(
      "capability_not_supported",
      `${config.name} does not support ${input.capability}.`,
      { provider: input.provider, capability: input.capability },
    );
  }
  if (!config.supportedCurrencies.includes(input.currency)) {
    throw new WalletError(
      "validation",
      `${config.name} does not support ${input.currency}.`,
      { provider: input.provider, currency: input.currency },
    );
  }
  if (input.amountMinor !== undefined) {
    if (
      config.minimumAmount !== null &&
      input.amountMinor < config.minimumAmount
    ) {
      throw new WalletError(
        "validation",
        `Minimum amount is ${config.minimumAmount} minor units.`,
        { minimumAmount: config.minimumAmount },
      );
    }
    if (
      config.maximumAmount !== null &&
      input.amountMinor > config.maximumAmount
    ) {
      throw new WalletError(
        "validation",
        `Maximum amount is ${config.maximumAmount} minor units.`,
        { maximumAmount: config.maximumAmount },
      );
    }
  }

  return { adapter, config };
}

/**
 * Fee quote for a provider — the exact breakdown the UI shows before
 * confirmation (never hidden inside the amount).
 */
export async function quoteFees(input: {
  provider: string;
  type: "deposit" | "withdrawal";
  amountMinor: number;
  currency: string;
}) {
  const { config } = await requireActiveProvider({
    provider: input.provider,
    currency: input.currency,
    capability: input.type === "deposit" ? "DEPOSIT" : "WITHDRAWAL",
    amountMinor: input.amountMinor,
  });
  const fees = computeFees(input.amountMinor, config.fees);
  const gross = input.amountMinor;
  return {
    provider: config.id,
    providerName: config.name,
    type: input.type,
    currency: input.currency,
    grossAmount: gross,
    providerFee: fees.providerFee,
    platformFee: fees.platformFee,
    totalFee: fees.totalFee,
    /** deposit → credited to wallet; withdrawal → debited from wallet. */
    netAmount: input.type === "deposit" ? gross : gross + fees.totalFee,
    /** deposit → collected by the rail; withdrawal → delivered by the rail. */
    totalAmount: input.type === "deposit" ? gross + fees.totalFee : gross,
  };
}

/** Numeric config knob with bounds (adapters/engine read operational tweaks). */
export function readConfigInt(
  config: EffectiveProviderConfig,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = config.configuration[key];
  if (typeof raw === "number" && Number.isSafeInteger(raw)) {
    return Math.min(max, Math.max(min, raw));
  }
  return fallback;
}

/** Translate an adapter failure into the wallet taxonomy. */
export function mapProviderError(error: unknown): WalletError {
  if (error instanceof ProviderError) {
    switch (error.code) {
      case "capability_not_supported":
        return new WalletError("capability_not_supported", error.message);
      case "unavailable":
        return new WalletError("provider_unavailable", error.message);
      case "timeout":
        return new WalletError("provider_timeout", error.message);
      case "invalid_request":
        return new WalletError("validation", error.message);
      case "not_found":
        return new WalletError("not_found", error.message);
      case "verification_failed":
        return new WalletError("amount_mismatch", error.message);
      default:
        // Message may describe provider internals — keep it server-side
        // only if it came from OUR adapter (it did) — sandbox messages
        // are safe; real adapters must sanitize before throwing.
        return new WalletError("provider_error", error.message);
    }
  }
  if (error instanceof WalletError) return error;
  return new WalletError(
    "provider_error",
    "The payment provider could not be reached.",
  );
}
