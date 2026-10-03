/**
 * Wallet read model — server-side queries for the wallet UI and the
 * API routes (same discipline as lib/profile/queries.ts: reads live
 * here, never in components).
 *
 * Every list is paginated SQL-side; every balance is derived from the
 * ledger at read time (lib/wallet/ledger.ts).
 */

import { and, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  providerAccounts,
  walletTransactions,
  wallets,
} from "@/lib/db/schema/wallet";
import type { TransactionFilter } from "@/lib/validation/wallet";
import { getBalanceMinor, getLedgerForTransaction } from "./ledger";
import { getEventsForTransaction } from "./events";
import { defaultWalletCurrency } from "./currencies";
import { ensureWallet, type WalletRow } from "./wallet";
import type { TransactionRow } from "./engine";

export interface WalletOverview {
  wallet: WalletRow;
  balanceMinor: number;
}

/** The user's wallet for the default currency, created on first view. */
export async function getWalletOverview(
  userId: string,
  currency?: string,
): Promise<WalletOverview> {
  const wallet = await ensureWallet(userId, currency ?? defaultWalletCurrency());
  const balanceMinor = await getBalanceMinor(wallet.id);
  return { wallet, balanceMinor };
}

export interface TransactionListResult {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** One page of a user's transactions, newest first, with filters. */
export async function listTransactionsForUser(
  userId: string,
  filter: TransactionFilter,
): Promise<TransactionListResult> {
  const conditions = [
    eq(wallets.userId, userId),
  ];
  if (filter.type) conditions.push(eq(walletTransactions.type, filter.type));
  if (filter.status) conditions.push(eq(walletTransactions.status, filter.status));
  if (filter.provider) {
    conditions.push(eq(walletTransactions.provider, filter.provider));
  }
  if (filter.currency) {
    conditions.push(eq(walletTransactions.currency, filter.currency));
  }
  if (filter.search) {
    const needle = `%${filter.search}%`;
    conditions.push(
      or(
        ilike(walletTransactions.id, needle),
        ilike(walletTransactions.providerTransactionId, needle),
        ilike(walletTransactions.idempotencyKey, needle),
      )!,
    );
  }
  const where = and(...conditions);

  const [totalRows, rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .where(where),
    db
      .select({ tx: walletTransactions })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .where(where)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => row.tx),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
  };
}

export interface TransactionDetail {
  transaction: TransactionRow;
  /** Ledger legs of this transaction (double-entry audit trail). */
  ledger: Awaited<ReturnType<typeof getLedgerForTransaction>>;
  /** Provider events that touched it (webhook audit trail). */
  events: Awaited<ReturnType<typeof getEventsForTransaction>>;
}

/** Full detail for the OWNER (ownership enforced via the wallet join). */
export async function getTransactionDetailForUser(
  userId: string,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const rows = await db
    .select({ tx: walletTransactions })
    .from(walletTransactions)
    .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
    .where(
      and(
        eq(walletTransactions.id, transactionId),
        eq(wallets.userId, userId),
      ),
    )
    .limit(1);
  if (!rows[0]) return null;

  const [ledger, events] = await Promise.all([
    getLedgerForTransaction(transactionId),
    getEventsForTransaction(transactionId),
  ]);
  return { transaction: rows[0].tx, ledger, events };
}

/** The user's connected provider accounts (across their wallets). */
export async function listProviderAccountsForUser(userId: string) {
  return db
    .select()
    .from(providerAccounts)
    .innerJoin(wallets, eq(providerAccounts.walletId, wallets.id))
    .where(eq(wallets.userId, userId))
    .orderBy(desc(providerAccounts.createdAt));
}
