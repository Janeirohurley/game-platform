/**
 * Webhook / event processing — the generic inbound path.
 *
 *   Provider Webhook → Adapter (verify + normalize) → provider_events
 *      → Transaction Engine → Ledger
 *
 * Guarantees:
 *  - SIGNATURE FIRST: nothing is parsed or persisted until the adapter
 *    reports `valid` (each adapter owns its provider's verification).
 *  - IDEMPOTENT: the event row is inserted with a UNIQUE
 *    (provider, provider_event_id) inside the SAME database
 *    transaction as the settlement — a duplicate delivery conflicts,
 *    is answered with success, and touches no money; a failed
 *    processing rolls the event back so the provider's retry can try
 *    again.
 *  - NO PAYLOAD LEAK: the engine only ever sees the normalized event;
 *    the stored payload is the normalized projection we build, never
 *    the raw body.
 */

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { providerEvents, walletTransactions } from "@/lib/db/schema/wallet";
import { WalletError } from "./errors";
import {
  applyProviderOutcomeInTx,
  type ExternalOutcome,
} from "./engine";
import { walletLog } from "./logger";
import { getEffectiveProvider } from "./provider-config";
import {
  ensureBuiltinProviders,
  paymentProviderRegistry,
} from "./providers";
import type { NormalizedProviderEvent, ProviderWebhookInput } from "./providers/types";

export interface WebhookProcessingResult {
  /** processed = applied/no-op; duplicate = already handled; … */
  outcome: "processed" | "duplicate" | "ignored" | "unresolved";
  applied: boolean;
  transactionId?: string;
  reason?: string;
}

/** Normalized event projection stored in provider_events.payload. */
function eventProjection(event: NormalizedProviderEvent) {
  return {
    status: event.status,
    type: event.type,
    providerTransactionId: event.providerTransactionId ?? null,
    reference: event.reference ?? null,
    amountMinor: event.amountMinor ?? null,
    currency: event.currency ?? null,
    occurredAt: event.occurredAt,
    failureReason: event.failureReason ?? null,
    operation: event.data?.operation ?? null,
  };
}

export async function processProviderWebhook(input: {
  providerId: string;
  rawBody: string;
  headers: Headers;
}): Promise<WebhookProcessingResult> {
  ensureBuiltinProviders();
  const adapter = paymentProviderRegistry.get(input.providerId);
  if (!adapter) {
    // Unknown provider id — 404, no information beyond that.
    throw new WalletError("not_found", "Unknown webhook endpoint.");
  }

  // 1) VERIFY — the adapter owns the provider's signature scheme.
  const verification = await adapter.handleWebhook({
    rawBody: input.rawBody,
    headers: input.headers,
  });
  if (!verification.valid) {
    walletLog("warn", "webhook.rejected", {
      provider: input.providerId,
      eventType: "webhook",
      reason: verification.reason,
    });
    throw new WalletError(
      "webhook_verification_failed",
      "Webhook verification failed.",
    );
  }

  const event = verification.event;
  if (!event) {
    // Valid signature, but an event type we don't model: acknowledge
    // (so the provider stops retrying) without persisting or acting.
    walletLog("info", "webhook.ignored", {
      provider: input.providerId,
      eventType: "webhook",
      reason: verification.reason,
    });
    return { outcome: "ignored", applied: false, reason: verification.reason };
  }

  // 2) DEDUPE + SETTLE atomically.
  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(providerEvents)
      .values({
        id: randomUUID(),
        provider: input.providerId,
        providerEventId: event.providerEventId,
        type: event.type,
        status: "received",
        signatureValid: true,
        providerTransactionId: event.providerTransactionId ?? null,
        payload: eventProjection(event),
      })
      .onConflictDoNothing({
        target: [providerEvents.provider, providerEvents.providerEventId],
      })
      .returning({ id: providerEvents.id });

    let eventRowId: string;

    if (inserted[0]) {
      eventRowId = inserted[0].id;
    } else {
      // Already recorded — this delivery is a duplicate.
      const existing = await tx
        .select()
        .from(providerEvents)
        .where(
          and(
            eq(providerEvents.provider, input.providerId),
            eq(providerEvents.providerEventId, event.providerEventId),
          ),
        )
        .limit(1);
      const row = existing[0];
      if (row && (row.status === "processed" || row.status === "ignored")) {
        return {
          outcome: "duplicate" as const,
          applied: false,
          transactionId: row.transactionId ?? undefined,
          reason: "event already processed",
        };
      }
      if (!row) {
        // Conflict not visible yet (concurrent insert rolled back) —
        // practically unreachable; treat as ignored rather than risk
        // double processing without a row.
        return {
          outcome: "ignored" as const,
          applied: false,
          reason: "concurrent duplicate",
        };
      }
      // Previous attempt FAILED (e.g. unresolved reference): retry now.
      eventRowId = row.id;
    }

    // 3) Resolve the internal transaction this event settles.
    const resolved = await resolveTransactionForEvent(
      tx,
      input.providerId,
      event,
    );
    if (!resolved) {
      await tx
        .update(providerEvents)
        .set({
          status: "failed",
          error: "Could not resolve an internal transaction for this event",
          processedAt: new Date(),
        })
        .where(eq(providerEvents.id, eventRowId));
      walletLog("warn", "webhook.unresolved", {
        provider: input.providerId,
        providerEventId: event.providerEventId,
        providerTransactionId: event.providerTransactionId,
        eventType: event.type,
      });
      return {
        outcome: "unresolved" as const,
        applied: false,
        reason: "unresolved reference",
      };
    }

    // 4) Apply through the settlement path (cross-checks + ledger).
    const applied = await applyProviderOutcomeInTx(tx, {
      transactionId: resolved.id,
      outcome: event.status as ExternalOutcome,
      source: "webhook",
      providerId: input.providerId,
      providerTransactionId: event.providerTransactionId,
      eventAmountMinor: event.amountMinor,
      eventCurrency: event.currency,
      failureReason: event.failureReason,
    });

    // 5) Finalize the event row in the same transaction.
    await tx
      .update(providerEvents)
      .set({
        status: "processed",
        transactionId: resolved.id,
        error: applied.applied ? null : (applied.reason ?? null),
        processedAt: new Date(),
      })
      .where(eq(providerEvents.id, eventRowId));

    return {
      outcome: "processed" as const,
      applied: applied.applied,
      transactionId: resolved.id,
      reason: applied.reason,
    };
  });

  walletLog(result.applied ? "info" : "warn", "webhook.processed", {
    provider: input.providerId,
    providerEventId: event.providerEventId,
    providerTransactionId: event.providerTransactionId,
    transactionId: result.transactionId,
    eventType: event.type,
    status: event.status,
    currency: event.currency,
    amountMinor: event.amountMinor,
    reason: result.reason,
    source: "webhook",
  });

  return result;
}

