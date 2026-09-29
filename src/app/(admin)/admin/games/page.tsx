import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPlaytime, formatRelativeTime } from "@/lib/admin/format";
import { getGamesOverview } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Jeux — Administration",
};

/**
 * Phase 5 — the games collection as a TABLE (the admin console treats
 * tables as first-class for any comparable entity). Rows = registry
 * entries (the catalogue has no games table by design) merged with
 * REAL aggregates from game_stats / game_matches; games nobody played
 * show honest zeros instead of disappearing. Pure server component.
 */
export default async function AdminGamesPage() {
  await requireAdminSession();

  const games = await getGamesOverview();
  const totalMatches = games.reduce((sum, game) => sum + game.matches, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Jeux</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {games.length} jeux du registre — {totalMatches.toLocaleString("fr-FR")} match
          {totalMatches > 1 ? "s" : ""} ingérés toutes plateformes confondues.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead>Jeu</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Joueurs</TableHead>
              <TableHead className="text-right">Matchs</TableHead>
              <TableHead className="text-right">Bilan</TableHead>
              <TableHead className="text-right">Rating moyen</TableHead>
              <TableHead>Temps cumulé</TableHead>
              <TableHead>Dernier match</TableHead>
              <TableHead>En ligne</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {games.map((game) => {
              const decided = game.wins + game.losses + game.draws;
              return (
                <TableRow key={game.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} font-heading text-[10px] font-bold text-white`}
                      >
                        {game.icon}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{game.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.category} · {game.minPlayers}–{game.maxPlayers} joueurs
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{game.slug}</code>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        game.status === "live"
                          ? "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none"
                          : "bg-muted! text-muted-foreground! hover:bg-muted! border-0 shadow-none"
                      }
                    >
                      {game.status === "live" ? "en ligne" : "bientôt"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{game.players}</TableCell>
                  <TableCell className="text-right tabular-nums">{game.matches}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {decided > 0 ? (
                      <>
                        <span className="text-chart-2">{game.wins}V</span>
                        {" · "}
                        <span className="text-destructive">{game.losses}D</span>
                        {game.draws > 0 && (
                          <span className="text-muted-foreground"> · {game.draws}N</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {game.avgRating === null
                      ? "—"
                      : Math.round(game.avgRating).toLocaleString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatPlaytime(game.totalPlaySeconds)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {game.lastPlayedAt ? formatRelativeTime(game.lastPlayedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {game.playableOnline ? "oui" : "non"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={<Link href={`/games/${game.slug}`} aria-label={`Fiche publique de ${game.title}`} />}
                    >
                      <ExternalLinkIcon />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
