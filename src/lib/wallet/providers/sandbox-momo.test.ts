/**
 * SandboxMobileMoneyProvider — the reference adapter. Everything here
 * runs against its in-memory "rail": lifecycle, provider-side
 * idempotency, HMAC webhook verification (the exact scheme a real
 * adapter ships) and the sandbox settlement hook. No database, no
 * network — the wallet core is exercised separately in engine-db tests.
 */

import { describe, expect, test } from "bun:test";

import {
  SANDBOX_MOMO_ID,
  SANDBOX_MOMO_SIGNATURE_HEADER,
  SandboxMobileMoneyProvider,
  signSandboxWebhook,
} from "./sandbox-momo";
import { ProviderError } from "./types";

// Must be set before any call that reads the secret (getSecret()).
const SECRET = "unit-test-secret-long-enough-1234";
process.env.SANDBOX_MOMO_WEBHOOK_SECRET = SECRET;

function makeAdapter(): SandboxMobileMoneyProvider {
  return new SandboxMobileMoneyProvider();
}

function depositInput(overrides: Record<string, unknown> = {}) {
  return {
    reference: "internal-tx-1",
    idempotencyKey: "idem-key-1",
    amountMinor: 10_000,
    totalToCollectMinor: 10_700,
    currency: "BIF",
    expiresInSeconds: 300,
    ...overrides,
  };
}

function settlementPayload(fields: {
  ref: string;
  merchantReference?: string;
  operation?: string;
  status?: string;
  amount?: number;
  currency?: string;
  eventId?: string;
}) {
  return JSON.stringify({
    event: {
      id: fields.eventId ?? `evt_${Math.random().toString(36).slice(2)}`,
      type: "payment.settled",
      created_at: new Date().toISOString(),
    },
    data: {
      transaction_ref: fields.ref,
      merchant_reference: fields.merchantReference ?? "internal-tx-1",
      operation: fields.operation ?? "deposit",
      status: fields.status ?? "successful",
      amount: fields.amount ?? 10_700,
      currency: fields.currency ?? "BIF",
    },
  });
}

describe("provider info & availability", () => {
  test("declares a sandbox environment with the full async capability set", () => {
    const info = makeAdapter().getProviderInfo();
    expect(info.id).toBe(SANDBOX_MOMO_ID);
    expect(info.environment).toBe("sandbox");
    expect(info.capabilities).toContain("DEPOSIT");
    expect(info.capabilities).toContain("WITHDRAWAL");
    expect(info.capabilities).toContain("WEBHOOK");
    expect(info.capabilities).toContain("TRANSACTION_STATUS");
    expect(info.capabilities).toContain("REFUND");
    expect(info.supportedCurrencies).toContain("BIF");
  });

  test("unavailable while the webhook secret is missing", async () => {
    const adapter = makeAdapter();
    const saved = process.env.SANDBOX_MOMO_WEBHOOK_SECRET;
    delete process.env.SANDBOX_MOMO_WEBHOOK_SECRET;
    const result = await adapter.checkAvailability();
    expect(result.available).toBe(false);
    expect(result.reason).toContain("SANDBOX_MOMO_WEBHOOK_SECRET");
    if (saved !== undefined) {
      process.env.SANDBOX_MOMO_WEBHOOK_SECRET = saved;
    }
    expect((await adapter.checkAvailability()).available).toBe(true);
  });
});

