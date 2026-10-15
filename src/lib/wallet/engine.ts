/**
 * Transaction engine — the provider-agnostic core of the wallet.
 *
 * This module knows: deposit, withdraw, refund, cancel, verify,
 * transaction status. It does NOT know how any provider works: every
 * external interaction goes through the `PaymentProvider` contract via
 * `requireActiveProvider`.
 *
 * Invariants enforced here:
 *  - IDEMPOTENT CREATION — the client's idempotency key maps to exactly
 *    one row (unique index); a replay returns the original transaction.
 *  - WITHDRAWALS RESERVE FUNDS — the debit is posted (double-entry) in
 *    the same DB transaction that creates the row, under a wallet row
 *    lock, so concurrent spends can never double-spend a balance.
 *    Failure/cancel/expiry posts a compensating reversal — nothing is
 *    ever deleted.
 *  - DEPOSITS CREDIT ONLY ON VERIFIED SUCCESS — the credit posting
 *    happens exclusively inside `applyProviderOutcomeInTx` when an
 *    authoritative source (webhook / provider verification) says
 *    `succeeded`, after cross-checking currency and rail amount.
 *  - EVERY status change runs under `SELECT … FOR UPDATE` and the pure
 *    state machine, so webhook + poll + user action cannot race.
 *  - Provider calls run OUTSIDE database transactions (no lock held
 *    across the network), and every unknown outcome becomes
 *    `processing` — a reconcilable state, never a guess.
 */

import { randomUUID } from "node:crypto";
import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ledgerEntries,
  providerAccounts,
  walletTransactions,
  wallets,
} from "@/lib/db/schema/wallet";
import { computeFees } from "./fees";
import { WalletError } from "./errors";
import {
  assertBalanced,
  expectedRailAmount,
  invert,
  postLedger,
  postingForTransaction,
  toAmount,
  type Posting,
} from "./ledger";
import { walletLog } from "./logger";
import {
  mapProviderError,
  readConfigInt,
  requireActiveProvider,
} from "./provider-config";
import { recordIssueInTx } from "./reconciliation";
import { isCancellable } from "./state";
import { withTimeout } from "./time";
import { assertWalletOperable, ensureWallet } from "./wallet";

export type TransactionRow = typeof walletTransactions.$inferSelect;

/** External outcomes the engine accepts from any authoritative source. */
export type ExternalOutcome =
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "reversed"
  | "processing"
  | "pending";

export interface ApplyOutcomeInput {
  transactionId: string;
  outcome: ExternalOutcome;
  source: "webhook" | "verification" | "provider-response" | "admin";
  providerId?: string;
  providerTransactionId?: string;
  /** Rail amount claimed by the provider (cross-checked when present). */
  eventAmountMinor?: number;
  eventCurrency?: string;
  failureReason?: string;
}

