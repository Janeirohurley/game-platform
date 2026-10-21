/**
 * Wallet read model — server-side queries for the wallet UI and the
 * API routes (same discipline as lib/profile/queries.ts: reads live
 * here, never in components).
 *
 * Every list is paginated SQL-side; every balance is derived from the
 * ledger at read time (lib/wallet/ledger.ts).
 */

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ledgerEntries,
  walletTransactions,
  wallets,
} from "@/lib/db/schema/wallet";
import type { TransactionFilter } from "@/lib/validation/wallet";
import { getBalanceMinor, getLedgerForTransaction } from "./ledger";
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

/**
 * A transaction row plus the wallet's OWN ledger delta for it. The
 * delta is the source of truth for direction: a `payout` or a stake
 * `refund` CREDIT the wallet while a deposit `refund` DEBITS it, so
 * the sign can never be inferred from `type` alone.
 */
export type TransactionListRow = TransactionRow & { walletDeltaMinor: number };

export interface TransactionListResult {
  rows: TransactionListRow[];
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
  if (filter.currency) {
    conditions.push(eq(walletTransactions.currency, filter.currency));
  }
  if (filter.search) {
    const needle = `%${filter.search}%`;
    conditions.push(
      or(
        ilike(walletTransactions.id, needle),
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
      .select({
        tx: walletTransactions,
        walletDeltaMinor: sql<number>`coalesce((
          select sum(${ledgerEntries.amountMinor})
          from ${ledgerEntries}
          where ${ledgerEntries.transactionId} = ${walletTransactions.id}
            and ${ledgerEntries.walletId} = ${walletTransactions.walletId}
        ), 0)::bigint`,
      })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .where(where)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => ({
      ...row.tx,
      walletDeltaMinor: Number(row.walletDeltaMinor),
    })),
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

  const ledger = await getLedgerForTransaction(transactionId);
  return { transaction: rows[0].tx, ledger };
}
