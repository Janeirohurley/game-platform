/**
 * Engine integration tests — the real machine against the real
 * database, settled through the REAL signature-verified webhook path
 * (the sandbox settlement hook produces a signed payload that goes
 * through exactly the code a provider callback hits).
 *
 * Covered here (unit tests cover the pure parts):
 *   - wallet creation is conflict-safe
 *   - deposits credit ONLY at settlement, exactly once (dedupe)
 *   - client idempotency: replay → same row; conflict → typed error
 *   - withdrawals reserve under a lock; failure/cancel release the
 *     reserve with a compensating posting; overdraft is impossible
 *   - concurrent withdrawals: at most one can reserve
 *   - invalid webhook signature → rejected, nothing changes
 *   - lying webhook (currency) → reconciliation issue, no money moves
 *   - refunds debit at creation and complete against the reserve
 *   - provider config can only NARROW an adapter (never widen)
 *
 * The suite is skipped when DATABASE_URL is absent. It creates its own
 * user/wallets and removes them afterwards.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

process.env.SANDBOX_MOMO_WEBHOOK_SECRET ??= "db-integration-secret-0123456789";
process.env.WALLET_DEFAULT_CURRENCY ??= "BIF";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import {
  ledgerEntries,
  providerAccounts,
  providerConfigs,
  providerEvents,
  reconciliationRecords,
  wallets,
  walletTransactions,
} from "@/lib/db/schema/wallet";
import { WalletError, type WalletErrorCode } from "./errors";
import {
  cancelOperation,
  createOperation,
  getTransactionRow,
  refundDeposit,
} from "./engine";
import { processProviderWebhook, simulateProviderSettlement } from "./events";
import { computeFees } from "./fees";
import { getBalanceMinor, getLedgerForTransaction } from "./ledger";
import { requireActiveProvider } from "./provider-config";
import { paymentProviderRegistry } from "./providers";
import { BasePaymentProvider } from "./providers/base";
import {
  SANDBOX_MOMO_ID,
  SANDBOX_MOMO_SIGNATURE_HEADER,
  SandboxMobileMoneyProvider,
  signSandboxWebhook,
} from "./providers/sandbox-momo";
import type { ProviderInfo } from "./providers/types";
import { ensureWallet } from "./wallet";

const HAS_DB = !!process.env.DATABASE_URL;
const SECRET = process.env.SANDBOX_MOMO_WEBHOOK_SECRET as string;

const USER_ID = `test-wallet-${randomUUID().slice(0, 12)}`;
const EMAIL = `${USER_ID}@example.test`;
const TEST_RAIL_ID = "test-rail";

/** Minimal rail used to prove config NARROWING without touching the
 *  reference provider's own configuration row. */
class TestRailProvider extends BasePaymentProvider {
  getProviderInfo(): ProviderInfo {
    return {
      id: TEST_RAIL_ID,
      name: "Test Rail",
      environment: "sandbox",
      capabilities: ["DEPOSIT"],
      supportedCurrencies: ["BIF"],
    };
  }
}

async function expectWalletError(
  code: WalletErrorCode,
  run: () => Promise<unknown>,
): Promise<void> {
  let thrown: unknown = null;
  try {
    await run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(WalletError);
  expect((thrown as WalletError).code).toBe(code);
}

/** Deliver a signed payload through the real webhook entry point. */
function signedWebhook(payload: unknown): {
  rawBody: string;
  headers: Headers;
} {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    headers: new Headers({
      [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, SECRET),
    }),
  };
}

/** Settle an in-flight transaction through the signed webhook path. */
async function settle(
  transactionId: string,
  outcome: "succeeded" | "failed",
): Promise<{ outcome: string; applied: boolean; reason?: string }> {
  const row = await getTransactionRow(transactionId);
  if (!row?.provider || !row.providerTransactionId) {
    throw new Error("settle(): transaction has not reached the provider");
  }
  const adapter = paymentProviderRegistry.require(
    row.provider,
  ) as SandboxMobileMoneyProvider;
  const webhook = await adapter.simulateSettlement({
    reference: row.id,
    providerTransactionId: row.providerTransactionId,
    outcome,
  });
  return processProviderWebhook({
    providerId: row.provider,
    rawBody: webhook.rawBody,
    headers: webhook.headers,
  });
}

const dbSuite = HAS_DB ? describe : describe.skip;

