"use server";

/**
 * Admin wallet server actions — the ONLY mutation path into the money
 * system from the console.
 *
 * Every action follows the house rules (lib/admin/actions.ts):
 *   1. re-verifies the caller's `admin` role SERVER-SIDE,
 *   2. validates against the registry / service layer (the console
 *      can never do more than the wallet core allows),
 *   3. writes an AUDIT row for ok AND error outcomes,
 *   4. returns { ok, message } — a real result, no fake success.
 *
 * Deliberately absent: any action that moves money on a user's behalf.
 * The console may inspect, verify (ask the rail), enable/disable
 * providers and resolve reconciliation findings — settlement itself
 * only ever comes from verified provider events.
 */

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { providerConfigs, reconciliationRecords } from "@/lib/db/schema/wallet";
import { verifyAndSettle } from "@/lib/wallet/engine";
import { WalletError } from "@/lib/wallet/errors";
import { getEffectiveProvider } from "@/lib/wallet/provider-config";
import {
  ensureBuiltinProviders,
  paymentProviderRegistry,
} from "@/lib/wallet/providers";
import { runReconciliation } from "@/lib/wallet/reconciliation";
import { writeAuditLog } from "./audit";
import { requireAdminSession } from "./session";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

function toMessage(error: unknown): string {
  // WalletError messages are written to be shown; anything else stays
  // server-side (it may contain provider payload fragments).
  if (error instanceof WalletError) return error.message;
  return "L'opération a échoué côté serveur.";
}

/**
 * Enable/disable a payment provider — one row flip, no deploy.
 * Inserting the row keeps the adapter's own environment (config can
 * narrow, never redefine what the adapter is).
 */
export async function setProviderEnabledAction(input: {
  provider: string;
  enabled: boolean;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const action = input.enabled
    ? "wallet.provider.enable"
    : "wallet.provider.disable";
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
    details: { provider: input.provider, enabled: input.enabled },
  };

  try {
    ensureBuiltinProviders();
    const adapter = paymentProviderRegistry.get(input.provider);
    if (!adapter) {
      throw new WalletError(
        "not_found",
        `Aucun fournisseur nommé « ${input.provider} ».`,
      );
    }
    const current = await getEffectiveProvider(input.provider);
    const environment =
      current?.environment ?? adapter.getProviderInfo().environment;

    await db
      .insert(providerConfigs)
      .values({
        provider: input.provider,
        enabled: input.enabled,
        environment,
      })
      .onConflictDoUpdate({
        target: providerConfigs.provider,
        set: { enabled: input.enabled, updatedAt: new Date() },
      });

    await writeAuditLog({ action, status: "ok", ...audit });
    revalidatePath("/admin/providers");
    return {
      ok: true,
      message: `${current?.name ?? input.provider} ${
        input.enabled ? "est activé" : "est désactivé"
      }.`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action,
      status: "error",
      ...audit,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

/** Run the reconciliation sweep for one provider (bounded window). */
export async function runReconciliationAction(input: {
  provider: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
    details: { provider: input.provider },
  };

  try {
    const summary = await runReconciliation({ provider: input.provider });
    await writeAuditLog({
      action: "wallet.reconciliation.run",
      status: "ok",
      ...audit,
      details: { ...audit.details, ...summary },
    });
    revalidatePath("/admin/reconciliation");
    return {
      ok: true,
      message: `${summary.provider} : ${summary.checkedInternal} transaction(s) contrôlé(s), ${summary.issuesRecorded} anomalie(s).`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.reconciliation.run",
      status: "error",
      ...audit,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

/** Mark a reconciliation finding as resolved (append-only history). */
export async function resolveReconciliationIssueAction(input: {
  issueId: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
    details: { issueId: input.issueId },
  };

  try {
    const rows = await db
      .select()
      .from(reconciliationRecords)
      .where(eq(reconciliationRecords.id, input.issueId))
      .limit(1);
    const issue = rows[0];
    if (!issue) {
      throw new WalletError("not_found", "Anomalie introuvable.");
    }
    if (issue.status === "resolved") {
      return { ok: true, message: "Déjà résolue." };
    }

    await db
      .update(reconciliationRecords)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedByUserId: session.user.id,
      })
      .where(eq(reconciliationRecords.id, input.issueId));

    await writeAuditLog({
      action: "wallet.reconciliation.resolve",
      status: "ok",
      ...audit,
      details: {
        ...audit.details,
        issueType: issue.issueType,
        provider: issue.provider,
        severity: issue.severity,
      },
    });
    revalidatePath("/admin/reconciliation");
    return { ok: true, message: "Anomalie marquée comme résolue." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.reconciliation.resolve",
      status: "error",
      ...audit,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

/**
 * Admin verification: ask the rail what actually happened to one
 * transaction and apply it through the normal settlement path. Works
 * even for a provider admins have disabled for NEW business — existing
 * operations must always be resolvable.
 */
export async function verifyTransactionAction(input: {
  transactionId: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const audit = {
    actor: { id: session.user.id, email: session.user.email },
    details: { transactionId: input.transactionId },
  };

  try {
    const result = await verifyAndSettle({
      transactionId: input.transactionId,
      source: "admin",
    });
    await writeAuditLog({
      action: "wallet.transaction.verify",
      status: "ok",
      ...audit,
      details: {
        ...audit.details,
        settled: result.settled,
        recognized: result.recognized,
        status: result.transaction.status,
      },
    });
    revalidatePath(`/admin/transactions/${input.transactionId}`);
    revalidatePath("/admin/transactions");
    return {
      ok: true,
      message: result.recognized
        ? `Le fournisseur confirme : ${result.transaction.status}.`
        : "Le fournisseur ne reconnaît pas cette transaction.",
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "wallet.transaction.verify",
      status: "error",
      ...audit,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}
