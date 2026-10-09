"use client";

import { useEffect, useState } from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  CrownIcon,
  Doctor02Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTurnCountdown } from "@/lib/realtime/use-turn-countdown";
import type { LobbySnapshot, RoomPhase } from "@/lib/realtime/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CountdownRing } from "./countdown-ring";

export interface MatchHudProps {
  snapshot: LobbySnapshot;
  isAdmin: boolean;
}

const PHASE_LABEL: Record<RoomPhase, string> = {
  waiting: "En attente",
  ready: "Prêt",
  playing: "En cours",
  finished: "Terminée",
  closed: "Fermée",
};

const PHASE_CLASS: Record<RoomPhase, string> = {
  waiting: "bg-amber-400/15 text-amber-300",
  ready: "bg-emerald-400/15 text-emerald-300",
  playing: "bg-sky-400/15 text-sky-300",
  finished: "bg-violet-400/15 text-violet-300",
  closed: "bg-red-400/15 text-red-300",
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function TurnRing({ durationMs }: { durationMs: number }) {
  return <CountdownRing progress={useTurnCountdown(durationMs)} />;
}

/**
 * Live elapsed-match clock (mm:ss), anchored on the server's `startedAt`
 * so it stays correct even for spectators who join mid-match. Purely
 * cosmetic — the server owns the real timekeeping.
 */
function MatchElapsed({
  startedAt,
  className = "bg-white/10 text-white/70",
}: {
  startedAt: number;
  className?: string;
}) {
  // Primed at mount so the clock is right on the very first paint (a
  // mid-match spectator sees the match's real age, not a 00:00 flash).
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (startedAt <= 0) return;
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, [startedAt]);

  if (startedAt <= 0) return null;

  const totalSeconds = Math.floor(
    Math.max(0, now - startedAt) / 1_000,
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide ${className}`}
      title="Temps écoulé"
    >
      <HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={1.8} />
      <span className="tabular-nums">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
    </span>
  );
}

function PlayerAvatar({
  player,
  isActiveTurn,
  ringResetKey,
  ringDurationMs,
}: {
  player: LobbySnapshot["players"][number];
  isActiveTurn: boolean;
  ringResetKey: string;
  ringDurationMs: number;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Tooltip>
        <TooltipTrigger>
          <span className="relative block size-9 cursor-pointer">
            {isActiveTurn && (
              <TurnRing key={ringResetKey} durationMs={ringDurationMs} />
            )}

            <Avatar
              className={`size-9 ${
                player.connected ? "" : "opacity-50 saturate-50"
              }`}
            >
              {player.avatarUrl ? (
                <AvatarImage src={player.avatarUrl} alt={player.name} />
              ) : null}

              <AvatarFallback className="bg-white/10 text-[10px] text-white">
                {initialsOf(player.name)}
              </AvatarFallback>
            </Avatar>

            <span
              aria-hidden="true"
              className={`absolute right-0 bottom-0 z-10 size-2.5 rounded-full ring-2 ring-black/80 ${
                player.connected ? "bg-emerald-400" : "bg-white/30"
              }`}
            />
          </span>
        </TooltipTrigger>

        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="border-white/10 bg-black/85 px-2.5 py-1 text-[10px] text-white backdrop-blur-md"
        >
          {player.name}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function MatchHud({
  snapshot,
  isAdmin,
}: MatchHudProps) {
  const phase = snapshot.phase;

  const playerCount = snapshot.players.length;

  const freeSeats = Math.max(
    0,
    snapshot.targetPlayers - playerCount,
  );

  const activeTurnUserId =
    phase === "playing" &&
    snapshot.turnDurationMs > 0 &&
    snapshot.turnDeadline > 0
      ? snapshot.currentTurn
      : null;

  return (
    <div className="pointer-events-auto absolute top-3 left-3 z-40 max-w-[calc(100vw-1.5rem)] sm:top-4 sm:left-4">
      <div className="flex h-10 items-center gap-3 overflow-x-auto overflow-y-visible rounded-md bg-black/45 px-2.5 text-white backdrop-blur-sm scrollbar-none">
        {/* Game */}
        <span className="shrink-0 text-xs font-semibold">
          {snapshot.gameName}
        </span>

        {/* Phase — the elapsed clock takes this slot while the match
            runs: "En cours" is redundant next to a live timer. */}
        {phase === "playing" ? (
          <MatchElapsed
            startedAt={snapshot.startedAt}
            className="bg-sky-400/15 text-sky-300"
          />
        ) : (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
              PHASE_CLASS[phase]
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
        )}

        {/* A finished match keeps the label and adds its final time. */}
        {phase === "finished" && <MatchElapsed startedAt={snapshot.startedAt} />}

        <span className="h-4 w-px shrink-0 bg-white/15" />

        {/* Players */}
        <ul
          className="flex shrink-0 items-center gap-2"
          role="list"
        >
          {snapshot.players.map((player) => {
            const isHost =
              player.userId === snapshot.hostUserId;

            return (
              <li
                key={player.userId}
                className="relative flex shrink-0 items-center"
              >
                {isHost && (
                  <HugeiconsIcon
                    icon={CrownIcon}
                    size={15}
                    strokeWidth={2}
                    aria-label="Hôte"
                    className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 text-amber-200"
                  />
                )}

                <PlayerAvatar
                  player={player}
                  isActiveTurn={
                    player.userId === activeTurnUserId
                  }
                  ringResetKey={String(
                    snapshot.turnDeadline,
                  )}
                  ringDurationMs={
                    snapshot.turnDurationMs
                  }
                />
              </li>
            );
          })}

          {/* Free seats */}
          {Array.from(
            { length: freeSeats },
            (_, index) => (
              <li
                key={`free-${index}`}
                className="flex shrink-0 items-center"
                aria-label="Place libre"
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-white/25 text-sm text-white/30">
                  +
                </span>
              </li>
            ),
          )}
        </ul>

        {/* Spectators */}
        {snapshot.spectators.length > 0 && (
          <>
            <span className="h-4 w-px shrink-0 bg-white/15" />

            <span
              className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/55"
              aria-label={`${snapshot.spectators.length} spectateur${
                snapshot.spectators.length > 1
                  ? "s"
                  : ""
              }`}
            >
              <HugeiconsIcon
                icon={EyeIcon}
                size={14}
                strokeWidth={1.8}
              />

              {snapshot.spectators.length}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
