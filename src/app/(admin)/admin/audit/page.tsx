import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelativeTime } from "@/lib/admin/format";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { eq } from "drizzle-orm";
import { listAuditLog } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";

export const metadata: Metadata = {
  title: "Journal d'audit — Administration",
};

const PAGE_SIZE = 15;

const actionLabels: Record<string, string> = {
  ban: "bannissement",
  unban: "débannissement",
  set_role: "changement de rôle",
  revoke_sessions: "révocation de sessions",
};

/** Whitelist mirroring the actions the server actually writes. */
const KNOWN_ACTIONS = ["ban", "unban", "set_role", "revoke_sessions"];

function formatDetails(details: Record<string, unknown> | null): string {
  if (!details) return "—";
  const parts: string[] = [];
  if (typeof details.reason === "string" && details.reason) {
    parts.push(`motif : « ${details.reason} »`);
  }
  if (typeof details.days === "number" && details.days > 0) {
    parts.push(`${details.days} j`);
  }
  if (details.role === "admin" || details.role === "user") {
    parts.push(`rôle → ${details.role}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Phase 11 — the audit log console. Every admin action attempt (ok AND
 * error) is traceable: who, what, on whom, when, with which parameters,
 * and the verbatim error when it failed. Read-only by design — this
 * page never writes; rows are append-only (no FK, outlive deletion).
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; target?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1);
  const action = KNOWN_ACTIONS.includes(params.action ?? "")
    ? (params.action as string)
    : "all";
  const target = params.target?.trim() || undefined;

  // The target filter arrives as a raw user id from the drill-down;
  // resolve it to an email so the chip is human-readable. The filter
  // itself stays functional even when the account is gone (the log is
  // denormalized) — the chip just falls back to the id.
  let targetLabel: string | null = null;
  if (target) {
    const found = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, target))
      .limit(1);
    targetLabel = found[0]?.email ?? target;
  }

  const list = await listAuditLog({
    page,
    pageSize: PAGE_SIZE,
    action: action === "all" ? undefined : action,
    targetUserId: target,
  });

  const pageHref = (p: number) => {
    const query = new URLSearchParams();
    if (action !== "all") query.set("action", action);
    if (target) query.set("target", target);
    if (p > 1) query.set("page", String(p));
    const qs = query.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Journal d&apos;audit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toutes les tentatives d&apos;actions d&apos;administration — succès
          et échecs — en lecture seule, append-only.
        </p>
      </div>

      {/* Target filter (drill-down from a gamer detail page) */}
      {targetLabel && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Cible :</span>
          <Badge variant="secondary">{targetLabel}</Badge>
          <Link
            href={pageHref(1).replace(/[?&]target=[^&]*/, "").replace(/\?$/, "/admin/audit")}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            retirer le filtre
          </Link>
        </div>
      )}

      {/* Action filter — plain GET form: works without JS, URL-driven */}
      <form method="GET" className="flex items-center gap-2">
        <Select name="action" defaultValue={action}>
          <SelectTrigger className="w-64" aria-label="Filtrer par action">
            <SelectValue placeholder="Toutes les actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {Object.entries(actionLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
      </form>

      {list.rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldAlertIcon />
            </EmptyMedia>
            <EmptyTitle>
              {action === "all"
                ? "Aucune action enregistrée"
                : "Aucune action de ce type"}
            </EmptyTitle>
            <EmptyDescription>
              Chaque action d&apos;administration (succès ou échec) écrit
              une ligne immuable ici, avec son résultat réel.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead>Quand</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                  <TableHead>Paramètres</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Erreur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {list.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatRelativeTime(row.createdAt)}
                      </TableCell>
                    <TableCell className="text-sm">{row.actorEmail}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {actionLabels[row.action] ?? row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.targetGamerTag ? `@${row.targetGamerTag} · ` : ""}
                      {row.targetEmail ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDetails(row.details)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          row.status === "ok"
                            ? "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none"
                            : "bg-destructive/10! text-destructive! hover:bg-destructive/10! border-0 shadow-none"
                        }
                      >
                        {row.status === "ok" ? "succès" : "échec"}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-64 truncate text-xs text-destructive"
                      title={row.errorMessage ?? undefined}
                    >
                      {row.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm tabular-nums text-muted-foreground">
              {(list.page - 1) * PAGE_SIZE + 1}–
              {Math.min(list.page * PAGE_SIZE, list.total)} sur{" "}
              {list.total.toLocaleString("fr-FR")} entrées
            </p>
            {list.totalPages > 1 && (
              <Pagination className="mr-auto w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      text="Précédent"
                      href={list.page > 1 ? pageHref(list.page - 1) : undefined}
                      aria-disabled={list.page <= 1}
                      className={list.page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {Array.from({ length: list.totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === list.totalPages ||
                        Math.abs(p - list.page) <= 1,
                    )
                    .map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink href={pageHref(p)} isActive={p === list.page}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      text="Suivant"
                      href={
                        list.page < list.totalPages
                          ? pageHref(list.page + 1)
                          : undefined
                      }
                      aria-disabled={list.page >= list.totalPages}
                      className={
                        list.page >= list.totalPages
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </>
      )}
    </div>
  );
}
