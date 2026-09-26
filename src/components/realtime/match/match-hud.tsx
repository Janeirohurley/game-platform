"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  UserGroupIcon,
  Clock01Icon,
  CrownIcon,
} from "@hugeicons/core-free-icons";

import type { LobbySnapshot, RoomPhase } from "@/lib/realtime/types";

export interface MatchHudProps {
  snapshot: LobbySnapshot;
  /** Is the local viewer the room admin (shows the start control)? */
  isAdmin: boolean;
  onStart: () => void;
  /** True while the start request is in flight (button feedback). */
  starting?: boolean;
}

const PHASE_LABEL: Record<RoomPhase, string> = {
  waiting: "En attente de joueurs",
  ready: "Prêt à démarrer",
  playing: "Partie en cours",
  finished: "Partie terminée",
  closed: "Room fermée",
};

const PHASE_CLASS: Record<RoomPhase, string> = {
  waiting: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  playing: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  finished: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  closed: "bg-red-500/15 text-red-700 dark:text-red-300",
};

/**
 * Compact roster (spec section 9): one dot per player, lit when
 * connected, dim while disconnected — the seat is kept through a drop,
 * the visual says so. Free seats show as hollow dots.
 */
function PlayerRoster({
  players,
  capacity,
}: {
  players: LobbySnapshot["players"];
  capacity: number;
}) {
  if (players.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {players.map((player) => (
        <li
          key={player.userId}
          className="flex items-center gap-1.5 text-[11px] text-white/80"
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              player.connected ? "bg-emerald-400" : "bg-white/25"
            }`}
            aria-label={
              player.connected ? "Connecté" : "Temporairement déconnecté"
            }
          />
          <span className="truncate">{player.name}</span>
          {player.connected === false && (
            <span className="shrink-0 text-[9px] uppercase tracking-wide text-white/35">
              déconnecté
            </span>
          )}
        </li>
      ))}
      {Array.from(
        { length: Math.max(0, capacity - players.length) },
        (_, index) => (
          <li
            key={`free-${index}`}
            className="flex items-center gap-1.5 text-[11px] text-white/30"
          >
            <span className="size-1.5 shrink-0 rounded-full border border-white/30" />
            place libre
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * Top-left overlay of the integrated match screen (spec section 14):
 * match identity, players/capacity, spectator count, lifecycle phase —
 * plus the start control, which only the admin ever sees.
 */
export function MatchHud({
  snapshot,
  isAdmin,
  onStart,
  starting = false,
}: MatchHudProps) {
  const playerCount = snapshot.players.length;
  const phase = snapshot.phase;

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-40 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-black/55 px-3 py-2.5 text-white shadow-lg backdrop-blur-md sm:left-4 sm:top-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{snapshot.gameName}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PHASE_CLASS[phase]}`}
        >
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <dl className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70">
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={UserGroupIcon} size={13} strokeWidth={1.8} />
          <dt className="sr-only">Joueurs</dt>
          <dd className="tabular-nums">
            {playerCount} / {snapshot.targetPlayers} joueurs
          </dd>
        </div>
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={EyeIcon} size={13} strokeWidth={1.8} />
          <dt className="sr-only">Spectateurs</dt>
          <dd className="tabular-nums">{snapshot.spectators.length}</dd>
        </div>
      </dl>

      <PlayerRoster
        players={snapshot.players}
        capacity={snapshot.targetPlayers}
      />

      {isAdmin && phase !== "closed" && (
        <button
          type="button"
          onClick={onStart}
          disabled={starting || phase === "playing" || phase === "finished"}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "finished" ? (
            "Partie terminée"
          ) : (
            <>
              Lancer la partie
              {playerCount < snapshot.targetPlayers && (
                <span className="flex items-center gap-1 font-normal text-white/70">
                  <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
                  {snapshot.targetPlayers - playerCount} manquant
                  {snapshot.targetPlayers - playerCount > 1 ? "s" : ""}
                </span>
              )}
            </>
          )}
        </button>
      )}

      {!isAdmin && playerCount > 0 && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-white/45">
          <HugeiconsIcon icon={CrownIcon} size={11} strokeWidth={1.8} />
          {snapshot.players.find((p) => p.userId === snapshot.hostUserId)
            ?.name ?? "L'hôte"}{" "}
          dirige la partie
        </p>
      )}
    </div>
  );
}
