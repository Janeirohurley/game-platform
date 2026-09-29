import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Gamepad2Icon, TrophyIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDuration, formatPlaytime, formatRelativeTime } from "@/lib/admin/format";
import { AlertTriangleIcon } from "lucide-react";
import { getGamerDetail } from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Détail gamer — Administration",
};

const outcomeStyles: Record<string, string> = {
  win: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10!",
  loss: "bg-destructive/10! text-destructive! hover:bg-destructive/10!",
  draw: "bg-muted! text-muted-foreground! hover:bg-muted!",
};

const outcomeLabels: Record<string, string> = {
  win: "victoire",
  loss: "défaite",
  draw: "nulle",
};

/**
 * Phase 4 drill-down — the gamer's full picture from REAL server-owned
 * tables only (profiles, game_stats, game_matches). No moderation
 * action yet: this page reads, it does not touch.
 */
export default async function AdminGamerDetailPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await requireAdminSession();

  const { username } = await params;
  const detail = await getGamerDetail(username);
  if (!detail) notFound();

  const { gamer, winRate, perGame, recentMatches } = detail;
  const nextLevelXp = gamer.level * 100; // XP_PER_LEVEL, lib/db/schema/profiles
  const xpIntoLevel = gamer.xp - (gamer.level - 1) * 100;
  const drawText = gamer.draws > 0 ? ` · ${gamer.draws} nulle${gamer.draws > 1 ? "s" : ""}` : "";

  // Ban state lives on the auth account; the badge below links to the
  // audit entries FOR THIS TARGET — full traceability round-trip.
  const banActive =
    gamer.banned === true &&
    // null/undefined = permanent; otherwise the ban must still be live.
    (gamer.banExpires == null || gamer.banExpires > new Date());
  const auditHref = `/admin/audit?target=${encodeURIComponent(gamer.userId)}`;

  return (
    <div className="space-y-6">
      {banActive && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span className="font-medium">Compte banni</span>
          <span>
            {gamer.banExpires
              ? `jusqu'au ${new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(gamer.banExpires)} (${formatRelativeTime(gamer.banExpires)})`
              : "bannissement permanent"}
          </span>
          {gamer.banReason && (
            <span className="text-destructive/80">· motif : « {gamer.banReason} »</span>
          )}
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            render={<Link href={auditHref} />}
          >
            Voir l&apos;historique d&apos;audit
          </Button>
        </div>
      )}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/admin/gamers" />}>Gamers</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>@{gamer.username}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Identity + lifetime progression */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-4">
            <Avatar className="size-12">
              <AvatarFallback className="font-heading text-base">
                {gamer.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">@{gamer.username}</CardTitle>
              <CardDescription>
                {gamer.displayName ?? gamer.accountName} · {gamer.accountEmail}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gamer.banned === true && (
              <Badge className="bg-destructive/10! text-destructive! hover:bg-destructive/10! border-0 shadow-none">
                banni
              </Badge>
            )}
            <Badge
              className={
                gamer.isPublic
                  ? "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none"
                  : "bg-muted! text-muted-foreground! hover:bg-muted! border-0 shadow-none"
              }
            >
              {gamer.isPublic ? "public" : "privé"}
            </Badge>
            {gamer.isPublic && (
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`/profile/${gamer.username}`}
                    target="_blank"
                    aria-label={`Profil public de @${gamer.username}`}
                  />
                }
              >
                <ExternalLink />
                Profil public
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Niveau {gamer.level}</Badge>
            <Badge variant="outline">{gamer.xp.toLocaleString("fr-FR")} XP</Badge>
            <Badge variant="outline">Rating {gamer.rating}</Badge>
            {winRate !== null && <Badge variant="outline">{winRate} % de victoires</Badge>}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progression niveau {gamer.level}</span>
              <span className="tabular-nums">
                {xpIntoLevel.toLocaleString("fr-FR")} / {nextLevelXp.toLocaleString("fr-FR")} XP
              </span>
            </div>
            <Progress value={(xpIntoLevel / nextLevelXp) * 100} />
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Parties jouées</dt>
              <dd className="font-medium tabular-nums">
                {gamer.gamesPlayed.toLocaleString("fr-FR")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Bilan</dt>
              <dd className="font-medium tabular-nums">
                <span className="text-chart-2">{gamer.wins}V</span>
                {" · "}
                <span className="text-destructive">{gamer.losses}D</span>
                {drawText && <span className="text-muted-foreground">{drawText}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temps de jeu (vie)</dt>
              <dd className="font-medium">{formatPlaytime(gamer.totalPlaySeconds)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dernière partie</dt>
              <dd className="font-medium">
                {gamer.lastPlayedAt ? formatRelativeTime(gamer.lastPlayedAt) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Per-game competitive record */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gamepad2Icon className="size-4" />
            Stats par jeu
          </CardTitle>
          <CardDescription>
            Lignes de <code className="text-xs">game_stats</code> — écrites uniquement par
            l&apos;ingestion temps réel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {perGame.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Gamepad2Icon />
                </EmptyMedia>
                <EmptyTitle>Aucune partie enregistrée</EmptyTitle>
                <EmptyDescription>
                  @{gamer.username} n&apos;a pas encore terminé de match sur un jeu.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jeu</TableHead>
                    <TableHead>Parties</TableHead>
                    <TableHead>Bilan</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Série</TableHead>
                    <TableHead>Temps</TableHead>
                    <TableHead>Dernière</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perGame.map((game) => (
                    <TableRow key={game.gameId}>
                      <TableCell className="font-medium">{game.gameTitle}</TableCell>
                      <TableCell className="tabular-nums">{game.gamesPlayed}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        <span className="text-chart-2">{game.wins}V</span>
                        {" · "}
                        <span className="text-destructive">{game.losses}D</span>
                        {game.draws > 0 && (
                          <span className="text-muted-foreground"> · {game.draws}N</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{game.rating}</TableCell>
                      <TableCell className="tabular-nums text-xs text-muted-foreground">
                        actuelle {game.currentStreak} · meilleure {game.bestStreak}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatPlaytime(game.totalPlaySeconds)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {game.lastPlayedAt ? formatRelativeTime(game.lastPlayedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent matches — the game_matches audit rows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrophyIcon className="size-4" />
            Derniers matchs
          </CardTitle>
          <CardDescription>
            Les 8 derniers résultats ingérés (audit <code className="text-xs">game_matches</code>).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentMatches.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TrophyIcon />
                </EmptyMedia>
                <EmptyTitle>Aucun match</EmptyTitle>
                <EmptyDescription>
                  Le premier match terminé de @{gamer.username} apparaîtra ici.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jeu</TableHead>
                    <TableHead>Résultat</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Contre</TableHead>
                    <TableHead>Quand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMatches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">{match.gameTitle}</TableCell>
                      <TableCell>
                        <Badge
                          className={`${outcomeStyles[match.outcome]} border-0 shadow-none`}
                        >
                          {outcomeLabels[match.outcome]}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`tabular-nums ${
                          match.ratingDelta >= 0 ? "text-chart-2" : "text-destructive"
                        }`}
                      >
                        {match.ratingDelta >= 0 ? "+" : ""}
                        {match.ratingDelta}
                      </TableCell>
                      <TableCell className="tabular-nums">{match.xpEarned}</TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(match.durationSeconds)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {match.opponentTags.length > 0
                          ? match.opponentTags.map((tag) => `@${tag}`).join(", ")
                          : `— (${match.playerCount} joueur${match.playerCount > 1 ? "s" : ""})`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatRelativeTime(match.playedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