export interface ApplyOutcomeResult {
  applied: boolean;
  reason?: string;
  status?: TransactionRow["status"];
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

/** Safe, short failure text for persistence (adapter messages are sanitized). */
function safeFailure(reason: string | undefined, fallback: string): string {
  const text = (reason ?? fallback).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text.length > 200 ? text.slice(0, 200) : text;
}

// ---------------------------------------------------------------------------
// Creation — deposit & withdrawal
// ---------------------------------------------------------------------------

export interface CreateOperationInput {
  userId: string;
  type: "deposit" | "withdrawal";
  provider: string;
  /** Gross amount, integer minor units. */
  amountMinor: number;
  currency: string;
  providerAccountId?: string;
  destinationRef?: string;
  /** REQUIRED — the idempotency key of this request. */
  idempotencyKey: string;
}

export interface OperationOutcome {
  transaction: TransactionRow;
  /** True when the key already existed — no second movement opened. */
  duplicate: boolean;
}

export async function createOperation(
  input: CreateOperationInput,
): Promise<OperationOutcome> {
  const capability = input.type === "deposit" ? "DEPOSIT" : "WITHDRAWAL";

  // 1) Gate: registered, enabled, available, capable, currency, limits.
  const { adapter, config } = await requireActiveProvider({
    provider: input.provider,
    currency: input.currency,
    capability,
    amountMinor: input.amountMinor,
  });

  const fees = computeFees(input.amountMinor, config.fees);
  const netAmount =
    input.type === "deposit"
      ? input.amountMinor
      : input.amountMinor + fees.totalFee;
  const expirySeconds = readConfigInt(config, "expirySeconds", 900, 60, 86_400);
  const timeoutMs = readConfigInt(config, "timeoutMs", 15_000, 1_000, 60_000);

  const wallet = await ensureWallet(input.userId, input.currency);
  assertWalletOperable(wallet);

  // Validate the connected account belongs to this wallet + provider.
  if (input.providerAccountId) {
    const account = await db
      .select({ id: providerAccounts.id })
      .from(providerAccounts)
      .where(
        and(
          eq(providerAccounts.id, input.providerAccountId),
          eq(providerAccounts.walletId, wallet.id),
          eq(providerAccounts.provider, config.id),
        ),
      )
      .limit(1);
    if (!account[0]) {
      throw new WalletError(
        "validation",
        "Unknown provider account for this wallet.",
      );
    }
  }

  // 2) Create the row (idempotent) and, for withdrawals, RESERVE the
  //    funds — one database transaction, wallet row locked.
  const created = await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, wallet.id))
      .for("update");
    const current = locked[0];
    if (!current) throw new WalletError("internal", "Wallet disappeared.");
    if (current.status !== "active") {
      throw new WalletError(
        "forbidden",
        `This wallet is ${current.status} and cannot move money.`,
      );
    }

    const inserted = await tx
      .insert(walletTransactions)
      .values({
        id: randomUUID(),
        walletId: current.id,
        type: input.type,
        status: "created",
        currency: current.currency,
        grossAmount: input.amountMinor,
        providerFee: fees.providerFee,
        platformFee: fees.platformFee,
        netAmount,
        provider: config.id,
        providerAccountId: input.providerAccountId ?? null,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(Date.now() + expirySeconds * 1000),
      })
      .onConflictDoNothing({ target: walletTransactions.idempotencyKey })
      .returning();

    if (inserted[0]) {
      if (input.type === "withdrawal") {
        const balance = await balanceInTx(tx, current.id);
        if (balance < inserted[0].netAmount) {
          throw new WalletError(
            "insufficient_funds",
            "Insufficient wallet balance for this withdrawal.",
            { balance, required: inserted[0].netAmount },
          );
        }
        // Reserve: debit now, under the wallet lock (race-proof).
        await postLedger(tx, {
          transactionId: inserted[0].id,
          currency: current.currency,
          posting: postingForTransaction(inserted[0], "debit"),
        });
      }
      return { row: inserted[0], duplicate: false };
    }

    // Idempotent replay — the key exists: same request must map to the
    // SAME transaction; a different request with the same key is a bug
    // on the client and is rejected loudly.
    const existing = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    const row = existing[0];
    if (
      !row ||
      row.walletId !== current.id ||
      row.type !== input.type ||
      row.currency !== current.currency ||
      row.grossAmount !== input.amountMinor ||
      row.provider !== config.id
    ) {
      throw new WalletError(
        "idempotency_conflict",
        "This idempotency key was already used for a different request.",
      );
    }
    return { row, duplicate: true };
  });

  if (created.duplicate) {
    walletLog("info", "operation.duplicate", {
      eventType: input.type,
      transactionId: created.row.id,
      userId: input.userId,
      provider: config.id,
      amountMinor: created.row.grossAmount,
      currency: created.row.currency,
      status: created.row.status,
    });
    return { transaction: created.row, duplicate: true };
  }

  const row = created.row;
  const logBase = {
    eventType: input.type,
    transactionId: row.id,
    userId: input.userId,
    provider: config.id,
    currency: row.currency,
    amountMinor: row.grossAmount,
  };
  walletLog("info", "operation.created", {
    ...logBase,
    status: "created",
    source: input.type,
  });

  // 3) Call the provider OUTSIDE any database transaction.
  try {
    const result =
      input.type === "deposit"
        ? await withTimeout(
            adapter.createDeposit({
              reference: row.id,
              idempotencyKey: input.idempotencyKey,
              amountMinor: row.grossAmount,
              totalToCollectMinor:
                row.grossAmount + row.providerFee + row.platformFee,
              currency: row.currency,
              providerAccountId: input.providerAccountId ?? null,
              expiresInSeconds: expirySeconds,
            }),
            timeoutMs,
          )
        : await withTimeout(
            adapter.createWithdrawal({
              reference: row.id,
              idempotencyKey: input.idempotencyKey,
              amountMinor: row.grossAmount,
              totalToDebitMinor: row.netAmount,
              currency: row.currency,
              providerAccountId: input.providerAccountId ?? null,
              destinationRef: input.destinationRef,
              expiresInSeconds: expirySeconds,
            }),
            timeoutMs,
          );

    walletLog("info", "provider.request_succeeded", {
      ...logBase,
      providerTransactionId: result.providerTransactionId,
      status: result.status,
    });

    if (
      result.status === "pending" ||
      result.status === "processing"
    ) {
      const updated = await db
        .update(walletTransactions)
        .set({
          status: result.status,
          providerTransactionId: result.providerTransactionId,
          expiresAt: result.expiresAt
            ? new Date(result.expiresAt)
            : row.expiresAt,
          metadata: {
            instructions: result.instructions,
            paymentUrl: result.paymentUrl,
            ...(result.metadata ?? {}),
          },
        })
        .where(
          and(
            eq(walletTransactions.id, row.id),
            eq(walletTransactions.status, "created"),
          ),
        )
        .returning();
      if (updated[0]) return { transaction: updated[0], duplicate: false };
      // Row moved while we were at the provider (expiry sweep/cancel) —
      // report current state rather than guessing.
      const current = await getTransactionRow(row.id);
      return { transaction: current ?? row, duplicate: false };
    }

    // Immediate terminal answer from the rail — settle through the
    // SAME audited path everything else uses.
    const settled = await db.transaction((tx) =>
      applyProviderOutcomeInTx(tx, {
        transactionId: row.id,
        outcome: result.status,
        source: "provider-response",
        providerId: config.id,
        providerTransactionId: result.providerTransactionId,
        failureReason: result.instructions,
      }),
    );
    const current = await getTransactionRow(row.id);
    if (!settled.applied && settled.reason === "amount_mismatch") {
      throw new WalletError(
        "amount_mismatch",
        "The provider reported an unexpected amount.",
        { transactionId: row.id },
      );
    }
    return { transaction: current ?? row, duplicate: false };
  } catch (error) {
    const mapped = mapProviderError(error);
    const isUnknown = mapped.code === "provider_timeout";

    if (isUnknown) {
      // Outcome unknown → mark processing (reconcilable, never guessed).
      await db
        .update(walletTransactions)
        .set({
          status: "processing",
          failureReason: null,
        })
        .where(
          and(
            eq(walletTransactions.id, row.id),
            eq(walletTransactions.status, "created"),
          ),
        );
      walletLog("warn", "provider.request_timeout", {
        ...logBase,
        status: "processing",
        errorCode: mapped.code,
      });
      throw new WalletError(mapped.code, mapped.message, {
        ...(mapped.details ?? {}),
        transactionId: row.id,
      });
    }

    // Definite rejection → fail the row and unreserve any withdrawal.
    await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, row.id))
        .for("update");
      const current = locked[0];
      if (!current || current.status !== "created") return;
      if (current.type === "withdrawal") {
        await postLedger(tx, {
          transactionId: current.id,
          currency: current.currency,
          posting: invert(postingForTransaction(current, "debit")),
        });
      }
      await tx
        .update(walletTransactions)
        .set({
          status: "failed",
          failureReason: safeFailure(mapped.message, "Provider rejected"),
          completedAt: new Date(),
        })
        .where(eq(walletTransactions.id, current.id));
    });
    walletLog("error", "provider.request_failed", {
      ...logBase,
      status: "failed",
      errorCode: mapped.code,
    });
    throw new WalletError(mapped.code, mapped.message, {
      ...(mapped.details ?? {}),
      transactionId: row.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Internal movements — game stakes (no provider, no external rail)
//
// A stake lifecycle (docs/wallet-mises-jeux.md) only ever moves money BETWEEN
// wallets and the per-match escrow account: there is no rail, so no provider,
// no webhook, no expiry — a movement is final the instant it is posted. It is
// still idempotent and serialized under FOR UPDATE like every other money move.
// ---------------------------------------------------------------------------

export interface InternalMovementInput {
  /** stake | payout | refund — the game-movement vocabulary. */
  type: "stake" | "payout" | "refund";
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
 * per-match escrow, never through a provider. Enforced inside ONE database
 * transaction:
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
      provider: null,
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

// ---------------------------------------------------------------------------
// Settlement — the ONE place a status ever changes and money ever posts.
// Always called inside a database transaction, always under FOR UPDATE.
// ---------------------------------------------------------------------------

function outcomeToStatus(outcome: ExternalOutcome): TransactionRow["status"] {
  switch (outcome) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "reversed":
      return "reversed";
    case "processing":
      return "processing";
    case "pending":
      return "pending";
  }
}

const NON_FINAL = ["created", "pending", "processing"] as const;

/**
 * Apply an authoritative provider outcome to one transaction.
 *
 * Cross-checks BEFORE trusting: currency must match, and the claimed
 * rail amount must equal `expectedRailAmount` (gross+fees inbound for
 * deposits, gross outbound otherwise). Any mismatch writes a
 * reconciliation record and changes NOTHING.
 *
 * Money rules:
 *   deposit  + succeeded → post the CREDIT (only ever here)
 *   withdrawal/refund + non-success → post the REVERSAL of the reserve
 *   withdrawal + succeeded after a reversed reserve → critical issue
 */
export async function applyProviderOutcomeInTx(
  tx: DbTx,
  input: ApplyOutcomeInput,
): Promise<ApplyOutcomeResult> {
  const locked = await tx
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, input.transactionId))
    .for("update");
  const row = locked[0];
  if (!row) return { applied: false, reason: "not_found" };

  const provider = input.providerId ?? row.provider ?? "unknown";

  // ---- Never trust the claim: cross-check currency and amount. ----------
  if (input.eventCurrency && input.eventCurrency !== row.currency) {
    await recordIssueInTx(tx, {
      provider,
      issueType: "currency_mismatch",
      severity: "critical",
      transactionId: row.id,
      providerTransactionId: row.providerTransactionId,
      details: { internal: row.currency, reported: input.eventCurrency },
    });
    walletLog("error", "settlement.currency_mismatch", {
      transactionId: row.id,
      provider,
      currency: row.currency,
      status: row.status,
    });
    return { applied: false, reason: "currency_mismatch", status: row.status };
  }
  if (input.eventAmountMinor !== undefined) {
    const expected = expectedRailAmount(row);
    if (input.eventAmountMinor !== expected) {
      await recordIssueInTx(tx, {
        provider,
        issueType: "amount_mismatch",
        severity: "critical",
        transactionId: row.id,
        providerTransactionId: row.providerTransactionId,
        details: { expected, reported: input.eventAmountMinor },
      });
      walletLog("error", "settlement.amount_mismatch", {
        transactionId: row.id,
        provider,
        currency: row.currency,
        amountMinor: row.grossAmount,
        status: row.status,
      });
      return { applied: false, reason: "amount_mismatch", status: row.status };
    }
  }

  // Adopt the provider's transaction id when we don't have one yet —
  // but never when it is already claimed by ANOTHER row (a duplicate
  // reference is an issue, not a merge).
  let providerTransactionId = row.providerTransactionId ?? null;
  if (!providerTransactionId && input.providerTransactionId) {
    const clash = await tx
      .select({ id: walletTransactions.id })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.provider, provider),
          eq(walletTransactions.providerTransactionId, input.providerTransactionId),
        ),
      )
      .limit(1);
    if (clash[0] && clash[0].id !== row.id) {
      await recordIssueInTx(tx, {
        provider,
        issueType: "duplicate_transaction",
        severity: "critical",
        transactionId: row.id,
        providerTransactionId: input.providerTransactionId,
        details: { claimedBy: clash[0].id },
      });
      return { applied: false, reason: "duplicate_provider_reference" };
    }
    providerTransactionId = input.providerTransactionId;
  }

  const target = outcomeToStatus(input.outcome);
  const nonFinal = (NON_FINAL as readonly string[]).includes(row.status);

  // ---- In-flight states: just advance. ----------------------------------
  if (target === "processing" || target === "pending") {
    if (!nonFinal || row.status === target) {
      return { applied: false, reason: "no_change", status: row.status };
    }
    const updated = await tx
      .update(walletTransactions)
      .set({ status: target, providerTransactionId })
      .where(eq(walletTransactions.id, row.id))
      .returning();
    return { applied: true, status: updated[0]?.status };
  }

  // ---- succeeded ---------------------------------------------------------
  if (target === "succeeded") {
    if (row.status === "succeeded") {
      return { applied: false, reason: "already_succeeded", status: row.status };
    }

    if (row.type === "deposit") {
      // A late authoritative success after an internal timeout/failure
      // is exactly the case webhooks exist for — credit it (once: the
      // status guard above + FOR UPDATE make this single-shot).
      if (row.status === "refunded" || row.status === "reversed") {
        await recordIssueInTx(tx, {
          provider,
          issueType: "status_mismatch",
          transactionId: row.id,
          providerTransactionId,
          details: { internal: row.status, reported: "succeeded" },
        });
        return { applied: false, reason: "terminal_conflict", status: row.status };
      }
      await postLedger(tx, {
        transactionId: row.id,
        currency: row.currency,
        posting: postingForTransaction(row, "credit"),
      });
      const updated = await tx
        .update(walletTransactions)
        .set({
          status: "succeeded",
          providerTransactionId: providerTransactionId ?? undefined,
          failureReason: null,
          completedAt: new Date(),
        })
        .where(eq(walletTransactions.id, row.id))
        .returning();
      walletLog("info", "settlement.deposit_credited", {
        transactionId: row.id,
        walletId: row.walletId,
        provider,
        providerTransactionId: providerTransactionId ?? undefined,
        currency: row.currency,
        amountMinor: row.grossAmount,
        status: "succeeded",
        source: input.source,
      });
      return { applied: true, status: updated[0]?.status };
    }

    // Withdrawal / refund: the debit was reserved at creation.
    if (nonFinal) {
      const updated = await tx
        .update(walletTransactions)
        .set({
          status: "succeeded",
          providerTransactionId: providerTransactionId ?? undefined,
          failureReason: null,
          completedAt: new Date(),
        })
        .where(eq(walletTransactions.id, row.id))
        .returning();
      walletLog("info", "settlement.withdrawal_completed", {
        transactionId: row.id,
        walletId: row.walletId,
        provider,
        providerTransactionId: providerTransactionId ?? undefined,
        currency: row.currency,
        amountMinor: row.grossAmount,
        status: "succeeded",
        source: input.source,
      });
      return { applied: true, status: updated[0]?.status };
    }

    // Provider claims success after we already failed/reversed/…
    await recordIssueInTx(tx, {
      provider,
      issueType: "status_mismatch",
      severity: "critical",
      transactionId: row.id,
      providerTransactionId,
      details: { internal: row.status, reported: "succeeded" },
    });
    walletLog("error", "settlement.status_conflict", {
      transactionId: row.id,
      provider,
      currency: row.currency,
      amountMinor: row.grossAmount,
      status: row.status,
      source: input.source,
    });
    return { applied: false, reason: "terminal_conflict", status: row.status };
  }

  // ---- failed / cancelled / expired --------------------------------------
  if (row.status === target) {
    return { applied: false, reason: "already_final", status: row.status };
  }
  if (row.status === "succeeded" || row.status === "refunded" || row.status === "reversed") {
    await recordIssueInTx(tx, {
      provider,
      issueType: "status_mismatch",
      severity: "warning",
      transactionId: row.id,
      providerTransactionId,
      details: { internal: row.status, reported: target },
    });
    return { applied: false, reason: "terminal_conflict", status: row.status };
  }

  if (row.type === "withdrawal" || row.type === "refund") {
    // Unreserve the funds that were held at creation (compensating
    // entry — the original posting is never touched).
    await postLedger(tx, {
      transactionId: row.id,
      currency: row.currency,
      posting: invert(postingForTransaction(row, "debit")),
    });
  }
  // Deposits in flight have posted nothing — a failure moves the row only.
  const updated = await tx
    .update(walletTransactions)
    .set({
      status: target,
      providerTransactionId: providerTransactionId ?? undefined,
      failureReason: safeFailure(input.failureReason, `Provider reported ${target}`),
      completedAt: new Date(),
    })
    .where(eq(walletTransactions.id, row.id))
    .returning();
  walletLog("info", "settlement.failed", {
    transactionId: row.id,
    walletId: row.walletId,
    provider,
    providerTransactionId: providerTransactionId ?? undefined,
    currency: row.currency,
    amountMinor: row.grossAmount,
    status: target,
    source: input.source,
  });
  return { applied: true, status: updated[0]?.status };
}

