import type { Metadata } from "next";

import UsersTable from "@/components/shadcn-dashboard/blocks/datatable/datatable-01/datatable";
import { listUsers } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";

export const metadata: Metadata = {
  title: "Utilisateurs — Administration",
};

const PAGE_SIZE = 10;

/**
 * Phase 3 — READ-ONLY user administration. `page` and `q` live in the
 * URL so every view is linkable and the pagination stays server-side
 * (SQL LIMIT/OFFSET); the guard runs BEFORE any query.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page, 1);

  const list = await listUsers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Utilisateurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total.toLocaleString("fr-FR")} compte
          {list.total > 1 ? "s" : ""} Better Auth — recherche et pagination
          côté serveur.
        </p>
      </div>

      <UsersTable
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
