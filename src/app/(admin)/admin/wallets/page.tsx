import type { Metadata } from "next";
import Link from "next/link";

import { ListPagination } from "@/components/admin/list-pagination";
import { PointsUsersTable } from "@/components/admin/points-users-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPointsOverview,
  listUsersWithBalance,
} from "@/lib/admin/points-queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";

export const metadata: Metadata = {
  title: "Points — Administration",
};

const PAGE_SIZE = 20;

/**
 * Points console: every user with their LIVE ledger balance (0 when no
 * wallet exists yet) and a credit/debit action. The balance is never a
 * stored column — it is summed from the append-only ledger.
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

  const [list, overview] = await Promise.all([
    listUsersWithBalance({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
    }),
    getPointsOverview(),
  ]);

  const buildHref = (target: number) =>
    `/admin/wallets?page=${target}${search ? `&q=${encodeURIComponent(search)}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">Points</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Soldes sommés en direct depuis le grand livre — jamais cachés.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/admin/withdrawals" />}
          >
            Demandes de retrait
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/admin/settings" />}
          >
            Tarifs
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Utilisateurs" value={overview.users.toLocaleString("fr-FR")} />
        <Stat
          label="Points en circulation"
          value={overview.pointsInCirculation.toLocaleString("fr-FR")}
        />
        <Stat
          label="Retraits en attente"
          value={overview.pendingWithdrawals.toLocaleString("fr-FR")}
        />
        <Stat
          label="Points à payer"
          value={overview.pendingWithdrawalPoints.toLocaleString("fr-FR")}
        />
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={search}
          placeholder="E-mail, nom ou pseudo…"
          className="w-full sm:w-72"
          aria-label="Rechercher un utilisateur"
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

      <PointsUsersTable rows={list.rows} />

      <ListPagination
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        buildHref={buildHref}
        noun="utilisateur"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
