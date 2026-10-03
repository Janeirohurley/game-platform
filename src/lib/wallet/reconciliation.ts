/**
 * Reconciliation — compares the INTERNAL LEDGER with PROVIDER-SIDE
 * records and RECORDS every discrepancy as a `reconciliation_records`
 * row. It never corrects financial history: fixing money is a human
 * decision made from the record, with the audit trail to match.
 *
 * Detected issue classes:
 *   ledger_imbalance             entries of one transaction don't sum to 0
 *   negative_balance             a wallet's ledger sum went below 0
 *   duplicate_transaction        one provider transaction used twice
 *   missing_provider_transaction internal op with no provider counterpart
 *   missing_ledger_transaction   provider op that never landed internally
 *   amount_mismatch              rail amount ≠ expected gross+fees
 *   currency_mismatch            currencies differ
 *   status_mismatch              provider and ledger disagree on outcome
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { db } from "@/lib/db";
import {
  ledgerEntries,
  reconciliationRecords,
  walletTransactions,
  wallets,
} from "@/lib/db/schema/wallet";
import { WalletError } from "./errors";
import { walletLog } from "./logger";
import { expectedRailAmount } from "./ledger";
import { ensureBuiltinProviders, paymentProviderRegistry } from "./providers";

export const RECONCILIATION_ISSUE_TYPES = [
  "missing_provider_transaction",
  "missing_ledger_transaction",
  "duplicate_transaction",
  "amount_mismatch",
  "currency_mismatch",
  "status_mismatch",
  "ledger_imbalance",
  "negative_balance",
] as const;

export type ReconciliationIssueType =
  (typeof RECONCILIATION_ISSUE_TYPES)[number];

export type ReconciliationSeverity = "info" | "warning" | "critical";

export interface RecordIssueInput {
  provider: string;
  issueType: ReconciliationIssueType;
  severity?: ReconciliationSeverity;
  transactionId?: string | null;
  providerTransactionId?: string | null;
  /** Sanitized evidence — ids and numbers only, never payloads. */
  details?: Record<string, unknown>;
}

/**
 * Stable fingerprint so repeated runs REPORT instead of duplicating:
 * one open record per (issue, provider, transaction, provider txn).
 */
export function buildDedupeKey(input: RecordIssueInput): string {
  return [
    input.issueType,
    input.provider,
    input.transactionId ?? "-",
    input.providerTransactionId ?? "-",
  ].join(":");
}

/** Insert an issue INSIDE an existing transaction (webhook path). */
export async function recordIssueInTx(
  tx: PostgresJsDatabase | Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0],
  input: RecordIssueInput,
): Promise<boolean> {
  const inserted = await tx
    .insert(reconciliationRecords)
    .values({
      id: randomUUID(),
      provider: input.provider,
      transactionId: input.transactionId ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      issueType: input.issueType,
      severity: input.severity ?? "warning",
      status: "open",
      details: input.details ?? null,
      dedupeKey: buildDedupeKey(input),
    })
    .onConflictDoNothing({ target: reconciliationRecords.dedupeKey })
    .returning({ id: reconciliationRecords.id });
  return inserted.length > 0;
}

/** Insert an issue outside any transaction (reconciliation runs). */
export async function recordIssue(
  input: RecordIssueInput,
): Promise<boolean> {
  const inserted = await db
    .insert(reconciliationRecords)
    .values({
      id: randomUUID(),
      provider: input.provider,
      transactionId: input.transactionId ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      issueType: input.issueType,
      severity: input.severity ?? "warning",
      status: "open",
      details: input.details ?? null,
      dedupeKey: buildDedupeKey(input),
    })
    .onConflictDoNothing({ target: reconciliationRecords.dedupeKey })
    .returning({ id: reconciliationRecords.id });
  return inserted.length > 0;
}

export interface ReconciliationRunSummary {
  provider: string;
  windowFrom: string;
  windowTo: string;
  /** Internal transactions inspected. */
  checkedInternal: number;
  /** Provider-side records inspected (0 when the adapter cannot list). */
  checkedProvider: number;
  /** New issues written (already-known issues are deduped). */
  issuesRecorded: number;
  durationMs: number;
}