// ---------------------------------------------------------------------------
// Verification — authoritative server-to-server check (polling path).
// ---------------------------------------------------------------------------

export interface VerifyResult {
  transaction: TransactionRow;
  /** True when this call reached a terminal state. */
  settled: boolean;
  /** False when the provider does not recognize the transaction. */
  recognized: boolean;
  reason?: string;
}

/**
 * Ask the provider what actually happened and apply it through the
 * settlement path. Used by GET endpoints, the confirm endpoint and the
 * admin "verify" action — never by the client directly.
 */
export async function verifyAndSettle(input: {
  transactionId: string;
  source: "verification" | "admin";
  timeoutMs?: number;
}): Promise<VerifyResult> {
  const row = await getTransactionRow(input.transactionId);
  if (!row || !row.provider) {
    throw new WalletError("not_found", "Transaction not found.");
  }

  const { adapter, config } = await requireActiveProvider({
    provider: row.provider,
    currency: row.currency,
    capability: "TRANSACTION_STATUS",
    // Settlement must keep working for EXISTING operations even when
    // an admin has since disabled the provider for new business.
    allowDisabled: true,
  });

  const timeoutMs =
    input.timeoutMs ?? readConfigInt(config, "timeoutMs", 15_000, 1_000, 60_000);

  const verification = await withTimeout(
    adapter.verifyTransaction({
      providerTransactionId: row.providerTransactionId ?? "",
      reference: row.id,
      currency: row.currency,
    }),
    timeoutMs,
  );

  if (!verification.verified) {
    walletLog("info", "verification.not_recognized", {
      transactionId: row.id,
      provider: row.provider,
      providerTransactionId: row.providerTransactionId ?? undefined,
      currency: row.currency,
      amountMinor: row.grossAmount,
      status: row.status,
    });
    return {
      transaction: row,
      settled: false,
      recognized: false,
      reason: "Provider does not recognize this transaction",
    };
  }

  const applied = await db.transaction((tx) =>
    applyProviderOutcomeInTx(tx, {
      transactionId: row.id,
      outcome: verification.status,
      source: input.source,
      providerId: row.provider ?? undefined,
      providerTransactionId: row.providerTransactionId ?? undefined,
      eventAmountMinor: verification.amountMinor,
      eventCurrency: verification.currency,
      failureReason: verification.failureReason,
    }),
  );

  const fresh = (await getTransactionRow(row.id)) ?? row;
  return {
    transaction: fresh,
    settled: fresh.status === "succeeded" || fresh.status === "failed" ||
      fresh.status === "cancelled" || fresh.status === "expired" ||
      fresh.status === "refunded" || fresh.status === "reversed",
    recognized: true,
    reason: applied.reason,
  };
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

/**
 * Cancel a pending operation. Deposits can only be cancelled before
 * the provider accepted them; withdrawals additionally ask the
 * provider (capability WITHDRAWAL) when it already holds one, and the
 * held funds are un-reserved with a compensating posting.
 */
export async function cancelOperation(input: {
  userId: string;
  transactionId: string;
}): Promise<TransactionRow> {
  const row = await loadOwnedTransaction(input.userId, input.transactionId);
  if (!isCancellable(row.status)) {
    throw new WalletError(
      "invalid_state",
      `A ${row.status} transaction can no longer be cancelled.`,
      { status: row.status },
    );
  }

  // Provider already accepted → its side must be cancelled first.
  if (row.providerTransactionId) {
    if (row.type !== "withdrawal") {
      throw new WalletError(
        "invalid_state",
        "This deposit can no longer be cancelled — wait for settlement or expiry.",
      );
    }
    if (!row.provider) {
      throw new WalletError("internal", "Transaction has no provider.");
    }
    const { adapter, config } = await requireActiveProvider({
      provider: row.provider,
      currency: row.currency,
      capability: "WITHDRAWAL",
      allowDisabled: true,
    });
    try {
      await withTimeout(
        adapter.cancelWithdrawal({
          reference: row.id,
          providerTransactionId: row.providerTransactionId,
        }),
        readConfigInt(config, "timeoutMs", 15_000, 1_000, 60_000),
      );
    } catch (error) {
      const mapped = mapProviderError(error);
      if (mapped.code === "capability_not_supported") {
        throw new WalletError(
          "capability_not_supported",
          "This provider cannot cancel an accepted operation — wait for settlement or expiry.",
        );
      }
      throw mapped;
    }
  }

  const result = await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.id, row.id))
      .for("update");
    const current = locked[0];
    if (!current) throw new WalletError("not_found", "Transaction not found.");
    if (!isCancellable(current.status)) {
      throw new WalletError(
        "invalid_state",
        `Transaction moved to ${current.status} — can no longer be cancelled.`,
        { status: current.status },
      );
    }

    if (current.type === "withdrawal") {
      // Un-reserve the debit posted at creation.
      await postLedger(tx, {
        transactionId: current.id,
        currency: current.currency,
        posting: invert(postingForTransaction(current, "debit")),
      });
    }

    const updated = await tx
      .update(walletTransactions)
      .set({
        status: "cancelled",
        failureReason: "Cancelled by user",
        completedAt: new Date(),
      })
      .where(eq(walletTransactions.id, current.id))
      .returning();
    return updated[0];
  });

  walletLog("info", "operation.cancelled", {
    transactionId: row.id,
    walletId: row.walletId,
    userId: input.userId,
    provider: row.provider ?? undefined,
    providerTransactionId: row.providerTransactionId ?? undefined,
    currency: row.currency,
    amountMinor: row.grossAmount,
    status: "cancelled",
  });
  return result ?? ((await getTransactionRow(row.id)) as TransactionRow);
}

