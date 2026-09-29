import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Admin audit log — the console's traceability backbone (Phase 11).
 *
 * One row per ADMIN ACTION ATTEMPT (success AND failure: a failed
 * privilege escalation attempt is exactly what an audit log is for).
 *
 * Deliberate design choices:
 *
 *  - NO foreign keys. An audit trail must survive account deletion and
 *    never block moderation (e.g. a GDPR erase). Ids are stored as
 *    plain text, denormalized copies of the identity strings (email,
 *    gamer tag) so the log stays readable even when the referenced
 *    account is gone.
 *  - No UPDATE/DELETE path anywhere in the app: append-only by
 *    construction (the DB itself could add protections later).
 *  - `details` (jsonb) carries the operation's parameters (ban reason,
 *    duration, role) — enough to reconstruct what happened, nothing
 *    more secret than what the action already did.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),

    /** The administrator who attempted the action (user.id). */
    actorId: text("actor_id").notNull(),
    /** Denormalized for readability when accounts vanish. */
    actorEmail: text("actor_email").notNull(),

    /** Machine-readable action name (`ban`, `unban`, `set_role`…). */
    action: text("action").notNull(),

    /** Target account (user.id) when the action targets one. */
    targetUserId: text("target_user_id"),
    targetEmail: text("target_email"),
    /** Gamer tag when known — denormalized, may point nowhere. */
    targetGamerTag: text("target_gamer_tag"),

    /** `ok` | `error` — failures are logged too. */
    status: text("status").notNull(),
    /** Error/API message verbatim when status = error. */
    errorMessage: text("error_message"),

    /** Action parameters: reason, days, role… */
    details: jsonb("details"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("admin_audit_log_created_idx").on(table.createdAt),
    index("admin_audit_log_actor_idx").on(table.actorId),
    index("admin_audit_log_action_idx").on(table.action),
  ],
);