// ---------------------------------------------------------------------------
// Reference → internal transaction (inside the caller's transaction).
// ---------------------------------------------------------------------------

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Map a normalized event to the transaction it settles. Providers
 * echo our `reference` (the internal transaction id); refunds echo
 * `<originalId>:refund` and resolve to the refund row linked to that
 * original. Falls back to the provider transaction id when the
 * reference is absent.
 */
async function resolveTransactionForEvent(
  tx: DbTx,
  providerId: string,
  event: NormalizedProviderEvent,
): Promise<{ id: string } | null> {
  if (event.reference) {
    if (event.reference.endsWith(":refund")) {
      const originalId = event.reference.slice(0, -":refund".length);
      const rows = await tx
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.provider, providerId),
            eq(walletTransactions.type, "refund"),
            eq(walletTransactions.originalTransactionId, originalId),
          ),
        )
        .orderBy(desc(walletTransactions.createdAt))
        .limit(1);
      if (rows[0]) return rows[0];
    } else {
      const rows = await tx
        .select({ id: walletTransactions.id })
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.id, event.reference),
            eq(walletTransactions.provider, providerId),
          ),
        )
        .limit(1);
      if (rows[0]) return rows[0];
    }
  }
  if (event.providerTransactionId) {
    const rows = await tx
      .select({ id: walletTransactions.id })
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.provider, providerId),
          eq(walletTransactions.providerTransactionId, event.providerTransactionId),
        ),
      )
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sandbox settlement hook — dev tools & tests settle a payment through the
// REAL, signature-verified webhook path instead of bypassing it.
// Only possible when the adapter implements `simulateSettlement` AND the
// provider's environment is `sandbox` — production rails have no such hook.
// ---------------------------------------------------------------------------

export async function simulateProviderSettlement(input: {
  transactionId: string;
  providerTransactionId: string;
  providerId: string;
  reference: string;
  outcome: "succeeded" | "failed";
}): Promise<WebhookProcessingResult> {
  ensureBuiltinProviders();
  const adapter = paymentProviderRegistry.require(input.providerId);
  const config = await getEffectiveProvider(input.providerId);
  if (!config || config.environment !== "sandbox") {
    throw new WalletError(
      "forbidden",
      "Settlement can only be simulated for sandbox providers.",
    );
  }
  if (typeof adapter.simulateSettlement !== "function") {
    throw new WalletError(
      "capability_not_supported",
      "This provider does not support simulated settlement.",
    );
  }

  const webhookInput: ProviderWebhookInput = await adapter.simulateSettlement({
    reference: input.reference,
    providerTransactionId: input.providerTransactionId,
    outcome: input.outcome,
  });

  return processProviderWebhook({
    providerId: input.providerId,
    rawBody: webhookInput.rawBody,
    headers: webhookInput.headers,
  });
}

/** Provider events of one transaction (details views, admin). */
export async function getEventsForTransaction(transactionId: string) {
  return db
    .select()
    .from(providerEvents)
    .where(eq(providerEvents.transactionId, transactionId))
    .orderBy(desc(providerEvents.receivedAt));
}