/**
 * Explicit user/admin confirmation: ask the rail to confirm (some
 * providers need an explicit confirm step) then verify + settle.
 * Idempotent — repeating it on a settled transaction changes nothing.
 */
export async function confirmDepositOperation(input: {
  userId: string;
  transactionId: string;
  /** Sanitized one-shot confirmation from the user (never persisted). */
  confirmation?: string;
}): Promise<VerifyResult> {
  const row = await loadOwnedTransaction(input.userId, input.transactionId);
  if (row.type !== "deposit") {
    throw new WalletError("validation", "Only deposits can be confirmed.");
  }
  if (row.status === "succeeded") {
    return { transaction: row, settled: true, recognized: true };
  }
  if (!row.providerTransactionId) {
    throw new WalletError(
      "invalid_state",
      "This deposit has not reached the provider yet.",
    );
  }

  const { adapter, config } = await requireActiveProvider({
    provider: row.provider ?? "",
    currency: row.currency,
    capability: "DEPOSIT",
    allowDisabled: true,
  });
  await withTimeout(
    adapter.confirmDeposit({
      reference: row.id,
      providerTransactionId: row.providerTransactionId,
      confirmation: input.confirmation,
    }),
    readConfigInt(config, "timeoutMs", 15_000, 1_000, 60_000),
  );

  return verifyAndSettle({ transactionId: row.id, source: "verification" });
}

