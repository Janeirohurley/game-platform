import type { Metadata } from "next";

import GamersTable from "@/components/shadcn-dashboard/blocks/datatable/datatable-01/gamers-datatable";
import { listGamers } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";

export const metadata: Metadata = {
  title: "Gamers — Administration",
};

const PAGE_SIZE = 10;

/**
 * Phase 4 — READ-ONLY gamer directory: the `profiles` table joined back
 * to its auth account. `page` and `q` live in the URL (linkable views,
 * SQL LIMIT/OFFSET); the guard runs BEFORE any query.
 */
export default async function AdminGamersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page, 1);

  const list = await listGamers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Gamers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total.toLocaleString("fr-FR")} profil
          {list.total > 1 ? "s" : ""} gamer{list.total > 1 ? "s" : ""} —
          progression server-owned, recherche et pagination côté serveur.
        </p>
      </div>

      <GamersTable
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        totalPages={list.totalPages}
        search={search}
      />
    </div>
  );
}
