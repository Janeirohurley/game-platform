/**
 * Ledger service — the ONLY writer of `ledger_entries`.
 *
 * Double entry, integer minor units, append-only:
 *
 *   - every movement posts a balanced set of legs (sum = 0), built by
 *     the pure builders below;
 *   - a wallet's balance is ALWAYS `SUM(amount_minor)` over its own
 *     legs — never a cached column that could drift;
 *   - postings happen inside the caller's database transaction, so a
 *     status change and its money movement commit together or not at
 *     all.
 *
 * Accounts:
 *   wallet          the wallet side (walletId set)
 *   external:manual clearing account of manual, off-platform payments
 *   escrow:<roomId> per-match escrow holding players' stakes (walletId null)
 *   fees:platform   platform fee revenue
 */

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ledgerEntries } from "@/lib/db/schema/wallet";
import { db } from "@/lib/db";
import { WalletError } from "./errors";

/** One leg of a posting. Signed: positive = in, negative = out. */
export interface PostingLeg {
  account: string;
  walletId: string | null;
  amountMinor: number;
}

export interface Posting {
  legs: PostingLeg[];
}

/**
 * Assert the double-entry invariant BEFORE touching the database:
 * every posting must sum to exactly zero.
 */
export function assertBalanced(posting: Posting): void {
  const total = posting.legs.reduce((sum, leg) => sum + leg.amountMinor, 0);
  if (total !== 0) {
    throw new WalletError(
      "internal",
      `Unbalanced ledger posting (sum=${total})`,
    );
  }
  for (const leg of posting.legs) {
    if (!Number.isSafeInteger(leg.amountMinor) || leg.amountMinor === 0) {
      throw new WalletError("internal", "Invalid ledger leg amount");
    }
  }
}

/** Reverse any posting (compensating entry — history is never erased). */
export function invert(posting: Posting): Posting {
  return {
    legs: posting.legs.map((leg) => ({ ...leg, amountMinor: -leg.amountMinor })),
  };
}

// ---------------------------------------------------------------------------
// Manual points — no provider, no rail. Points are credited by an
// administrator after an off-platform payment, debited when a withdrawal
// request is opened, and credited back when that request is rejected.
// `external:manual` is the clearing account representing "outside the app".
// ---------------------------------------------------------------------------

/** Clearing account for every manual (off-platform) movement. */
export const MANUAL_ACCOUNT = "external:manual";

/**
 * MANUAL CREDIT — points enter the user's wallet:
 *   wallet +amount, external:manual −amount
 *
 * Used by an admin credit (`adjustment`) and by a withdrawal refund.
 */
export function manualCreditPosting(input: {
  walletId: string;
  amountMinor: number;
}): Posting {
  const posting: Posting = {
    legs: [
      { account: "wallet", walletId: input.walletId, amountMinor: input.amountMinor },
      { account: MANUAL_ACCOUNT, walletId: null, amountMinor: -input.amountMinor },
    ],
  };
  assertBalanced(posting);
  return posting;
}

/**
 * MANUAL DEBIT — points leave the user's wallet:
 *   wallet −amount, external:manual +amount
 *
 * Used by an admin debit (`adjustment`) and by a withdrawal request at
 * creation. A rejection simply posts the inverse (`invert`).
 */
export function manualDebitPosting(input: {
  walletId: string;
  amountMinor: number;
}): Posting {
  return invert(manualCreditPosting(input));
}

// ---------------------------------------------------------------------------
// Game stakes (mises) — INTERNAL movements: no provider, no external rail.
// The escrow account namespaces the frozen pot per match. See
// docs/wallet-mises-jeux.md for the full lifecycle.
// ---------------------------------------------------------------------------

/**
 * STAKE hold — a player's stake leaves their wallet into the per-match
 * escrow. The stake is taken BEFORE the match (no credit play):
 *   wallet:<player> −S, escrow:<roomId> +S
 */