// ---------------------------------------------------------------------------
// Expiry sweep — local, safe, bounded (run opportunistically).
// ---------------------------------------------------------------------------

/**
 * Expire stale operations. Deposits that never settled simply expire
 * (nothing was credited); withdrawals are only expired when the
 * provider NEVER accepted them (status `created`) — an accepted
 * withdrawal is settled by its webhook or flagged by reconciliation,
 * never expired locally while the rail might still pay out.
 */
export async function expireStaleOperations(limit = 20): Promise<number> {
  const stale = await db
    .select({ id: walletTransactions.id, type: walletTransactions.type })
    .from(walletTransactions)
    .where(
      and(
        lte(walletTransactions.expiresAt, new Date()),
        inArray(walletTransactions.status, ["created", "pending"]),
        sql`(${walletTransactions.type} = 'deposit' or ${walletTransactions.status} = 'created')`,
      ),
    )
    .limit(limit);

  let expired = 0;
  for (const item of stale) {
    const applied = await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, item.id))
        .for("update");
      const row = locked[0];
      if (!row || !isCancellable(row.status)) return false;
      if (!row.expiresAt || row.expiresAt.getTime() > Date.now()) return false;

      if (row.type === "withdrawal") {
        await postLedger(tx, {
          transactionId: row.id,
          currency: row.currency,
          posting: invert(postingForTransaction(row, "debit")),
        });
      }
      await tx
        .update(walletTransactions)
        .set({ status: "expired", completedAt: new Date() })
        .where(eq(walletTransactions.id, row.id));
      return true;
    });
    if (applied) {
      expired += 1;
      walletLog("info", "operation.expired", {
        transactionId: item.id,
        type: item.type,
        status: "expired",
        source: "expiry-sweep",
      });
    }
  }
  return expired;
}

