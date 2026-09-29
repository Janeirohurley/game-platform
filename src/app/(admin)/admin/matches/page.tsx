import type { Metadata } from "next";

import MatchesTable from "@/components/shadcn-dashboard/blocks/datatable/datatable-01/matches-datatable";
import { GAMES } from "@/lib/games/registry";
import { listMatches } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";

export const metadata: Metadata = {
  title: "Matchs — Administration",
};

const PAGE_SIZE = 10;

/**
 * Phase 6 — the platform-wide MATCH AUDIT TRAIL (game_matches, one row
 * per participant). Filters (game, outcome) and page live in the URL;
 * the guard runs BEFORE any query. A finished match is server-owned —
 * the table exposes inspection, never mutation.
 */
export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; game?: string; outcome?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page, 1);
  // Only registry ids can reach the query (the game CHECK in the DB
  // would reject anything else anyway).
  const game = GAMES.some((g) => g.id === params.game) ? (params.game as string) : "";
  const outcome = ["win", "loss", "draw"].includes(params.outcome ?? "")
    ? (params.outcome as string)
    : "";

  const list = await listMatches({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    game: game || undefined,
    outcome: outcome || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Matchs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total.toLocaleString("fr-FR")} résultat
          {list.total > 1 ? "s" : ""} ingéré{list.total > 1 ? "s" : ""} (une ligne
          par participant) — écrits uniquement par le serveur temps réel.
        </p>
      </div>

      <MatchesTable
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        totalPages={list.totalPages}
        search={search}
        game={game}
        outcome={outcome}
        games={GAMES.map((g) => ({ id: g.id, title: g.title }))}
      />
    </div>
  );
}
