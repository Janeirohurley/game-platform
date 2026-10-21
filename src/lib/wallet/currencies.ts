/**
 * Currency registry — explicit ISO-4217 metadata for every currency the
 * wallet can hold. The `exponent` is the number of MINOR units per
 * major unit (USD 19.99 → exponent 2 → 1999 minor units; BIF has no
 * minor unit → exponent 0 → 10000 BIF is 10000 minor units).
 *
 * Adding a currency = one entry here. The wallet never converts
 * between currencies — conversion would be a separate service/domain.
 */

export interface CurrencyInfo {
  code: string;
  /** Minor units per major unit is 10 ** exponent. */
  exponent: number;
  name: string;
}

export const CURRENCIES = {
  BIF: { code: "BIF", exponent: 0, name: "Burundian franc" },
  RWF: { code: "RWF", exponent: 0, name: "Rwandan franc" },
  UGX: { code: "UGX", exponent: 0, name: "Ugandan shilling" },
  USD: { code: "USD", exponent: 2, name: "US dollar" },
  EUR: { code: "EUR", exponent: 2, name: "Euro" },
  GBP: { code: "GBP", exponent: 2, name: "British pound" },
  KES: { code: "KES", exponent: 2, name: "Kenyan shilling" },
  TZS: { code: "TZS", exponent: 2, name: "Tanzanian shilling" },
  NGN: { code: "NGN", exponent: 2, name: "Nigerian naira" },
  ZAR: { code: "ZAR", exponent: 2, name: "South African rand" },
  /**
   * JET — internal play-money token backing game stakes (mises). It is NOT
   * an ISO-4217 currency and has NO payment provider: there is therefore no
   * rail to deposit or withdraw it, which is exactly the point — stakes in
   * JET carry no real-money exposure. It is always passed EXPLICITLY by the
   * caller (never chosen by default). A real-money stake would be a separate
   * asset with its own deposit/withdrawal surface (see docs/wallet-mises-jeux.md).
   */
  JET: { code: "JET", exponent: 0, name: "Game token" },
  /**
   * PTS — the platform's internal point currency. One point = one minor
   * unit (exponent 0), so every balance and amount is an integer with no
   * rounding. Points have no external rail: they are credited manually by
   * an administrator and withdrawn through a manual request workflow.
   */
  PTS: { code: "PTS", exponent: 0, name: "Platform points" },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Codes the platform knows, as a plain list (validation, dropdowns). */
export const SUPPORTED_CURRENCY_CODES = Object.keys(
  CURRENCIES,
) as CurrencyCode[];

/**
 * Default wallet currency. Overridable per deployment via
 * WALLET_DEFAULT_CURRENCY (validated at use site).
 */
export const DEFAULT_WALLET_CURRENCY: CurrencyCode = "PTS";

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(CURRENCIES, code.toUpperCase());
}

export function getCurrency(code: string): CurrencyInfo | null {
  return CURRENCIES[code.toUpperCase() as CurrencyCode] ?? null;
}

export function currencyExponent(code: string): number | null {
  return getCurrency(code)?.exponent ?? null;
}

/** Normalized (uppercase) code or null when unsupported. */
export function normalizeCurrency(code: string): CurrencyCode | null {
  const upper = code.toUpperCase();
  return isSupportedCurrency(upper) ? (upper as CurrencyCode) : null;
}

/** The deployment default, falling back to PTS when env is absent/invalid. */
export function defaultWalletCurrency(): CurrencyCode {
  const fromEnv = process.env.WALLET_DEFAULT_CURRENCY;
  if (fromEnv && isSupportedCurrency(fromEnv)) {
    return fromEnv.toUpperCase() as CurrencyCode;
  }
  return DEFAULT_WALLET_CURRENCY;
}
