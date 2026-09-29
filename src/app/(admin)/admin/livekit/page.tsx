import type { Metadata } from "next";
import Link from "next/link";
import { VideoIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getLiveKitOperationalStatus } from "@/lib/admin/livekit-status";
import { requireAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "LiveKit — Administration",
};

/**
 * Phase 8 — LIVE media-server state via the official RoomService API
 * (already-installed livekit-server-sdk; no new dependency, no invented
 * protocol). Colyseus decides who plays; LiveKit only carries audio/
 * video between admitted participants, so this page shows voice
 * traffic, not game state. Three honest states: active voice rooms,
 * none, or the media server itself is unavailable.
 */
export default async function AdminLiveKitPage() {
  await requireAdminSession();

  const status = await getLiveKitOperationalStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">LiveKit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          État opérationnel du serveur média : canaux voix des matchs en
          cours. Colyseus décide qui joue ; LiveKit transporte l&apos;audio
          entre participants admis.
        </p>
      </div>

      {status.ok === false ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <VideoIcon className="size-4" />
              Serveur média indisponible
            </CardTitle>
            <CardDescription>{status.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Démarrage : <code className="text-xs">docker compose up -d livekit</code>{" "}
              (service du compose racine). Cette page interroge l&apos;API de
              service officielle du serveur à chaque affichage, sans cache.
            </p>
          </CardContent>
        </Card>
      ) : status.rooms.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <VideoIcon />
            </EmptyMedia>
            <EmptyTitle>Aucun canal voix actif</EmptyTitle>
            <EmptyDescription>
              Le serveur média répond mais aucune partie n&apos;utilise la
              voix — les canaux apparaissent ici dès qu&apos;un match les
              ouvre.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {status.rooms.length} canal
            {status.rooms.length > 1 ? "aux" : ""} voix actif
            {status.rooms.length > 1 ? "s" : ""} —{" "}
            {status.rooms.reduce((sum, room) => sum + room.numParticipants, 0)}{" "}
            participant
            {status.rooms.reduce((sum, room) => sum + room.numParticipants, 0) > 1
              ? "s"
              : ""}{" "}
            connecté
            {status.rooms.reduce((sum, room) => sum + room.numParticipants, 0) > 1
              ? "s"
              : ""}.
          </p>

          {status.rooms.map((room) => (
            <Card key={room.name}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{room.name}</CardTitle>
                    <CardDescription>
                      {room.numParticipants} participant
                      {room.numParticipants > 1 ? "s" : ""}
                      {room.createdAt
                        ? ` · ouvert ${formatRelativeTime(new Date(room.createdAt * 1000))}`
                        : ""}
                      {room.gameRoomId && (
                        <>
                          {" · match "}
                          <code className="text-xs">{room.gameRoomId}</code>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  {room.gameRoomId && (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href="/admin/rooms" />}
                    >
                      Rooms Colyseus
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Identité</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {room.participants.map((participant) => (
                        <TableRow key={participant.identity}>
                          <TableCell className="text-sm font-medium">
                            {participant.name || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-muted-foreground">
                                {participant.identity}
                              </code>
                              {participant.userId && (
                                <Badge variant="outline" className="text-xs">
                                  plateforme
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                participant.isGuest
                                  ? "bg-muted! text-muted-foreground! hover:bg-muted! border-0 shadow-none"
                                  : "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10! border-0 shadow-none"
                              }
                            >
                              {participant.isGuest ? "invité" : "joueur"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
