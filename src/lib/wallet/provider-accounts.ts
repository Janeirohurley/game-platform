/**
 * Provider accounts — connecting EXTERNAL accounts to a wallet.
 *
 * A provider account stores only what identifies the external account:
 * provider id, external reference, type, masked display name, status.
 *
 * Never stored, anywhere: credentials, CVV, tokens, PINs — secrets
 * live in the environment (provider credentials) or not at all (user
 * credentials never leave the provider). The stored reference is
 * masked before it is ever shown or logged.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerAccounts, wallets } from "@/lib/db/schema/wallet";
import type { ConnectProviderInput } from "@/lib/validation/wallet";
import { WalletError } from "./errors";
import { ensureWallet, assertWalletOperable } from "./wallet";
import { requireActiveProvider } from "./provider-config";

export type ProviderAccountRow = typeof providerAccounts.$inferSelect;

/**
 * Mask an external reference for display/logging: `+25771234567` →
 * `+257•••••67`. The full reference stays in the database (it is the
 * identifier, not a secret) but never reaches a screen or a log.
 */
export function maskAccountRef(ref: string): string {
  const trimmed = ref.trim();
  if (trimmed.length <= 7) {
    return `••••${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}

export async function listProviderAccounts(
  walletId: string,
): Promise<ProviderAccountRow[]> {
  return db
    .select()
    .from(providerAccounts)
    .where(eq(providerAccounts.walletId, walletId))
    .orderBy(desc(providerAccounts.createdAt));
}

/**
 * Wire-safe projection for API responses: the external reference is
 * masked (it never reaches a screen), the row id stays — the client
 * needs it as `providerAccountId` when opening operations.
 */
export function toPublicAccount(account: ProviderAccountRow) {
  return {
    ...account,
    providerAccountId: maskAccountRef(account.providerAccountId),
  };
}

/**
 * Connect an external account to the user's default-currency wallet.
 * Idempotent per (wallet, provider, external ref): connecting twice
 * returns the same account row.
 */
export async function connectProviderAccount(input: {
  userId: string;
  provider: string;
  account: ConnectProviderInput;
}): Promise<ProviderAccountRow> {
  // The provider must be registered, enabled and available — you
  // cannot connect to a rail the platform does not offer.
  await requireActiveProvider({
    provider: input.provider,
    currency: input.account.currency ?? "BIF",
    capability: "DEPOSIT",
  });

  const wallet = await ensureWallet(input.userId, input.account.currency);
  assertWalletOperable(wallet);

  const displayName =
    input.account.displayName?.trim() || maskAccountRef(input.account.providerAccountId);

  const inserted = await db
    .insert(providerAccounts)
    .values({
      id: randomUUID(),
      walletId: wallet.id,
      provider: input.provider,
      providerAccountId: input.account.providerAccountId,
      accountType: input.account.accountType ?? "other",
      displayName,
      currency: input.account.currency ?? null,
      status: "active",
    })
    .onConflictDoNothing({
      target: [
        providerAccounts.walletId,
        providerAccounts.provider,
        providerAccounts.providerAccountId,
      ],
    })
    .returning();
  if (inserted[0]) return inserted[0];

  const existing = await db
    .select()
    .from(providerAccounts)
    .where(
      and(
        eq(providerAccounts.walletId, wallet.id),
        eq(providerAccounts.provider, input.provider),
        eq(providerAccounts.providerAccountId, input.account.providerAccountId),
      ),
    )
    .limit(1);
  if (!existing[0]) {
    throw new WalletError("internal", "Unable to connect the account.");
  }
  // Re-activating a previously disconnected account of the same ref.
  if (existing[0].status !== "active") {
    const [reactivated] = await db
      .update(providerAccounts)
      .set({ status: "active", displayName })
      .where(eq(providerAccounts.id, existing[0].id))
      .returning();
    return reactivated ?? existing[0];
  }
  return existing[0];
}

/**
 * Disconnect — status flip, never a delete: history that references
 * the account must stay readable.
 */
export async function disconnectProviderAccount(input: {
  userId: string;
  accountRowId: string;
}): Promise<ProviderAccountRow> {
  const rows = await db
    .select({ account: providerAccounts })
    .from(providerAccounts)
    .innerJoin(wallets, eq(providerAccounts.walletId, wallets.id))
    .where(
      and(
        eq(providerAccounts.id, input.accountRowId),
        eq(wallets.userId, input.userId),
      ),
    )
    .limit(1);
  const row = rows[0]?.account;
  if (!row) {
    throw new WalletError("not_found", "Provider account not found.");
  }
  if (row.status === "disconnected") return row;

  const [updated] = await db
    .update(providerAccounts)
    .set({ status: "disconnected" })
    .where(eq(providerAccounts.id, row.id))
    .returning();
  return updated ?? row;
}
