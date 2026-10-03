import type { Metadata } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/admin/list-pagination";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listWalletsAdmin } from "@/lib/admin/wallet-queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";
import { formatMoney } from "@/lib/wallet/money";

export const metadata: Metadata = {
  title: "Portefeuilles — Administration",
};

const PAGE_SIZE = 20;

/**
 * Phase 12 — READ-ONLY wallet administration: every wallet on the
 * platform with its LIVE ledger balance (never a cached column).
 * `page` and `q` live in the URL; the guard runs before any query.
 */
export default async function AdminWalletsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page, 1);

  const list = await listWalletsAdmin({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  const buildHref = (target: number) =>
    `/admin/wallets?page=${target}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Portefeuilles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total.toLocaleString("fr-FR")} portefeuille
          {list.total > 1 ? "s" : ""} — soldes sommés en direct depuis le
          grand livre, jamais cachés.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="E-mail, nom ou id…"
          className="w-full sm:w-72"
          aria-label="Rechercher un portefeuille"
        />
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
        {search && (
          <Link
            href="/admin/wallets"
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
              <TableHead>Propriétaire</TableHead>
              <TableHead className="hidden md:table-cell">
                Portefeuille
              </TableHead>
              <TableHead>Devise</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden lg:table-cell">Créé le</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.map((wallet) => (
              <TableRow key={wallet.id}>
                <TableCell>
                  <p className="truncate font-medium">
                    {wallet.ownerName ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {wallet.ownerEmail ?? "—"}
                  </p>
                </TableCell>
                <TableCell className="hidden font-mono text-xs md:table-cell">
                  {wallet.id.slice(0, 8)}…
                </TableCell>
                <TableCell>{wallet.currency}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(wallet.balanceMinor, wallet.currency)}
                </TableCell>
                <TableCell>
                  <StatusPill status={wallet.status} />
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                  {wallet.createdAt.toLocaleDateString("fr-FR")}
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
        noun="portefeuille"
      />
    </div>
  );
}
