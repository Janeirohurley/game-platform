"use server";

/**
 * Admin server actions — the ONLY mutation path from the console.
 *
 * Every action:
 *   1. re-verifies the caller's platform `admin` role SERVER-SIDE
 *      (requireAdminSession — UI hiding is never the security),
 *   2. delegates to the Better Auth admin plugin (auth.api), which
 *      owns the business rules (self-ban, role hierarchy…),
 *   3. writes an AUDIT row (ok AND error outcomes) — Phase 11:
 *      « qui a fait quoi, sur qui, quand, avec quel paramètre »,
 *   4. returns a plain { ok, message } — real result, no fake success;
 *      failures surface the actual API error.
 *
 * No operation is invented: ban/unban/setRole/revoke sessions are the
 * plugin's endpoints, backed by the user.role/banned/ban_reason/
 * ban_expires columns added in Phase 1.
 */

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { requireAdminSession } from "@/lib/admin/session";
import { writeAuditLog } from "@/lib/admin/audit";

export interface AdminActionResult {
  ok: boolean;
  message: string;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "L'opération a échoué côté serveur.";
}

export async function banUserAction(input: {
  userId: string;
  userEmail: string;
  reason?: string;
  /** Duration in days; 0 / undefined = permanent. */
  days?: number;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  if (session.user.id === input.userId) {
    return { ok: false, message: "On ne bannit pas son propre compte." };
  }

  const auditBase = {
    actor: { id: session.user.id, email: session.user.email },
    target: { userId: input.userId, email: input.userEmail },
    details: {
      reason: input.reason?.trim() || null,
      days: input.days && input.days > 0 ? input.days : null,
    },
  };

  try {
    await auth.api.banUser({
      body: {
        userId: input.userId,
        banReason: input.reason?.trim() || undefined,
        banExpiresIn:
          input.days && input.days > 0 ? input.days * 24 * 60 * 60 : undefined,
      },
      headers: await headers(),
    });
    await writeAuditLog({ action: "ban", status: "ok", ...auditBase });
    return {
      ok: true,
      message: `${input.userEmail} est banni${input.days ? ` pour ${input.days} j` : " (permanent)"}.`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "ban",
      status: "error",
      ...auditBase,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export async function unbanUserAction(input: {
  userId: string;
  userEmail: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();

  const auditBase = {
    actor: { id: session.user.id, email: session.user.email },
    target: { userId: input.userId, email: input.userEmail },
  };

  try {
    await auth.api.unbanUser({
      body: { userId: input.userId },
      headers: await headers(),
    });
    await writeAuditLog({ action: "unban", status: "ok", ...auditBase });
    return { ok: true, message: `${input.userEmail} peut se reconnecter.` };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "unban",
      status: "error",
      ...auditBase,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export async function setUserRoleAction(input: {
  userId: string;
  userEmail: string;
  role: "admin" | "user";
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  if (session.user.id === input.userId) {
    return { ok: false, message: "On ne change pas son propre rôle." };
  }

  const auditBase = {
    actor: { id: session.user.id, email: session.user.email },
    target: { userId: input.userId, email: input.userEmail },
    details: { role: input.role },
  };

  try {
    await auth.api.setRole({
      body: { userId: input.userId, role: input.role },
      headers: await headers(),
    });
    await writeAuditLog({ action: "set_role", status: "ok", ...auditBase });
    return {
      ok: true,
      message: `${input.userEmail} est maintenant « ${input.role} ».`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "set_role",
      status: "error",
      ...auditBase,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export async function revokeUserSessionsAction(input: {
  userId: string;
  userEmail: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();

  const auditBase = {
    actor: { id: session.user.id, email: session.user.email },
    target: { userId: input.userId, email: input.userEmail },
  };

  try {
    await auth.api.revokeUserSessions({
      body: { userId: input.userId },
      headers: await headers(),
    });
    await writeAuditLog({
      action: "revoke_sessions",
      status: "ok",
      ...auditBase,
    });
    return { ok: true, message: `Sessions de ${input.userEmail} révoquées.` };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "revoke_sessions",
      status: "error",
      ...auditBase,
      errorMessage: message,
    });
    return { ok: false, message };
  }
}
