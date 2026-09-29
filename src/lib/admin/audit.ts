import "server-only";

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema/audit";

/**
 * Audit-trail writer for admin actions (Phase 11).
 *
 * Contract:
 *  - called INSIDE the server actions, after the operation attempt;
 *  - logs BOTH outcomes: `ok` and `error` (a failed escalation attempt
 *    is exactly what an audit trail exists for);
 *  - NEVER throws: an audit failure must not break the action the
 *    admin already sees as succeeded/failed (best-effort, with the
 *    failure printed to the server console so a broken audit pipeline
 *    is visible in dev).
 *
 * Append-only: nothing in the app ever updates or deletes a row.
 */
export interface AuditEntry {
  action: string;
  status: "ok" | "error";
  actor: { id: string; email: string };
  target?: {
    userId?: string;
    email?: string;
    gamerTag?: string | null;
  };
  details?: Record<string, unknown>;
  errorMessage?: string;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      id: randomUUID(),
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      action: entry.action,
      targetUserId: entry.target?.userId ?? null,
      targetEmail: entry.target?.email ?? null,
      targetGamerTag: entry.target?.gamerTag ?? null,
      status: entry.status,
      errorMessage: entry.errorMessage ?? null,
      details: entry.details ?? null,
    });
  } catch (error) {
    // Audit failures must not break the admin action; visible in dev.
    console.error("[audit] write failed:", error);
  }
}
