"use client";

import { ArrowDownUp } from "lucide-react";
import { CardHeader, CardContent, Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import SimpleBar from "simplebar-react";
import 'simplebar-react/dist/simplebar.min.css';

import { formatDuration, formatRelativeTime } from "@/lib/admin/format";
import type { AdminRecentMatch } from "@/lib/admin/queries";

const outcomeConfig: Record<
  AdminRecentMatch["outcome"],
  { bg: string; text: string; label: string }
> = {
  win: { bg: "bg-chart-2/10!", text: "text-chart-2!", label: "victoire" },
  loss: { bg: "bg-destructive/10!", text: "text-destructive!", label: "défaite" },
  draw: { bg: "bg-orange-500/10!", text: "text-orange-500!", label: "nulle" },
};

/**
 * Registry block, content-adapted: same visual grammar (scrollable
 * table, colored status badges, sortable column headers) fed with the
 * REAL latest ingested results. One row per participant, as persisted.
 */
export default function ProjectsOrders({ matches }: { matches: AdminRecentMatch[] }) {
  return (
    <Card className="flex flex-col h-full gap-0">
      {/* Header */}
      <CardHeader className="border-b border-border flex flex-row items-center">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground">
            Matchs récents
          </CardTitle>
        </div>
      </CardHeader>

      {/* Table */}
      <CardContent className="px-0!">
        <SimpleBar>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="px-4! py-3 h-auto text-sm font-normal text-muted-foreground w-[160px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Joueur
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-muted-foreground">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Jeu
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[130px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Résultat
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[120px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Rating
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[130px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Durée
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                    <TableHead className="px-4 py-3 h-auto text-sm font-normal text-muted-foreground w-[130px]">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        Quand
                        <ArrowDownUp size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {matches.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-muted-foreground"
                      >
                        Aucun match ingéré — les résultats apparaîtront dès la
                        première partie en ligne terminée.
                      </TableCell>
                    </TableRow>
                  ) : (
                    matches.map((match) => {
                      const status = outcomeConfig[match.outcome];
                      return (
                        <TableRow
                          key={match.id}
                          className="border-border hover:bg-muted/30"
                        >
                          {/* Player */}
                          <TableCell className="px-4! py-3 w-[160px]">
                            <span className="text-sm font-medium text-foreground whitespace-nowrap">
                              {match.playerName}
                            </span>
                          </TableCell>

                          {/* Game */}
                          <TableCell className="px-4 py-3">
                            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
                              {match.gameTitle}
                            </span>
                          </TableCell>

                          {/* Outcome */}
                          <TableCell className="px-4 py-3 w-[130px]">
                            <Badge
                              className={`inline-flex items-center justify-center px-2 py-0.5 h-auto text-xs font-normal whitespace-nowrap ${status.bg} ${status.text}`}
                            >
                              {status.label}
                            </Badge>
                          </TableCell>

                          {/* Rating delta */}
                          <TableCell className="px-4 py-3 w-[120px]">
                            <span
                              className={`text-sm font-normal whitespace-nowrap tabular-nums ${
                                match.ratingDelta > 0
                                  ? "text-chart-2"
                                  : match.ratingDelta < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {match.ratingDelta > 0 ? "+" : ""}
                              {match.ratingDelta}
                            </span>
                          </TableCell>

                          {/* Duration */}
                          <TableCell className="px-4 py-3 w-[130px]">
                            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap tabular-nums">
                              {formatDuration(match.durationSeconds)}
                            </span>
                          </TableCell>

                          {/* When */}
                          <TableCell className="px-4 py-3 w-[130px]">
                            <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(match.playedAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SimpleBar>
      </CardContent>
    </Card>
  );
}
