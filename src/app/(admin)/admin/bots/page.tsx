import type { Metadata } from "next";
import Link from "next/link";

import { BotsAdmin } from "@/components/admin/bots-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listBotsAdmin } from "@/lib/admin/bot-queries";
import { requireAdminSession } from "@/lib/admin/session";
import { parsePositiveInt } from "@/lib/admin/url-params";
import { BOT_MODES, BOT_STATUSES } from "@/lib/db/schema/bots";
import { GAMES, GAME_IDS } from "@/lib/games/registry";

export const metadata: Metadata = {
  title: "Bots — Administration",
};

const PAGE_SIZE = 12;

const MODE_LABELS: Record<string, string> = {
  pool: "Réserve autonome",
  attached: "Rattaché à un compte",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Disponible",
  in_match: "En partie",
  disabled: "Désactivé",
};

/**
 * Bot control plane — the console where brains are authored, retuned,
 * attached to real accounts, and retired. All mutations go through the
 * audited server actions; this page only reads (server-side, paginated)
 * and renders one client island for the dialogs.
 */
export default async function AdminBotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    game?: string;
    mode?: string;
    status?: string;
  }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1);
  const q = params.q?.trim() ?? "";
  const game = (GAME_IDS as readonly string[]).includes(params.game ?? "")
    ? (params.game as string)
    : "all";
  const mode = (BOT_MODES as readonly string[]).includes(params.mode ?? "")
    ? (params.mode as string)
    : "all";
  const status = (BOT_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as string)
    : "all";

  const list = await listBotsAdmin({
    page,
    pageSize: PAGE_SIZE,
    search: q || undefined,
    gameId: game === "all" ? undefined : game,
    mode: mode === "all" ? undefined : (mode as (typeof BOT_MODES)[number]),
    status:
      status === "all" ? undefined : (status as (typeof BOT_STATUSES)[number]),
  });

  const hasFilters =
    Boolean(q) || game !== "all" || mode !== "all" || status !== "all";

  const pageHref = (p: number) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    if (game !== "all") query.set("game", game);
    if (mode !== "all") query.set("mode", mode);
    if (status !== "all") query.set("status", status);
    if (p > 1) query.set("page", String(p));
    const qs = query.toString();
    return qs ? `/admin/bots?${qs}` : "/admin/bots";
  };

  const games = GAMES.map((game) => ({ id: game.id, title: game.title }));
  const available = Object.entries(list.availableByGame);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Bots</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Créez des cerveaux, réglez leur raisonnement et leur stratégie, et
          rattachez-les à un compte réel pour qu&apos;ils jouent à sa place.
        </p>
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Réserve disponible :</span>
          {available.map(([gameId, count]) => (
            <Badge key={gameId} variant="outline">
              {games.find((g) => g.id === gameId)?.title ?? gameId} · {count}
            </Badge>
          ))}
        </div>
      )}

      <form method="GET" className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Libellé, tag, e-mail…"
          className="w-full sm:w-64"
        />
        <Select name="game" defaultValue={game}>
          <SelectTrigger className="w-40" aria-label="Filtrer par jeu">
            <SelectValue placeholder="Tous les jeux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les jeux</SelectItem>
            {GAME_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {games.find((g) => g.id === id)?.title ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="mode" defaultValue={mode}>
          <SelectTrigger className="w-48" aria-label="Filtrer par mode">
            <SelectValue placeholder="Tous les modes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            {BOT_MODES.map((value) => (
              <SelectItem key={value} value={value}>
                {MODE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="status" defaultValue={status}>
          <SelectTrigger className="w-40" aria-label="Filtrer par statut">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {BOT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" variant="outline">
          Filtrer
        </Button>
        {hasFilters && (
          <Button render={<Link href="/admin/bots" />} size="sm" variant="ghost">
            Réinitialiser
          </Button>
        )}
      </form>

      <BotsAdmin rows={list.rows} games={games} />

      {list.totalPages > 1 && (
        <Pagination>
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
  );
}
