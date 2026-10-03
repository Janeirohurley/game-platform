/**
 * Wallet service — lazily-created internal accounts, independent from
 * any provider. A wallet is identified by (user, currency); its balance
 * is NEVER stored here, it is always derived from the ledger
 * (lib/wallet/ledger.ts).
 */

import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { wallets } from "@/lib/db/schema/wallet";
import { defaultWalletCurrency, normalizeCurrency } from "./currencies";
import { WalletError } from "./errors";

export type WalletRow = typeof wallets.$inferSelect;

/**
 * Get or create the user's wallet for a currency. Safe under
 * concurrency: insert … on conflict do nothing, then read — two
 * simultaneous first requests always converge on ONE row.
 */
export async function ensureWallet(
  userId: string,
  currency?: string,
): Promise<WalletRow> {
  const code = normalizeCurrency(currency ?? defaultWalletCurrency());
  if (!code) {
    throw new WalletError("validation", `Unsupported currency: ${currency}`);
  }

  const inserted = await db
    .insert(wallets)
    .values({
      id: randomUUID(),
      userId,
      currency: code,
    })
    .onConflictDoNothing({ target: [wallets.userId, wallets.currency] })
    .returning();
  if (inserted.length > 0) return inserted[0];

  const existing = await db
    .select()
    .from(wallets)
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, code)))
    .limit(1);
  if (!existing[0]) {
    throw new WalletError("internal", "Unable to create the wallet.");
  }
  return existing[0];
}

export async function getWalletById(walletId: string): Promise<WalletRow | null> {
  const rows = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId))
    .limit(1);
  return rows[0] ?? null;
}

/** The user's wallets (one per currency). */
export async function listWalletsForUser(userId: string): Promise<WalletRow[]> {
  return db.select().from(wallets).where(eq(wallets.userId, userId));
}

/** The user's wallet in a currency, or the default-currency one. */
export async function getWalletForUser(
  userId: string,
  currency?: string,
): Promise<WalletRow | null> {
  const code = currency ? normalizeCurrency(currency) : null;
  if (currency && !code) {
    throw new WalletError("validation", `Unsupported currency: ${currency}`);
  }
  const rows = code
    ? await db
        .select()
        .from(wallets)
        .where(and(eq(wallets.userId, userId), eq(wallets.currency, code)))
        .limit(1)
    : await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);
  return rows[0] ?? null;
}

/** Fail money movement on a frozen/closed wallet; reads stay allowed. */
export function assertWalletOperable(wallet: WalletRow): void {
  if (wallet.status !== "active") {
    throw new WalletError(
      "forbidden",
      `This wallet is ${wallet.status} and cannot move money.`,
    );
  }
}
