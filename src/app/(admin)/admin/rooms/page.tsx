import type { Metadata } from "next";
import { RadioIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
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
import { formatRelativeTime } from "@/lib/admin/format";
import { listActiveRealtimeRooms } from "@/lib/admin/realtime-rooms";
import { requireAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Rooms Colyseus — Administration",
};

const phaseStyles: Record<string, string> = {
  waiting: "bg-muted! text-muted-foreground! hover:bg-muted! border-0 shadow-none",
  ready: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none",
  playing: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none",
  finished: "bg-orange-400/10! text-orange-400! hover:bg-orange-400/10! border-0 shadow-none",
  closed: "bg-destructive/10! text-destructive! hover:bg-destructive/10! border-0 shadow-none",
};

const phaseLabels: Record<string, string> = {
  waiting: "en attente",
  ready: "prête",
  playing: "en jeu",
  finished: "terminée",
  closed: "fermée",
};

/**
 * Phase 7 — LIVE room state read from the realtime server
 * (server-to-server, shared secret). There is no rooms table: the
 * state exists only inside Colyseus, so this page shows what is
 * running NOW — never fabricated rooms. Three honest states: active
 * rooms, none, or the realtime server itself is unavailable (told
 * explicitly instead of a misleading empty list).
 */
export default async function AdminRoomsPage() {
  await requireAdminSession();

  const result = await listActiveRealtimeRooms();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">Rooms Colyseus</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          État live du serveur temps réel (metadata matchmaker) — une room
          fermée disparaît immédiatement de cette liste.
        </p>
      </div>

      {result.ok === false ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <RadioIcon className="size-4" />
              Serveur temps réel indisponible
            </CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Démarre le serveur (compose : service{" "}
              <code className="text-xs">server-games</code>) puis recharge —
              cette page interroge <code className="text-xs">/api/admin/rooms</code>{" "}
              à chaque affichage, sans cache.
            </p>
          </CardContent>
        </Card>
      ) : result.rooms.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RadioIcon />
            </EmptyMedia>
            <EmptyTitle>Aucune room active</EmptyTitle>
            <EmptyDescription>
              Le serveur temps réel répond mais aucune partie n&apos;est en
              cours — les rooms apparaissent ici dès leur création.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Jeu</TableHead>
                <TableHead className="text-right">Joueurs</TableHead>
                <TableHead className="text-right">Spectateurs</TableHead>
                <TableHead>État</TableHead>
                <TableHead>Créée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rooms.map((room) => (
                <TableRow key={room.roomId}>
                  <TableCell>
                    <code className="text-xs">{room.roomId}</code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {room.gameName || room.gameId}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {room.players} / {room.maxPlayers || "?"}
                    {room.targetPlayers > 0 &&
                      room.players < room.targetPlayers && (
                        <span className="ml-1 text-xs text-orange-400">
                          · recrute {room.targetPlayers - room.players}
                        </span>
                      )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {room.spectators}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${phaseStyles[room.phase] ?? phaseStyles.waiting} border-0 shadow-none`}
                    >
                      {phaseLabels[room.phase] ?? room.phase}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {room.createdAt
                      ? formatRelativeTime(new Date(room.createdAt))
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
