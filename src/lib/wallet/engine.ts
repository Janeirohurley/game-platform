/**
 * Transaction engine — the internal core of the wallet.
 *
 * This module knows: transaction reads, status, and INTERNAL movements
 * (game stakes, manual point adjustments, withdrawal requests). There is
 * no provider, no external rail, no webhook: money only ever moves
 * between wallets and system accounts through double-entry postings.
 *
 * Invariants enforced here:
 *  - IDEMPOTENT CREATION — the client's idempotency key maps to exactly
 *    one row (unique index); a replay returns the original transaction
 *    and posts NOTHING a second time.
 *  - SERIALIZED — every involved wallet is locked `FOR UPDATE` in a
 *    stable (sorted) order, so concurrent movements can never deadlock
 *    or double-spend a balance.
 *  - NO OVERDRAFT — no wallet — and no escrow account — may be driven
 *    below zero by a posting, checked under the lock.
 *  - BALANCED — every posting must sum to zero (asserted before any DB
 *    write); nothing is ever deleted, only reversed with new entries.
 */

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ledgerEntries,
  walletTransactions,
  wallets,
} from "@/lib/db/schema/wallet";
import { WalletError } from "./errors";
import {
  assertBalanced,
  postLedger,
  toAmount,
  type Posting,
} from "./ledger";
import { walletLog } from "./logger";
import { assertWalletOperable } from "./wallet";

export type TransactionRow = typeof walletTransactions.$inferSelect;

export interface OperationOutcome {
  transaction: TransactionRow;
  /** True when the key already existed — no second movement opened. */
  duplicate: boolean;
}

export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getTransactionRow(
  transactionId: string,
): Promise<TransactionRow | null> {
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, transactionId))
    .limit(1);
  return rows[0] ?? null;
}

/** Ownership-checked read: the transaction must belong to the user. */
export async function loadOwnedTransaction(
  userId: string,
  transactionId: string,
): Promise<TransactionRow> {
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
  if (!rows[0]) {
    throw new WalletError("not_found", "Transaction not found.");
  }
  return rows[0].tx;
}

