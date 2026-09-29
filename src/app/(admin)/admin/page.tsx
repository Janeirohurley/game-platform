import type { Metadata } from "next";

import {
  formatDuration,
  formatRelativeTime,
} from "@/lib/admin/format";
import {
  getAdminOverview,
  getRecentMatches,
  getWeeklyMatchActivity,
  getWeeklyStats,
} from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";
import { WeeklyMatchActivityChart } from "@/lib/admin/activity-chart";
import { GAMES } from "@/lib/games/registry";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SwordsIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Administration",
};

const outcomeBadge: Record<
  "win" | "loss" | "draw",
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  win: { label: "victoire", variant: "default" },
  loss: { label: "défaite", variant: "outline" },
  draw: { label: "nulle", variant: "secondary" },
};

/**
 * Phase 2 dashboard — everything on this page is a real query: overview
 * counters (PostgreSQL + registry), 7-day activity per day, new accounts
 * and distinct active gamers this week, and the latest ingested match
 * results joined to user identity. No fake rows, no placeholders.
 */
export default async function AdminDashboardPage() {
  // Guard FIRST: a redirect emitted here carries no payload, so the
  // metrics below can never leak into an unauthorized response.
  await requireAdminSession();

  const [overview, activity, weekly, recent] = await Promise.all([
    getAdminOverview(),
    getWeeklyMatchActivity(),
    getWeeklyStats(),
    getRecentMatches(10),
  ]);

  const metrics = [
    { label: "Comptes", value: overview.totalUsers, hint: "inscrits" },
    { label: "Profils gamers", value: overview.totalGamers, hint: "créés" },
    { label: "Matchs joués", value: overview.totalMatches, hint: "ingérés" },
    { label: "Nouveaux comptes (7 j)", value: weekly.newAccounts, hint: "cette semaine" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de la plateforme — {weekly.activeGamers} joueur
          {weekly.activeGamers > 1 ? "s" : ""} actif
          {weekly.activeGamers > 1 ? "s" : ""} sur les 7 derniers jours.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} size="sm">
            <CardHeader>
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {metric.value.toLocaleString("fr-FR")}
              </CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {metric.hint}
                </span>
              </CardAction>
            </CardHeader>
          </Card>
        ))}
      </div>

      <WeeklyMatchActivityChart data={activity} />

      <Card>
        <CardHeader>
          <CardTitle>Matchs récents</CardTitle>
          <CardDescription>
            Les 10 derniers résultats ingérés — une ligne par participant
            (source : game_matches).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SwordsIcon />
                </EmptyMedia>
                <EmptyTitle>Aucun match ingéré</EmptyTitle>
                <EmptyDescription>
                  Les résultats apparaîtront ici dès la première partie en
                  ligne terminée.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">XP</TableHead>
                  <TableHead className="text-right">Durée</TableHead>
                  <TableHead className="text-right">Quand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((match) => {
                  const badge = outcomeBadge[match.outcome];
                  return (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">
                        {match.playerName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {match.gameTitle}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {match.ratingDelta >= 0 ? "+" : ""}
                        {match.ratingDelta}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        +{match.xpEarned}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatDuration(match.durationSeconds)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatRelativeTime(match.playedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalogue des jeux</CardTitle>
          <CardDescription>
            Registre technique — source de vérité des ids de statistiques et
            des salons temps réel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jeu</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead className="text-center">Joueurs</TableHead>
                <TableHead className="text-center">En ligne</TableHead>
                <TableHead className="text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GAMES.map((game) => (
                <TableRow key={game.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-md bg-muted text-[0.65rem] font-semibold text-muted-foreground">
                        {game.icon ?? game.slug.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="leading-tight">
                        <div className="font-medium">{game.title}</div>
                        <div className="text-xs text-muted-foreground">
                          /games/{game.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {game.category}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-muted-foreground">
                    {game.minPlayers}–{game.maxPlayers}
                  </TableCell>
                  <TableCell className="text-center">
                    {game.playableOnline ? (
                      <Badge variant="secondary">salons temps réel</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {game.status === "live" ? (
                      <Badge>live</Badge>
                    ) : (
                      <Badge variant="outline">bientôt</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
