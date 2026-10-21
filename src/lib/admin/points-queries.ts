/**
 * Admin read models for the manual points layer.
 *
 * Balances are ALWAYS summed live from `ledger_entries` — there is no
 * cached balance column to drift. Reads never lock and never mutate.
 */

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import { withdrawalRequests } from "@/lib/db/schema/points";
import { ledgerEntries, wallets } from "@/lib/db/schema/wallet";
import { toAmount } from "@/lib/wallet/ledger";
import { POINTS_CURRENCY } from "@/lib/wallet/points-types";

export interface UserBalanceRow {
  userId: string;
  email: string;
  name: string;
  gamerTag: string | null;
  walletId: string | null;
  balanceMinor: number;
}

export interface UserBalancePage {
  rows: UserBalanceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function searchFilter(search?: string) {
  if (!search) return sql`true`;
  const like = `%${search}%`;
  return or(
    ilike(user.email, like),
    ilike(user.name, like),
    ilike(profiles.username, like),
  );
}

/** Every user with their live point balance (0 when no wallet yet). */
export async function listUsersWithBalance(options: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<UserBalancePage> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
  const search = options.search?.trim() || undefined;

  const rows = await db
    .select({
      userId: user.id,
      email: user.email,
      name: user.name,
      gamerTag: profiles.username,
      walletId: wallets.id,
      balanceMinor: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(
      wallets,
      and(
        eq(wallets.userId, user.id),
        eq(wallets.currency, POINTS_CURRENCY),
      ),
    )
    .leftJoin(ledgerEntries, eq(ledgerEntries.walletId, wallets.id))
    .where(searchFilter(search))
    .groupBy(user.id, user.email, user.name, profiles.username, wallets.id)
    .orderBy(desc(sql`coalesce(sum(${ledgerEntries.amountMinor}), 0)`))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<string>`count(distinct ${user.id})::bigint` })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(searchFilter(search));
  const total = toAmount(countRows[0]?.count ?? 0);

  return {
    rows: rows.map((row) => ({
      userId: row.userId,
      email: row.email,
      name: row.name,
      gamerTag: row.gamerTag ?? null,
      walletId: row.walletId,
      balanceMinor: toAmount(row.balanceMinor),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** One user's point balance (0 when the wallet does not exist yet). */
export async function getUserBalance(userId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
    .where(and(eq(wallets.userId, userId), eq(wallets.currency, POINTS_CURRENCY)));
  return toAmount(rows[0]?.total ?? 0);
}

export interface PointsOverview {
  users: number;
  pointsInCirculation: number;
  pendingWithdrawals: number;
  pendingWithdrawalPoints: number;
}

/** KPI strip for the points console. */
export async function getPointsOverview(): Promise<PointsOverview> {
  const [users, circulation, pending] = await Promise.all([
    db.select({ count: sql<string>`count(*)::bigint` }).from(user),
    db
      .select({
        total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
      })
      .from(ledgerEntries)
      .innerJoin(wallets, eq(wallets.id, ledgerEntries.walletId))
      .where(eq(wallets.currency, POINTS_CURRENCY)),
    db
      .select({
        count: sql<string>`count(*)::bigint`,
        amount: sql<string>`coalesce(sum(${withdrawalRequests.amountMinor}), 0)::bigint`,
      })
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.status, "pending")),
  ]);

  return {
    users: toAmount(users[0]?.count ?? 0),
    pointsInCirculation: toAmount(circulation[0]?.total ?? 0),
    pendingWithdrawals: toAmount(pending[0]?.count ?? 0),
    pendingWithdrawalPoints: toAmount(pending[0]?.amount ?? 0),
  };
}
