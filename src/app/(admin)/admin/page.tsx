import type { Metadata } from "next";

import { getAdminOverview } from "@/lib/admin/queries";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Administration",
};

/**
 * Phase 1 dashboard — real numbers only. The overview counters come from
 * PostgreSQL + the registry in a single roundtrip; the games table reads
 * the registry (the technical catalogue — there is no games table yet,
 * by design; a persistent games entity is a later phase's decision).
 */
export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();

  const metrics = [
    { label: "Comptes", value: overview.totalUsers, hint: "utilisateurs inscrits" },
    { label: "Profils gamers", value: overview.totalGamers, hint: "profils créés" },
    { label: "Jeux au catalogue", value: overview.totalGames, hint: "registre plateforme" },
    { label: "Matchs joués", value: overview.totalMatches, hint: "résultats ingérés" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de la plateforme — données réelles, mises à
          jour à chaque chargement.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <Card>
        <CardHeader>
          <CardTitle>Catalogue des jeux</CardTitle>
          <CardDescription>
            Registre technique de la plateforme — source de vérité des
            routes, capacités temps réel et ids de statistiques.
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

      <p className="text-xs text-muted-foreground">
        Utilisateurs, gamers, matchs en direct et modération : à venir dans
        les prochaines phases — la navigation latérale l&apos;annonce.
      </p>
    </div>
  );
}