dbSuite("wallet engine (database integration)", () => {
  let walletId = "";
  let walletUserId = USER_ID;
  /** Withdrawal fee for an amount, from the EFFECTIVE config (a dev
   *  provider_configs row may re-price — expectations stay exact). */
  let feeOn: (amount: number) => number = () => 0;

  beforeAll(async () => {
    await db
      .insert(user)
      .values({ id: USER_ID, name: "Wallet Test", email: EMAIL });

    if (!paymentProviderRegistry.has(TEST_RAIL_ID)) {
      paymentProviderRegistry.register(new TestRailProvider());
    }

    // The reference rail must be usable (secret set above; config row,
    // if any, must not disable it) — otherwise the suite cannot run.
    const { config } = await requireActiveProvider({
      provider: SANDBOX_MOMO_ID,
      currency: "BIF",
      capability: "DEPOSIT",
    });
    feeOn = (amount) => computeFees(amount, config.fees).totalFee;
  }, 30_000);

  afterAll(async () => {
    const txScope = sql`(select id from wallet_transactions where wallet_id in (select id from wallets where user_id = ${USER_ID}))`;
    await db
      .delete(providerEvents)
      .where(sql`transaction_id in ${txScope}`);
    await db
      .delete(reconciliationRecords)
      .where(sql`transaction_id in ${txScope}`);
    await db
      .delete(ledgerEntries)
      .where(sql`wallet_id in (select id from wallets where user_id = ${USER_ID})`);
    await db
      .delete(providerAccounts)
      .where(sql`wallet_id in (select id from wallets where user_id = ${USER_ID})`);
    await db
      .delete(walletTransactions)
      .where(sql`wallet_id in (select id from wallets where user_id = ${USER_ID})`);
    await db.delete(providerConfigs).where(eq(providerConfigs.provider, TEST_RAIL_ID));
    await db.delete(wallets).where(eq(wallets.userId, USER_ID));
    await db.delete(user).where(eq(user.id, USER_ID));
  }, 30_000);

  test(
    "wallet creation is conflict-safe (one row per user+currency)",
    async () => {
      const first = await ensureWallet(USER_ID, "BIF");
      const second = await ensureWallet(USER_ID, "BIF");
      expect(second.id).toBe(first.id);
      walletId = first.id;
      walletUserId = first.userId;

      const rows = await db
        .select({ id: wallets.id })
        .from(wallets)
        .where(eq(wallets.userId, USER_ID));
      expect(rows.length).toBe(1);
      expect(await getBalanceMinor(walletId)).toBe(0);
    },
    20_000,
  );

  test(
    "deposit credits ONLY at settlement, exactly once (double-entry + dedupe)",
    async () => {
      const created = await createOperation({
        userId: walletUserId,
        type: "deposit",
        provider: SANDBOX_MOMO_ID,
        amountMinor: 10_000,
        currency: "BIF",
        idempotencyKey: `dep-lifecycle-${randomUUID()}`,
      });
      expect(created.duplicate).toBe(false);
      expect(created.transaction.status).toBe("processing");
      expect(created.transaction.providerTransactionId).toMatch(/^momo_/);

      // Nothing is credited before an authoritative outcome.
      expect(await getBalanceMinor(walletId)).toBe(0);

      // Build the signed settlement webhook, deliver it TWICE.
      const adapter = paymentProviderRegistry.require(
        SANDBOX_MOMO_ID,
      ) as SandboxMobileMoneyProvider;
      const webhook = await adapter.simulateSettlement({
        reference: created.transaction.id,
        providerTransactionId: created.transaction.providerTransactionId as string,
        outcome: "succeeded",
      });

      const first = await processProviderWebhook({
        providerId: SANDBOX_MOMO_ID,
        rawBody: webhook.rawBody,
        headers: webhook.headers,
      });
      expect(first.outcome).toBe("processed");
      expect(first.applied).toBe(true);

      const settledRow = await getTransactionRow(created.transaction.id);
      expect(settledRow?.status).toBe("succeeded");
      expect(await getBalanceMinor(walletId)).toBe(10_000);

      // Double-entry: legs sum to zero; wallet carries the credit.
      const ledger = await getLedgerForTransaction(created.transaction.id);
      expect(ledger.length).toBeGreaterThanOrEqual(2);
      expect(ledger.reduce((sum, leg) => sum + leg.amountMinor, 0)).toBe(0);
      expect(ledger.some((leg) => leg.amountMinor === 10_000)).toBe(true);
      // The credit lands on THIS wallet (other legs may carry no wallet).
      expect(
        ledger.some((leg) => leg.walletId === walletId),
      ).toBe(true);

      // Redelivery of the SAME event id is a no-op.
      const second = await processProviderWebhook({
        providerId: SANDBOX_MOMO_ID,
        rawBody: webhook.rawBody,
        headers: webhook.headers,
      });
      expect(second.outcome).toBe("duplicate");
      expect(second.applied).toBe(false);
      expect(await getBalanceMinor(walletId)).toBe(10_000);
    },
    30_000,
  );

  test(
    "client idempotency: replay returns the same row, a different request with the same key is rejected",
    async () => {
      const key = `dep-idem-${randomUUID()}`;
      const request = {
        userId: walletUserId,
        type: "deposit" as const,
        provider: SANDBOX_MOMO_ID,
        amountMinor: 5_000,
        currency: "BIF",
        idempotencyKey: key,
      };

      const first = await createOperation(request);
      const replay = await createOperation(request);
      expect(replay.duplicate).toBe(true);
      expect(replay.transaction.id).toBe(first.transaction.id);

      await expectWalletError("idempotency_conflict", () =>
        createOperation({ ...request, amountMinor: 6_000 }),
      );

      // The replayed deposit never settled — no balance movement.
      expect(await getBalanceMinor(walletId)).toBe(10_000);
    },
    20_000,
  );

  test(
    "simulateProviderSettlement (dev hook) settles through the verified webhook path",
    async () => {
      const created = await createOperation({
        userId: walletUserId,
        type: "deposit",
        provider: SANDBOX_MOMO_ID,
        amountMinor: 20_000,
        currency: "BIF",
        idempotencyKey: `dep-fund-${randomUUID()}`,
      });
      expect(created.transaction.status).toBe("processing");

      const result = await simulateProviderSettlement({
        transactionId: created.transaction.id,
        providerId: SANDBOX_MOMO_ID,
        providerTransactionId: created.transaction
          .providerTransactionId as string,
        reference: created.transaction.id,
        outcome: "succeeded",
      });
      expect(result.outcome).toBe("processed");
      expect(result.applied).toBe(true);
      expect(await getBalanceMinor(walletId)).toBe(30_000);

      // The webhook event is on the audit trail.
      const events = await db
        .select({ type: providerEvents.type })
        .from(providerEvents)
        .where(
          sql`${providerEvents.provider} = ${SANDBOX_MOMO_ID} and ${providerEvents.transactionId} = ${created.transaction.id}`,
        );
      expect(events.map((e) => e.type)).toContain("deposit.succeeded");
    },
    30_000,
  );

  test(
    "withdrawal reserves funds; a provider failure releases the reserve",
    async () => {
      const amount = 4_000;
      const reserve = amount + feeOn(amount);

      const created = await createOperation({
        userId: walletUserId,
        type: "withdrawal",
        provider: SANDBOX_MOMO_ID,
        amountMinor: amount,
        currency: "BIF",
        destinationRef: "+25771234567",
        idempotencyKey: `wd-fail-${randomUUID()}`,
      });
      expect(created.transaction.status).toBe("processing");
      expect(await getBalanceMinor(walletId)).toBe(30_000 - reserve);

      const settled = await settle(created.transaction.id, "failed");
      expect(settled.applied).toBe(true);

      const row = await getTransactionRow(created.transaction.id);
      expect(row?.status).toBe("failed");
      expect(await getBalanceMinor(walletId)).toBe(30_000);

      // Compensating posting exists — the original debit was NOT deleted.
      const ledger = await getLedgerForTransaction(created.transaction.id);
      expect(ledger.reduce((sum, leg) => sum + leg.amountMinor, 0)).toBe(0);
    },
    30_000,
  );

  test(
    "cancelling an accepted withdrawal releases the reserve",
    async () => {
      const amount = 3_000;
      const created = await createOperation({
        userId: walletUserId,
        type: "withdrawal",
        provider: SANDBOX_MOMO_ID,
        amountMinor: amount,
        currency: "BIF",
        destinationRef: "+25771234567",
        idempotencyKey: `wd-cancel-${randomUUID()}`,
      });
      expect(await getBalanceMinor(walletId)).toBe(
        30_000 - amount - feeOn(amount),
      );

      const cancelled = await cancelOperation({
        userId: walletUserId,
        transactionId: created.transaction.id,
      });
      expect(cancelled.status).toBe("cancelled");
      expect(await getBalanceMinor(walletId)).toBe(30_000);
    },
    30_000,
  );

  test(
    "insufficient funds are rejected before anything is reserved",
    async () => {
      await expectWalletError("insufficient_funds", () =>
        createOperation({
          userId: walletUserId,
          type: "withdrawal",
          provider: SANDBOX_MOMO_ID,
          amountMinor: 1_000_000,
          currency: "BIF",
          destinationRef: "+25771234567",
          idempotencyKey: `wd-poor-${randomUUID()}`,
        }),
      );
      expect(await getBalanceMinor(walletId)).toBe(30_000);
    },
    20_000,
  );

  test(
    "concurrent withdrawals: the wallet row lock allows at most one reserve",
    async () => {
      const amount = 16_000;
      const request = (key: string) => ({
        userId: walletUserId,
        type: "withdrawal" as const,
        provider: SANDBOX_MOMO_ID,
        amountMinor: amount,
        currency: "BIF",
        destinationRef: "+25771234567",
        idempotencyKey: key,
      });

      const results = await Promise.allSettled([
        createOperation(request(`wd-race-a-${randomUUID()}`)),
        createOperation(request(`wd-race-b-${randomUUID()}`)),
      ]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
      expect(
        (rejected[0] as PromiseRejectedResult).reason,
      ).toBeInstanceOf(WalletError);
      expect(
        ((rejected[0] as PromiseRejectedResult).reason as WalletError).code,
      ).toBe("insufficient_funds");

      // Exactly one reserve is held — release it via cancel.
      const winner = (fulfilled[0] as PromiseFulfilledResult<{
        transaction: { id: string };
      }>).value;
      expect(await getBalanceMinor(walletId)).toBe(
        30_000 - amount - feeOn(amount),
      );
      await cancelOperation({
        userId: walletUserId,
        transactionId: winner.transaction.id,
      });
      expect(await getBalanceMinor(walletId)).toBe(30_000);
    },
    40_000,
  );

  test(
    "an invalid webhook signature is rejected and changes nothing",
    async () => {
      const created = await createOperation({
        userId: walletUserId,
        type: "deposit",
        provider: SANDBOX_MOMO_ID,
        amountMinor: 7_000,
        currency: "BIF",
        idempotencyKey: `dep-badsig-${randomUUID()}`,
      });

      const adapter = paymentProviderRegistry.require(
        SANDBOX_MOMO_ID,
      ) as SandboxMobileMoneyProvider;
      const webhook = await adapter.simulateSettlement({
        reference: created.transaction.id,
        providerTransactionId: created.transaction
          .providerTransactionId as string,
        outcome: "succeeded",
      });

      // Re-sign with the WRONG secret and tamper the amount.
      const tampered = webhook.rawBody.replace("7000", "700000");
      await expectWalletError("webhook_verification_failed", () =>
        processProviderWebhook({
          providerId: SANDBOX_MOMO_ID,
          rawBody: tampered,
          headers: new Headers({
            [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(
              tampered,
              "attacker-secret-123456",
            ),
          }),
        }),
      );

      const row = await getTransactionRow(created.transaction.id);
      expect(row?.status).toBe("processing");
      expect(await getBalanceMinor(walletId)).toBe(30_000);
    },
    30_000,
  );

  test(
    "a webhook lying about the CURRENCY writes a reconciliation issue and moves no money",
    async () => {
      const created = await createOperation({
        userId: walletUserId,
        type: "deposit",
        provider: SANDBOX_MOMO_ID,
        amountMinor: 9_000,
        currency: "BIF",
        idempotencyKey: `dep-mismatch-${randomUUID()}`,
      });

      // Correctly signed, but claims USD while our transaction is BIF.
      const { rawBody, headers } = signedWebhook({
        event: {
          id: `evt_${randomUUID().replace(/-/g, "")}`,
          type: "payment.settled",
          created_at: new Date().toISOString(),
        },
        data: {
          transaction_ref: created.transaction.providerTransactionId,
          merchant_reference: created.transaction.id,
          operation: "deposit",
          status: "successful",
          amount: 9_000,
          currency: "USD",
        },
      });

      const result = await processProviderWebhook({
        providerId: SANDBOX_MOMO_ID,
        rawBody,
        headers,
      });
      expect(result.outcome).toBe("processed");
      expect(result.applied).toBe(false);
      expect(result.reason).toBe("currency_mismatch");

      const row = await getTransactionRow(created.transaction.id);
      expect(row?.status).toBe("processing");
      expect(await getBalanceMinor(walletId)).toBe(30_000);

      const issues = await db
        .select({ issueType: reconciliationRecords.issueType })
        .from(reconciliationRecords)
        .where(eq(reconciliationRecords.transactionId, created.transaction.id));
      expect(issues.map((i) => i.issueType)).toContain("currency_mismatch");
    },
    30_000,
  );

  test(
    "refunds debit the wallet at creation and complete against the reserve",
    async () => {
      // The 20,000 deposit settled above is the refund target.
      const funded = await db
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(
          sql`${walletTransactions.walletId} = ${walletId} and ${walletTransactions.grossAmount} = 20000 and ${walletTransactions.status} = 'succeeded'`,
        )
        .limit(1);
      expect(funded[0]).toBeDefined();

      const refund = await refundDeposit({
        userId: walletUserId,
        transactionId: funded[0].id,
        idempotencyKey: `refund-${randomUUID()}`,
      });
      expect(["created", "processing"]).toContain(refund.transaction.status);
      expect(await getBalanceMinor(walletId)).toBe(10_000);

      const settled = await settle(refund.transaction.id, "succeeded");
      expect(settled.applied).toBe(true);

      const row = await getTransactionRow(refund.transaction.id);
      expect(row?.status).toBe("succeeded");
      // Completing against the reserve changes nothing further.
      expect(await getBalanceMinor(walletId)).toBe(10_000);
    },
    30_000,
  );

  test(
    "provider config can NARROW an adapter but never widen it",
    async () => {
      // No config row → the adapter's declarations stand.
      const open = await requireActiveProvider({
        provider: TEST_RAIL_ID,
        currency: "BIF",
        capability: "DEPOSIT",
      });
      expect(open.config.capabilities).toContain("DEPOSIT");

      // Narrow to zero capabilities → capability_not_supported.
      await db
        .insert(providerConfigs)
        .values({ provider: TEST_RAIL_ID, capabilities: [] });
      await expectWalletError("capability_not_supported", () =>
        requireActiveProvider({
          provider: TEST_RAIL_ID,
          currency: "BIF",
          capability: "DEPOSIT",
        }),
      );

      // Disabled → provider_unavailable.
      await db
        .update(providerConfigs)
        .set({ enabled: false, capabilities: ["DEPOSIT"] })
        .where(eq(providerConfigs.provider, TEST_RAIL_ID));
      await expectWalletError("provider_unavailable", () =>
        requireActiveProvider({
          provider: TEST_RAIL_ID,
          currency: "BIF",
          capability: "DEPOSIT",
        }),
      );

      // Config claiming WITHDRAWAL cannot grant it — the adapter never
      // declared it. Intersection keeps the wallet safe.
      await db
        .update(providerConfigs)
        .set({ enabled: true, capabilities: ["DEPOSIT", "WITHDRAWAL"] })
        .where(eq(providerConfigs.provider, TEST_RAIL_ID));
      const narrowed = await requireActiveProvider({
        provider: TEST_RAIL_ID,
        currency: "BIF",
        capability: "DEPOSIT",
      });
      expect(narrowed.config.capabilities).toEqual(["DEPOSIT"]);
      await expectWalletError("capability_not_supported", () =>
        requireActiveProvider({
          provider: TEST_RAIL_ID,
          currency: "BIF",
          capability: "WITHDRAWAL",
        }),
      );

      // Currency narrowing: config may drop currencies the adapter has.
      await db
        .update(providerConfigs)
        .set({ supportedCurrencies: ["USD"] })
        .where(eq(providerConfigs.provider, TEST_RAIL_ID));
      await expectWalletError("validation", () =>
        requireActiveProvider({
          provider: TEST_RAIL_ID,
          currency: "BIF",
          capability: "DEPOSIT",
        }),
      );
    },
    30_000,
  );

  test(
    "final ledger balance is exact after every operation",
    async () => {
      // 10k + 20k credited; 20k refunded; everything else released.
      expect(await getBalanceMinor(walletId)).toBe(10_000);

      // The ledger itself agrees (no orphaned legs anywhere).
      const totals = await db
        .select({
          sum: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)`,
        })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.walletId, walletId));
      expect(Number(totals[0].sum)).toBe(10_000);
    },
    20_000,
  );
});