/**
 * Run every check for one provider over a time window. Ledger-side
 * checks always run; provider-side listing runs when the adapter
 * declares RECONCILIATION.
 */
export async function runReconciliation(input: {
  provider: string;
  from?: Date;
  to?: Date;
}): Promise<ReconciliationRunSummary> {
  ensureBuiltinProviders();
  const adapter = paymentProviderRegistry.get(input.provider);
  if (!adapter) {
    throw new WalletError(
      "provider_unavailable",
      `Unknown payment provider "${input.provider}"`,
    );
  }

  const started = Date.now();
  const to = input.to ?? new Date();
  const from =
    input.from ?? new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  let issuesRecorded = 0;
  const bump = async (recorded: boolean) => {
    if (recorded) issuesRecorded += 1;
  };

  // ---- Ledger-side invariants (always) -----------------------------------
  const imbalances = await db
    .select({
      transactionId: ledgerEntries.transactionId,
      total: sql<string>`sum(${ledgerEntries.amountMinor})::bigint`,
    })
    .from(ledgerEntries)
    .groupBy(ledgerEntries.transactionId)
    .having(sql`sum(${ledgerEntries.amountMinor}) <> 0`);
  for (const row of imbalances) {
    const tx = await db
      .select({ id: walletTransactions.id, provider: walletTransactions.provider })
      .from(walletTransactions)
      .where(eq(walletTransactions.id, row.transactionId))
      .limit(1);
    await bump(
      await recordIssue({
        provider: tx[0]?.provider ?? input.provider,
        issueType: "ledger_imbalance",
        severity: "critical",
        transactionId: row.transactionId,
        details: { entrySum: Number(row.total) },
      }),
    );
  }

  const negativeWallets = await db
    .select({
      walletId: ledgerEntries.walletId,
      total: sql<string>`sum(${ledgerEntries.amountMinor})::bigint`,
    })
    .from(ledgerEntries)
    .where(isNotNull(ledgerEntries.walletId))
    .groupBy(ledgerEntries.walletId)
    .having(sql`sum(${ledgerEntries.amountMinor}) < 0`);
  for (const row of negativeWallets) {
    const owner = await db
      .select({ currency: wallets.currency, userId: wallets.userId })
      .from(wallets)
      .where(eq(wallets.id, row.walletId as string))
      .limit(1);
    await bump(
      await recordIssue({
        provider: input.provider,
        issueType: "negative_balance",
        severity: "critical",
        details: {
          walletId: row.walletId,
          userId: owner[0]?.userId,
          balance: Number(row.total),
          currency: owner[0]?.currency,
        },
      }),
    );
  }

  const duplicates = await db
    .select({
      provider: walletTransactions.provider,
      providerTransactionId: walletTransactions.providerTransactionId,
      count: sql<string>`count(*)::int`,
    })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.provider, input.provider),
        isNotNull(walletTransactions.providerTransactionId),
      ),
    )
    .groupBy(
      walletTransactions.provider,
      walletTransactions.providerTransactionId,
    )
    .having(sql`count(*) > 1`);
  for (const row of duplicates) {
    await bump(
      await recordIssue({
        provider: input.provider,
        issueType: "duplicate_transaction",
        severity: "critical",
        providerTransactionId: row.providerTransactionId,
        details: { internalCount: Number(row.count) },
      }),
    );
  }

  // ---- Internal window (for provider-side listing comparison) ------------
  const internal = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.provider, input.provider),
        gte(walletTransactions.createdAt, from),
        lt(walletTransactions.createdAt, to),
        isNotNull(walletTransactions.idempotencyKey), // internal ops only
      ),
    );
  const checkedInternal = internal.length;

  // ---- Provider-side listing (optional capability) -----------------------
  let checkedProvider = 0;
  if (adapter.listTransactions) {
    const listed = await adapter.listTransactions({ from, to });
    checkedProvider = listed.length;
    const internalByProviderId = new Map(
      internal
        .filter((row) => row.providerTransactionId)
        .map((row) => [row.providerTransactionId as string, row]),
    );
    const internalIds = new Set(internal.map((row) => row.id));

    for (const item of listed) {
      const match =
        internalByProviderId.get(item.providerTransactionId) ??
        (item.reference && internalIds.has(item.reference)
          ? await findById(item.reference)
          : undefined);

      if (!match) {
        await bump(
          await recordIssue({
            provider: input.provider,
            issueType: "missing_ledger_transaction",
            severity: "critical",
            providerTransactionId: item.providerTransactionId,
            details: {
              reference: item.reference,
              amountMinor: item.amountMinor,
              currency: item.currency,
              status: item.status,
            },
          }),
        );
        continue;
      }

      // Amount/currency comparison against the rail expectation.
      const expected = expectedRailAmount(match);
      if (item.amountMinor !== expected) {
        await bump(
          await recordIssue({
            provider: input.provider,
            issueType: "amount_mismatch",
            transactionId: match.id,
            providerTransactionId: item.providerTransactionId,
            details: { expected, reported: item.amountMinor },
          }),
        );
      }
      if (item.currency !== match.currency) {
        await bump(
          await recordIssue({
            provider: input.provider,
            issueType: "currency_mismatch",
            transactionId: match.id,
            providerTransactionId: item.providerTransactionId,
            details: { internal: match.currency, provider: item.currency },
          }),
        );
      }

      // Status agreement in both directions.
      const providerSucceeded = item.status === "succeeded";
      const ledgerSucceeded = match.status === "succeeded";
      if (providerSucceeded !== ledgerSucceeded) {
        await bump(
          await recordIssue({
            provider: input.provider,
            issueType: "status_mismatch",
            transactionId: match.id,
            providerTransactionId: item.providerTransactionId,
            details: { internal: match.status, provider: item.status },
          }),
        );
      }
    }

    // Internal ops the provider has never heard of.
    const listedIds = new Set(listed.map((item) => item.providerTransactionId));
    for (const row of internal) {
      if (row.status === "succeeded" && row.providerTransactionId &&
          !listedIds.has(row.providerTransactionId)) {
        await bump(
          await recordIssue({
            provider: input.provider,
            issueType: "missing_provider_transaction",
            severity: "critical",
            transactionId: row.id,
            providerTransactionId: row.providerTransactionId,
            details: { status: row.status, amountMinor: row.grossAmount },
          }),
        );
      }
    }
  }

  const summary: ReconciliationRunSummary = {
    provider: input.provider,
    windowFrom: from.toISOString(),
    windowTo: to.toISOString(),
    checkedInternal,
    checkedProvider,
    issuesRecorded,
    durationMs: Date.now() - started,
  };
  walletLog("info", "reconciliation.run", { ...summary, eventType: "reconciliation" });
  return summary;
}

async function findById(transactionId: string) {
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, transactionId))
    .limit(1);
  return rows[0];
}

/** Newest reconciliation records (admin console). */
export async function listReconciliationIssues(options: {
  status?: "open" | "acknowledged" | "resolved";
  provider?: string;
  limit: number;
  offset: number;
}): Promise<{
  rows: (typeof reconciliationRecords.$inferSelect)[];
  total: number;
}> {
  const conditions = [];
  if (options.status) {
    conditions.push(eq(reconciliationRecords.status, options.status));
  }
  if (options.provider) {
    conditions.push(eq(reconciliationRecords.provider, options.provider));
  }
  const where =
    conditions.length > 0
      ? and(...conditions)
      : undefined;

  const [totalRows, rows] = await Promise.all([
    db
      .select({ count: sql<string>`count(*)::int` })
      .from(reconciliationRecords)
      .where(where),
    db
      .select()
      .from(reconciliationRecords)
      .where(where)
      .orderBy(desc(reconciliationRecords.detectedAt))
      .limit(options.limit)
      .offset(options.offset),
  ]);

  return { rows, total: Number(totalRows[0]?.count ?? 0) };
}