// ---------------------------------------------------------------------------
// Refunds — full refund of a succeeded deposit.
// ---------------------------------------------------------------------------

/**
 * Refund a succeeded deposit. The refund is its OWN transaction
 * (linked via originalTransactionId): the wallet is debited the
 * original gross with the same double-entry rigor as a withdrawal,
 * and only settles when the provider confirms through the normal
 * settlement path.
 */
export async function refundDeposit(input: {
  userId: string;
  transactionId: string;
  idempotencyKey: string;
}): Promise<OperationOutcome> {
  const original = await loadOwnedTransaction(input.userId, input.transactionId);
  if (original.type !== "deposit" || original.status !== "succeeded") {
    throw new WalletError(
      "invalid_state",
      "Only a successful deposit can be refunded.",
      { status: original.status, type: original.type },
    );
  }
  if (!original.provider) {
    throw new WalletError("internal", "Original transaction has no provider.");
  }

  const { adapter, config } = await requireActiveProvider({
    provider: original.provider,
    currency: original.currency,
    capability: "REFUND",
    amountMinor: original.grossAmount,
  });
  const timeoutMs = readConfigInt(config, "timeoutMs", 15_000, 1_000, 60_000);

  // Refund mirrors the deposit's amounts (full refund, fees reversed
  // back through the same accounts).
  const created = await db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, original.walletId))
      .for("update");
    const wallet = locked[0];
    if (!wallet) throw new WalletError("internal", "Wallet disappeared.");
    if (wallet.status !== "active") {
      throw new WalletError("forbidden", `This wallet is ${wallet.status}.`);
    }

    const inserted = await tx
      .insert(walletTransactions)
      .values({
        id: randomUUID(),
        walletId: wallet.id,
        type: "refund",
        status: "created",
        currency: original.currency,
        grossAmount: original.grossAmount,
        providerFee: original.providerFee,
        platformFee: original.platformFee,
        netAmount: original.grossAmount,
        provider: original.provider,
        providerAccountId: original.providerAccountId,
        idempotencyKey: input.idempotencyKey,
        originalTransactionId: original.id,
        expiresAt: new Date(Date.now() + 900_000),
      })
      .onConflictDoNothing({ target: walletTransactions.idempotencyKey })
      .returning();

    if (inserted[0]) {
      const balance = await balanceInTx(tx, wallet.id);
      if (balance < inserted[0].netAmount) {
        throw new WalletError(
          "insufficient_funds",
          "Insufficient wallet balance to refund this deposit.",
          { balance, required: inserted[0].netAmount },
        );
      }
      await postLedger(tx, {
        transactionId: inserted[0].id,
        currency: original.currency,
        posting: postingForTransaction(inserted[0], "debit"),
      });
      return { row: inserted[0], duplicate: false };
    }

    const existing = await tx
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    const row = existing[0];
    if (!row || row.originalTransactionId !== original.id) {
      throw new WalletError(
        "idempotency_conflict",
        "This idempotency key was already used for a different request.",
      );
    }
    return { row, duplicate: true };
  });

  if (created.duplicate) {
    return { transaction: created.row, duplicate: true };
  }

  const row = created.row;
  walletLog("info", "operation.created", {
    eventType: "refund",
    transactionId: row.id,
    userId: input.userId,
    provider: original.provider,
    currency: row.currency,
    amountMinor: row.grossAmount,
    status: "created",
    source: "refund",
  });

  try {
    const result = await withTimeout(
      adapter.refundTransaction({
        reference: original.id,
        providerTransactionId: original.providerTransactionId ?? "",
        amountMinor: original.grossAmount,
        currency: original.currency,
        reason: "user_requested",
      }),
      timeoutMs,
    );

    if (result.status === "pending" || result.status === "processing") {
      const updated = await db
        .update(walletTransactions)
        .set({
          status: result.status,
          providerTransactionId: result.providerTransactionId,
          metadata: { instructions: result.instructions },
        })
        .where(
          and(
            eq(walletTransactions.id, row.id),
            eq(walletTransactions.status, "created"),
          ),
        )
        .returning();
      if (updated[0]) return { transaction: updated[0], duplicate: false };
    } else {
      await db.transaction((tx) =>
        applyProviderOutcomeInTx(tx, {
          transactionId: row.id,
          outcome: result.status,
          source: "provider-response",
          providerId: original.provider ?? undefined,
          providerTransactionId: result.providerTransactionId,
          failureReason: result.instructions,
        }),
      );
    }
    const fresh = await getTransactionRow(row.id);
    return { transaction: fresh ?? row, duplicate: false };
  } catch (error) {
    const mapped = mapProviderError(error);
    if (mapped.code === "provider_timeout") {
      await db
        .update(walletTransactions)
        .set({ status: "processing" })
        .where(
          and(
            eq(walletTransactions.id, row.id),
            eq(walletTransactions.status, "created"),
          ),
        );
      throw new WalletError(mapped.code, mapped.message, { transactionId: row.id });
    }
    // Definite failure → release the refund reservation.
    await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.id, row.id))
        .for("update");
      const current = locked[0];
      if (!current || current.status !== "created") return;
      await postLedger(tx, {
        transactionId: current.id,
        currency: current.currency,
        posting: invert(postingForTransaction(current, "debit")),
      });
      await tx
        .update(walletTransactions)
        .set({
          status: "failed",
          failureReason: safeFailure(mapped.message, "Provider rejected refund"),
          completedAt: new Date(),
        })
        .where(eq(walletTransactions.id, current.id));
    });
    walletLog("error", "provider.request_failed", {
      eventType: "refund",
      transactionId: row.id,
      provider: original.provider,
      currency: row.currency,
      amountMinor: row.grossAmount,
      status: "failed",
      errorCode: mapped.code,
    });
    throw new WalletError(mapped.code, mapped.message, { transactionId: row.id });
  }
}