describe("deposit lifecycle", () => {
  test("creates a processing deposit with instructions", async () => {
    const adapter = makeAdapter();
    const result = await adapter.createDeposit(depositInput());
    expect(result.status).toBe("processing");
    expect(result.providerTransactionId).toMatch(/^momo_/);
    expect(result.instructions).toContain("Dial");
    expect(new Date(result.expiresAt!).getTime()).toBeGreaterThan(Date.now());
  });

  test("provider-side idempotency: same key → same transaction", async () => {
    const adapter = makeAdapter();
    const first = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-replay" }),
    );
    const second = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-replay" }),
    );
    expect(second.providerTransactionId).toBe(first.providerTransactionId);

    const other = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-other" }),
    );
    expect(other.providerTransactionId).not.toBe(first.providerTransactionId);
  });

  test("rejects malformed money before touching the rail", async () => {
    const adapter = makeAdapter();
    for (const bad of [
      depositInput({ amountMinor: 0 }),
      depositInput({ amountMinor: 1.5 }),
      depositInput({ currency: "usd" }),
      depositInput({ totalToCollectMinor: -1 }),
    ]) {
      await expect(adapter.createDeposit(bad)).rejects.toThrow(ProviderError);
    }
  });

  test("verifyTransaction reports rail truth (amount = what the rail collects)", async () => {
    const adapter = makeAdapter();
    const created = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-verify" }),
    );
    const verification = await adapter.verifyTransaction({
      providerTransactionId: created.providerTransactionId,
      reference: "internal-tx-1",
      currency: "BIF",
    });
    expect(verification.verified).toBe(true);
    expect(verification.status).toBe("processing");
    expect(verification.amountMinor).toBe(10_700);
    expect(verification.currency).toBe("BIF");
  });

  test("verifyTransaction is authoritative when the id is unknown", async () => {
    const adapter = makeAdapter();
    const verification = await adapter.verifyTransaction({
      providerTransactionId: "momo_does_not_exist",
      reference: "nope",
      currency: "BIF",
    });
    expect(verification.verified).toBe(false);
    expect(verification.status).toBe("failed");
  });
});

describe("webhook signature verification", () => {
  test("signSandboxWebhook produces sha256=<64 hex>", () => {
    const signature = signSandboxWebhook("{}", SECRET);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  test("a correctly signed settlement payload normalizes", async () => {
    const adapter = makeAdapter();
    const rawBody = settlementPayload({ ref: "momo_x" });
    const result = await adapter.handleWebhook({
      rawBody,
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, SECRET),
      }),
    });
    expect(result.valid).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event!.type).toBe("deposit.succeeded");
    expect(result.event!.status).toBe("succeeded");
    expect(result.event!.amountMinor).toBe(10_700);
    expect(result.event!.currency).toBe("BIF");
    expect(result.event!.reference).toBe("internal-tx-1");
    expect(result.event!.providerTransactionId).toBe("momo_x");
  });

  test("rejects: missing header, wrong secret, tampered body, bad JSON", async () => {
    const adapter = makeAdapter();
    const rawBody = settlementPayload({ ref: "momo_x" });

    const missing = await adapter.handleWebhook({
      rawBody,
      headers: new Headers(),
    });
    expect(missing.valid).toBe(false);
    expect(missing.reason).toContain("Missing signature");

    const wrongSecret = await adapter.handleWebhook({
      rawBody,
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(
          rawBody,
          "attacker-secret-9999",
        ),
      }),
    });
    expect(wrongSecret.valid).toBe(false);
    expect(wrongSecret.reason).toContain("mismatch");

    const tampered = await adapter.handleWebhook({
      rawBody: rawBody.replace("10700", "1"),
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, SECRET),
      }),
    });
    expect(tampered.valid).toBe(false);

    const malformed = await adapter.handleWebhook({
      rawBody: "{not json",
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(
          "{not json",
          SECRET,
        ),
      }),
    });
    expect(malformed.valid).toBe(false);
    expect(malformed.reason).toContain("JSON");
  });

  test("correctly signed but unmodelled event types are acknowledged, not persisted", async () => {
    const adapter = makeAdapter();
    const rawBody = JSON.stringify({
      event: { id: "evt_other", type: "something.else", created_at: null },
      data: {},
    });
    const result = await adapter.handleWebhook({
      rawBody,
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, SECRET),
      }),
    });
    expect(result.valid).toBe(true);
    expect(result.event).toBeUndefined();
  });

  test("signed payload with a bad payload shape is rejected", async () => {
    const adapter = makeAdapter();
    const rawBody = JSON.stringify({ event: { id: 42 } });
    const result = await adapter.handleWebhook({
      rawBody,
      headers: new Headers({
        [SANDBOX_MOMO_SIGNATURE_HEADER]: signSandboxWebhook(rawBody, SECRET),
      }),
    });
    expect(result.valid).toBe(false);
  });
});

