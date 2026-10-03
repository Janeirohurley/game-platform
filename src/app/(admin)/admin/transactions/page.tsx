import type { Metadata } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/admin/list-pagination";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listTransactionsAdmin } from "@/lib/admin/wallet-queries";
import {
  WALLET_TRANSACTION_STATUSES,
  WALLET_TRANSACTION_TYPES,
} from "@/lib/wallet/constants";
import { formatMoney } from "@/lib/wallet/money";

export const metadata: Metadata = {
  title: "Transactions — Administration",
};

const PAGE_SIZE = 20;

/**
 * Phase 12 — every wallet transaction on the platform, URL-driven
 * filters (type, status, provider, search), owner email inline. The
 * detail view carries the ledger + webhook audit trail.
 */
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    type?: string;
    status?: string;
    provider?: string;
  }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const validType = (WALLET_TRANSACTION_TYPES as readonly string[]).includes(
    params.type ?? "",
  )
    ? (params.type as (typeof WALLET_TRANSACTION_TYPES)[number])
    : undefined;
  const validStatus = (WALLET_TRANSACTION_STATUSES as readonly string[]).includes(
    params.status ?? "",
  )
    ? params.status
    : undefined;
  const provider = params.provider?.trim() || undefined;
  const page = parsePositiveInt(params.page, 1);

  const list = await listTransactionsAdmin({
    page,
    pageSize: PAGE_SIZE,
    type: validType,
    status: validStatus,
    provider,
    search: search || undefined,
  });

  const buildHref = (target: number) => {
    const query = new URLSearchParams();
    query.set("page", String(target));
    if (search) query.set("q", search);
    if (params.type) query.set("type", params.type);
    if (params.status) query.set("status", params.status);
    if (provider) query.set("provider", provider);
    return `/admin/transactions?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total.toLocaleString("fr-FR")} transaction
          {list.total > 1 ? "s" : ""} — dépôts, retraits et remboursements de
          tous les portefeuilles.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="Id, référence, e-mail…"
          className="w-full sm:w-64"
          aria-label="Rechercher"
        />
        <NativeSelect
          name="type"
          defaultValue={params.type ?? ""}
          aria-label="Type"
        >
          <NativeSelectOption value="">Tous les types</NativeSelectOption>
          {WALLET_TRANSACTION_TYPES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Statut"
        >
          <NativeSelectOption value="">Tous les statuts</NativeSelectOption>
          {WALLET_TRANSACTION_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
        {(search || params.type || params.status || provider) && (
          <Link
            href="/admin/transactions"
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
              <TableHead>Date</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Fournisseur</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.map(({ transaction: tx, ownerEmail }) => (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {tx.createdAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="max-w-40 truncate text-sm">
                  {ownerEmail ?? "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{tx.type}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {tx.provider ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {tx.type === "deposit" ? "" : "−"}
                  {formatMoney(tx.grossAmount, tx.currency)}
                </TableCell>
                <TableCell>
                  <StatusPill status={tx.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/transactions/${tx.id}`}
                    className="text-sm underline underline-offset-4"
                  >
                    Détail
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        buildHref={buildHref}
        noun="transaction"
      />
    </div>
  );
}