async function balanceInTx(tx: DbTx, walletId: string): Promise<number> {
  const rows = await tx
    .select({
      total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.walletId, walletId));
  return toAmount(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Internal movements — game stakes & manual point operations
//
// A stake lifecycle (docs/wallet-mises-jeux.md) only ever moves money BETWEEN
// wallets and the per-match escrow account: there is no rail, so no webhook,
// no expiry — a movement is final the instant it is posted. The same engine
// serves the manual points system (admin adjustments, withdrawal requests).
// Every movement is still idempotent and serialized under FOR UPDATE.
// ---------------------------------------------------------------------------

export interface InternalMovementInput {
  /**
   * stake | payout | refund — game movements.
   * deposit | withdrawal | adjustment — MANUAL movements: an administrator
   * credits/debits points, or a withdrawal request debits/refunds them.
   * None of these ever touch an external rail.
   */
  type: "stake" | "payout" | "refund" | "deposit" | "withdrawal" | "adjustment";
  /**
   * Anchor wallet the transaction header is filed under.
   * `wallet_transactions.walletId` is NOT NULL and there is ONE row per
   * movement, so the caller names the wallet that identifies it (for a
   * single-winner payout this is the winner; on a draw, each refund is its
   * own movement). It MUST be one of the posting's wallet legs.
   */
  walletId: string;
  currency: string;
  /** Already-balanced posting (see the builders in ledger.ts). */
  posting: Posting;
  /** REQUIRED — the idempotency key of this movement. */
  idempotencyKey: string;
  /** Sanitized extras (room id, pot, rake, reason…). Never secrets. */
  metadata?: Record<string, unknown>;
}

/**
 * Post an INTERNAL movement: money moves only between wallets and the
 * per-match escrow, never through an external rail. Enforced inside ONE
 * database transaction:
 *   - IDEMPOTENT: the key maps to exactly one row; a replay returns it and
 *     posts NOTHING a second time.
 *   - SERIALIZED: every involved wallet is locked `FOR UPDATE` in a stable
 *     (sorted) order, so concurrent movements can never deadlock or race.
 *   - NO OVERDRAFT: no wallet — and no escrow account — may be driven below
 *     zero by the posting, checked under the lock.
 *   - BALANCED: the posting must sum to zero (asserted before any DB write).
 */
export async function postInternalMovement(
  input: InternalMovementInput,
): Promise<OperationOutcome> {
  return db.transaction((tx) => runInternalMovement(tx, input));
}

/**
 * Same movement, but inside a CALLER-OWNED transaction.
 *
 * Used by the match-stakes settlement so several movements AND the
 * settlement state change (`match_stakes.status`, hold statuses) commit
 * atomically. Does NOT open its own transaction — the caller owns the
 * enclosing one (and therefore the commit/rollback semantics).
 */
export async function postInternalMovementInTx(
  tx: DbTx,
  input: InternalMovementInput,
): Promise<OperationOutcome> {
  return runInternalMovement(tx, input);
}

async function runInternalMovement(
  tx: DbTx,
  input: InternalMovementInput,
): Promise<OperationOutcome> {
  // The double-entry invariant holds BEFORE we touch the database.
  assertBalanced(input.posting);

  // Net movement per wallet (the wallet side of each leg) + system accounts
  // (escrow) that a negative leg would draw down.
  const walletDeltas = new Map<string, number>();
  const accountDeltas = new Map<string, number>();
  for (const leg of input.posting.legs) {
    if (leg.walletId === null) {
      accountDeltas.set(leg.account, (accountDeltas.get(leg.account) ?? 0) + leg.amountMinor);
    } else {
      walletDeltas.set(leg.walletId, (walletDeltas.get(leg.walletId) ?? 0) + leg.amountMinor);
    }
  }
  if (!walletDeltas.has(input.walletId)) {
    throw new WalletError("internal", "The anchor wallet is not part of the posting.");
  }
  const anchorDelta = walletDeltas.get(input.walletId) ?? 0;
  if (anchorDelta === 0) {
    throw new WalletError("internal", "The anchor wallet does not move money.");
  }
  // One posting = one currency. grossAmount/netAmount are the anchor wallet's
  // movement magnitude (internal movements carry no wallet-side fees).
  const grossAmount = Math.abs(anchorDelta);

  // Stable lock + evaluation order → two movements can never deadlock.
  const walletIds = [...walletDeltas.keys()].sort();

  const locked = await tx
    .select()
    .from(wallets)
    .where(inArray(wallets.id, walletIds))
    .orderBy(wallets.id)
    .for("update");
  const byId = new Map(locked.map((wallet) => [wallet.id, wallet]));
  if (byId.size !== walletIds.length) {
    throw new WalletError("not_found", "A wallet in this movement is missing.");
  }
  for (const id of walletIds) {
    const wallet = byId.get(id)!;
    if (wallet.currency !== input.currency) {
      throw new WalletError("currency_mismatch", "This movement mixes currencies.");
    }
    assertWalletOperable(wallet);
  }

  // No overdraft — wallets first, then system (escrow) accounts.
  for (const [walletId, delta] of walletDeltas) {
    if (delta >= 0) continue;
    const balance = await balanceInTx(tx, walletId);
    if (balance + delta < 0) {
      throw new WalletError(
        "insufficient_funds",
        "Insufficient wallet balance for this movement.",
        { walletId, balance, required: -delta },
      );
    }
  }
  for (const [account, delta] of accountDeltas) {
    if (delta >= 0) continue;
    // `external:*` is the outside world (manual payments included): it is a
    // clearing account, not a vault, so it may legitimately go negative.
    // Escrow and fee accounts, on the other hand, can never be overdrawn.
    if (account.startsWith("external:")) continue;
    const rows = await tx
      .select({ total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint` })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.account, account));
    const balance = toAmount(rows[0]?.total ?? 0);
    if (balance + delta < 0) {
      throw new WalletError(
        "insufficient_funds",
        `Account ${account} cannot cover this movement.`,
        { account, balance, required: -delta },
      );
    }
  }

  const inserted = await tx
    .insert(walletTransactions)
    .values({
      id: randomUUID(),
      walletId: input.walletId,
      type: input.type,
      status: "succeeded",
      currency: input.currency,
      grossAmount,
      providerFee: 0,
      platformFee: 0,
      netAmount: grossAmount,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? null,
      completedAt: new Date(),
    })
    .onConflictDoNothing({ target: walletTransactions.idempotencyKey })
    .returning();

  let row: TransactionRow;
  let duplicate: boolean;

  if (inserted[0]) {
    await postLedger(tx, {
      transactionId: inserted[0].id,
      currency: input.currency,
      posting: input.posting,
    });
    row = inserted[0];
    duplicate = false;
  } else {
    // Idempotent replay — the key must map to the SAME movement.
    const existing = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    const found = existing[0];
    if (
      !found ||
      found.walletId !== input.walletId ||
      found.type !== input.type ||
      found.currency !== input.currency ||
      found.grossAmount !== grossAmount
    ) {
      throw new WalletError(
        "idempotency_conflict",
        "This idempotency key was already used for a different movement.",
      );
    }
    row = found;
    duplicate = true;
  }

  walletLog("info", duplicate ? "internal.duplicate" : "internal.posted", {
    eventType: input.type,
    transactionId: row.id,
    walletId: row.walletId,
    currency: row.currency,
    amountMinor: row.grossAmount,
    status: row.status,
  });

  return { transaction: row, duplicate };
}