describe("simulateSettlement (sandbox hook)", () => {
  test("flips the record and produces a payload its own verifier accepts", async () => {
    const adapter = makeAdapter();
    const created = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-sim", reference: "internal-sim" }),
    );

    const webhook = await adapter.simulateSettlement({
      reference: "internal-sim",
      providerTransactionId: created.providerTransactionId,
      outcome: "succeeded",
    });
    expect(
      webhook.headers.get(SANDBOX_MOMO_SIGNATURE_HEADER),
    ).toMatch(/^sha256=/);

    const verified = await adapter.handleWebhook(webhook);
    expect(verified.valid).toBe(true);
    expect(verified.event?.status).toBe("succeeded");
    expect(verified.event?.reference).toBe("internal-sim");
  });

  test("cannot settle twice", async () => {
    const adapter = makeAdapter();
    const created = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-twice", reference: "internal-twice" }),
    );
    await adapter.simulateSettlement({
      reference: "internal-twice",
      providerTransactionId: created.providerTransactionId,
      outcome: "succeeded",
    });
    await expect(
      adapter.simulateSettlement({
        reference: "internal-twice",
        providerTransactionId: created.providerTransactionId,
        outcome: "failed",
      }),
    ).rejects.toThrow(/already successful/);
  });
});

describe("withdrawals & refunds", () => {
  test("createWithdrawal → cancel un-reserves at the rail", async () => {
    const adapter = makeAdapter();
    const created = await adapter.createWithdrawal({
      reference: "internal-wd",
      idempotencyKey: "idem-wd",
      amountMinor: 4_000,
      totalToDebitMinor: 4_000,
      currency: "BIF",
      destinationRef: "+25771234567",
      expiresInSeconds: 300,
    });
    expect(created.status).toBe("processing");

    const cancelled = await adapter.cancelWithdrawal({
      reference: "internal-wd",
      providerTransactionId: created.providerTransactionId,
    });
    expect(cancelled.status).toBe("cancelled");

    // Cancelling again is a typed rejection, not a second cancel.
    await expect(
      adapter.cancelWithdrawal({
        reference: "internal-wd",
        providerTransactionId: created.providerTransactionId,
      }),
    ).rejects.toThrow(/already cancelled/);
  });

  test("refund only from a settled deposit, idempotent per original", async () => {
    const adapter = makeAdapter();
    const created = await adapter.createDeposit(
      depositInput({ idempotencyKey: "idem-refund", reference: "internal-ref" }),
    );

    await expect(
      adapter.refundTransaction({
        reference: "internal-ref",
        providerTransactionId: created.providerTransactionId,
        amountMinor: 10_000,
        currency: "BIF",
        reason: "user_requested",
      }),
    ).rejects.toThrow(/Only a successful transaction/);

    await adapter.simulateSettlement({
      reference: "internal-ref",
      providerTransactionId: created.providerTransactionId,
      outcome: "succeeded",
    });

    const refund = await adapter.refundTransaction({
      reference: "internal-ref",
      providerTransactionId: created.providerTransactionId,
      amountMinor: 10_000,
      currency: "BIF",
      reason: "user_requested",
    });
    expect(refund.status).toBe("processing");
    expect(refund.instructions).toContain("Refund queued");

    const replay = await adapter.refundTransaction({
      reference: "internal-ref",
      providerTransactionId: created.providerTransactionId,
      amountMinor: 10_000,
      currency: "BIF",
      reason: "user_requested",
    });
    expect(replay.providerTransactionId).toBe(refund.providerTransactionId);
  });
});