export function stakePosting(input: {
  walletId: string;
  roomId: string;
  amountMinor: number;
}): Posting {
  const posting: Posting = {
    legs: [
      { account: "wallet", walletId: input.walletId, amountMinor: -input.amountMinor },
      { account: `escrow:${input.roomId}`, walletId: null, amountMinor: input.amountMinor },
    ],
  };
  assertBalanced(posting);
  return posting;
}

/**
 * PAYOUT — the pot leaves escrow to the winner(s), minus the platform rake:
 *   escrow:<roomId> −pot, wallet:<winner_i> +payout_i, fees:platform +rake
 *
 * The winners' shares and the rake MUST close the pot exactly
 * (Σ payouts + rake = pot) — the builder refuses any missing or extra unit,
 * so a race in the split arithmetic can never silently mint or burn money.
 * `payouts` may hold several winners (shared pot); one leg per winner.
 */
export function payoutPosting(input: {
  roomId: string;
  potMinor: number;
  rakeMinor: number;
  payouts: readonly { walletId: string; amountMinor: number }[];
}): Posting {
  const paid = input.payouts.reduce((sum, p) => sum + p.amountMinor, 0);
  if (paid + input.rakeMinor !== input.potMinor) {
    throw new WalletError(
      "internal",
      `Payout does not close the pot (payouts=${paid} + rake=${input.rakeMinor} ≠ pot=${input.potMinor})`,
    );
  }
  const legs: PostingLeg[] = [
    { account: `escrow:${input.roomId}`, walletId: null, amountMinor: -input.potMinor },
  ];
  for (const p of input.payouts) {
    legs.push({ account: "wallet", walletId: p.walletId, amountMinor: p.amountMinor });
  }
  if (input.rakeMinor > 0) {
    legs.push({ account: "fees:platform", walletId: null, amountMinor: input.rakeMinor });
  }
  const posting: Posting = { legs };
  assertBalanced(posting);
  return posting;
}

/**
 * STAKE refund — the exact inverse of a hold: used for a draw, or a match
 * that never started (cancelled in lobby). Escrow drains back to the player:
 *   escrow:<roomId> −S, wallet:<player> +S
 */
export function stakeRefundPosting(input: {
  walletId: string;
  roomId: string;
  amountMinor: number;
}): Posting {
  return invert(stakePosting(input));
}

type DbOrTx = PostgresJsDatabase | Parameters<Parameters<PostgresJsDatabase["transaction"]>[0]>[0];

/**
 * Insert the legs of one posting. Call INSIDE a database transaction
 * together with the status transition it belongs to.
 */
export async function postLedger(
  tx: DbOrTx,
  input: {
    transactionId: string;
    currency: string;
    posting: Posting;
  },
): Promise<void> {
  assertBalanced(input.posting);
  if (input.posting.legs.length === 0) return;
  await tx.insert(ledgerEntries).values(
    input.posting.legs.map((leg) => ({
      id: randomUUID(),
      transactionId: input.transactionId,
      walletId: leg.walletId,
      account: leg.account,
      amountMinor: leg.amountMinor,
      currency: input.currency,
    })),
  );
}

/**
 * The balance: SUM of the wallet's ledger legs. Read fresh from the
 * ledger every time — the ledger is the source of truth, a balance
 * column could only ever be a cache of this.
 *
 * int8 sums come back as strings from postgres.js; `toAmount` converts
 * exactly (integer strings → Number is lossless below 2^53).
 */
export async function getBalanceMinor(walletId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<string | null>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.walletId} = ${walletId}`);
  return toAmount(rows[0]?.total ?? 0);
}

/** Exact string/bigint → safe integer (never a float parse). */
export function toAmount(value: string | number | bigint | null): number {
  if (value === null) return 0;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new WalletError("internal", "Non-integer amount from database");
    }
    return value;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new WalletError("internal", "Amount out of safe range");
  }
  return parsed;
}

/** All ledger entries of a transaction, oldest first (details views). */
export async function getLedgerForTransaction(transactionId: string) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(sql`${ledgerEntries.transactionId} = ${transactionId}`)
    .orderBy(ledgerEntries.createdAt);
  return rows;
}
