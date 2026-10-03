/**
 * Admin wallet read models — the data layer behind /admin/wallets,
 * /admin/transactions and the transaction detail view.
 *
 * Server-only, same discipline as `lib/admin/queries.ts`: pagination
 * and filtering happen SQL-side, balances are SUMMED from the ledger
 * (never cached), and every transaction row carries its owner so the
 * console can answer « whose money is this » without a second hop.
 */

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import {
  ledgerEntries,
  reconciliationRecords,
  wallets,
  walletTransactions,
} from "@/lib/db/schema/wallet";
import { toAmount } from "@/lib/wallet/ledger";
import { getEventsForTransaction } from "@/lib/wallet/events";
import type { WalletTransactionType } from "@/lib/wallet/constants";

export interface AdminWalletListRow {
  id: string;
  userId: string;
  currency: string;
  status: string;
  createdAt: Date;
  ownerEmail: string | null;
  ownerName: string | null;
  balanceMinor: number;
}

export interface AdminWalletList {
  rows: AdminWalletListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** All wallets across the platform, newest first, with live balance. */
export async function listWalletsAdmin(options: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<AdminWalletList> {
  const query = options.search?.trim();
  const where = query
    ? or(
        ilike(user.email, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(wallets.id, `%${query}%`),
      )
    : undefined;

  const [totalRows, rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(wallets)
      .leftJoin(user, eq(wallets.userId, user.id))
      .where(where),
    db
      .select({
        id: wallets.id,
        userId: wallets.userId,
        currency: wallets.currency,
        status: wallets.status,
        createdAt: wallets.createdAt,
        ownerEmail: user.email,
        ownerName: user.name,
        // Live ledger sum — external/system legs carry no walletId, so
        // summing by wallet matches getBalanceMinor exactly.
        balance: sql<string | null>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
      })
      .from(wallets)
      .leftJoin(user, eq(wallets.userId, user.id))
      .leftJoin(ledgerEntries, eq(ledgerEntries.walletId, wallets.id))
      .where(where)
      .groupBy(wallets.id, user.id)
      .orderBy(desc(wallets.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => ({
      ...row,
      balanceMinor: toAmount(row.balance),
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

export interface AdminTransactionFilters {
  page: number;
  pageSize: number;
  type?: WalletTransactionType;
  status?: string;
  provider?: string;
  search?: string;
}

export interface AdminTransactionListRow {
  transaction: typeof walletTransactions.$inferSelect;
  ownerEmail: string | null;
}

export interface AdminTransactionList {
  rows: AdminTransactionListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Every transaction across the platform, newest first. */
export async function listTransactionsAdmin(
  filters: AdminTransactionFilters,
): Promise<AdminTransactionList> {
  const conditions = [];
  if (filters.type) {
    conditions.push(eq(walletTransactions.type, filters.type));
  }
  if (filters.status) {
    conditions.push(eq(walletTransactions.status, filters.status));
  }
  if (filters.provider) {
    conditions.push(eq(walletTransactions.provider, filters.provider));
  }
  const query = filters.search?.trim();
  if (query) {
    const needle = `%${query}%`;
    conditions.push(
      or(
        ilike(walletTransactions.id, needle),
        ilike(walletTransactions.providerTransactionId, needle),
        ilike(walletTransactions.idempotencyKey, needle),
        ilike(user.email, needle),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRows, rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .leftJoin(user, eq(wallets.userId, user.id))
      .where(where),
    db
      .select({ tx: walletTransactions, ownerEmail: user.email })
      .from(walletTransactions)
      .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
      .leftJoin(user, eq(wallets.userId, user.id))
      .where(where)
      .orderBy(desc(walletTransactions.createdAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => ({ transaction: row.tx, ownerEmail: row.ownerEmail })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

export interface AdminTransactionDetail {
  transaction: typeof walletTransactions.$inferSelect;
  ownerEmail: string | null;
  ownerName: string | null;
  ledger: Array<typeof ledgerEntries.$inferSelect>;
  events: Awaited<ReturnType<typeof getEventsForTransaction>>;
  issues: Array<typeof reconciliationRecords.$inferSelect>;
}

/** Full audit view of one transaction (owner, ledger, webhooks, issues). */
export async function getTransactionDetailAdmin(
  transactionId: string,
): Promise<AdminTransactionDetail | null> {
  const rows = await db
    .select({
      tx: walletTransactions,
      ownerEmail: user.email,
      ownerName: user.name,
    })
    .from(walletTransactions)
    .innerJoin(wallets, eq(walletTransactions.walletId, wallets.id))
    .leftJoin(user, eq(wallets.userId, user.id))
    .where(eq(walletTransactions.id, transactionId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [ledger, events, issues] = await Promise.all([
    db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.transactionId, transactionId))
      .orderBy(ledgerEntries.createdAt),
    getEventsForTransaction(transactionId),
    db
      .select()
      .from(reconciliationRecords)
      .where(eq(reconciliationRecords.transactionId, transactionId))
      .orderBy(desc(reconciliationRecords.detectedAt)),
  ]);

  return {
    transaction: row.tx,
    ownerEmail: row.ownerEmail,
    ownerName: row.ownerName,
    ledger,
    events,
    issues,
  };
}
