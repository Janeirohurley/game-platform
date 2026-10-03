import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReconciliationRunForm } from "@/components/admin/reconciliation-run-form";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";
import {
  resolveReconciliationIssueAction,
  runReconciliationAction,
} from "@/lib/admin/wallet-actions";
import { listEffectiveProviders } from "@/lib/wallet/provider-config";
import { listReconciliationIssues } from "@/lib/wallet/reconciliation";

export const metadata: Metadata = {
  title: "Réconciliation — Administration",
};

const PAGE_SIZE = 20;
const STATUSES = ["open", "acknowledged", "resolved"] as const;

/**
 * Phase 12 — reconciliation console: run the bounded comparison
 * (ledger invariants + provider listing) per provider, and review the
 * findings. Issues are append-only: resolving marks a row, nothing is
 * ever rewritten to make the discrepancy disappear.
 */
export default async function AdminReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; provider?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const status = (STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as (typeof STATUSES)[number])
    : undefined;
  const provider = params.provider?.trim() || undefined;
  const page = parsePositiveInt(params.page, 1);

  const [providers, issues] = await Promise.all([
    listEffectiveProviders(),
    listReconciliationIssues({
      status,
      provider,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(issues.total / PAGE_SIZE));
  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    query.set("page", String(target));
    if (status) query.set("status", status);
    if (provider) query.set("provider", provider);
    return `/admin/reconciliation?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Réconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparaison bornée entre le grand livre interne et les
          enregistrements du rail — les écarts sont ENREGISTRÉS, jamais
          corrigés en silence.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lancer un contrôle</CardTitle>
          <CardDescription>
            Fenêtre glissante de 7 jours : intégrité du grand livre, soldes
            négatifs, doublons, puis listing côté fournisseur s&apos;il le
            supporte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReconciliationRunForm
            providers={providers.map((p) => ({ id: p.id, name: p.name }))}
            action={runReconciliationAction}
          />
        </CardContent>
      </Card>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <NativeSelect
          name="status"
          defaultValue={status ?? ""}
          aria-label="Statut"
        >
          <NativeSelectOption value="">Tous les statuts</NativeSelectOption>
          {STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="provider"
          defaultValue={provider ?? ""}
          aria-label="Fournisseur"
        >
          <NativeSelectOption value="">Tous les fournisseurs</NativeSelectOption>
          {providers.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
        {(status || provider) && (
          <Link
            href="/admin/reconciliation"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Détectée</TableHead>
              <TableHead>Anomalie</TableHead>
              <TableHead className="hidden sm:table-cell">Fournisseur</TableHead>
              <TableHead>Sévérité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden md:table-cell">Transaction</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aucune anomalie — la réconciliation est propre.
                </TableCell>
              </TableRow>
            )}
            {issues.rows.map((issue) => (
              <TableRow key={issue.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {issue.detectedAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{issue.issueType}</p>
                  <p className="max-w-56 truncate font-mono text-xs text-muted-foreground">
                    {issue.details
                      ? JSON.stringify(issue.details).slice(0, 100)
                      : "—"}
                  </p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {issue.provider}
                </TableCell>
                <TableCell>
                  <StatusPill status={issue.severity} />
                </TableCell>
                <TableCell>
                  <StatusPill status={issue.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {issue.transactionId ? (
                    <Link
                      href={`/admin/transactions/${issue.transactionId}`}
                      className="font-mono text-xs underline underline-offset-4"
                    >
                      {issue.transactionId.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {issue.status !== "resolved" ? (
                    <ActionButton
                      action={resolveReconciliationIssueAction}
                      args={{ issueId: issue.id }}
                      variant="outline"
                    >
                      Résoudre
                    </ActionButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={page}
        totalPages={totalPages}
        total={issues.total}
        buildHref={buildHref}
        noun="anomalie"
      />
    </div>
  );
}
