"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, UserGroupIcon } from "@hugeicons/core-free-icons";

import type { RoomListing } from "@/lib/realtime/types";

export interface MatchListProps {
  rooms: RoomListing[];
  loading: boolean;
  error: string | null;
  onJoinAsPlayer: (roomId: string) => void;
  onWatch: (roomId: string) => void;
}

const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  waiting: {
    label: "En attente",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  },
  ready: {
    label: "Prête",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  },
  playing: {
    label: "En cours",
    className:
      "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300",
  },
  finished: {
    label: "Terminée",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  },
};

/** Waiting tables first, then running ones, then finished matches. */
const PHASE_ORDER: Record<string, number> = {
  waiting: 0,
  ready: 0,
  playing: 1,
  finished: 2,
};

/**
 * The room's own id, shortened — a REAL identifier from the matchmaker,
 * never an invented name. The metadata carries counts, not player names.
 */
function tableLabel(roomId: string): string {
  return `Table #${roomId.slice(0, 6).toUpperCase()}`;
}

/**
 * Seat occupancy, the "● ● ○ ○" of the spec. Filled seats glow green;
 * free ones stay dim. Hidden when the metadata is unusable — no fake
 * capacity is ever rendered.
 */
function SeatDots({ filled, capacity }: { filled: number; capacity: number }) {
  if (capacity <= 0 || capacity > 12) return null;

  return (
    <div
      className="mt-2.5 flex items-center gap-1"
      aria-label={`${filled} place${filled > 1 ? "s" : ""} occupée${filled > 1 ? "s" : ""} sur ${capacity}`}
    >
      {Array.from({ length: capacity }, (_, index) => (
        <span
          key={index}
          className={`h-2 w-2 rounded-full ${
            index < filled
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-slate-300 dark:bg-white/15"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * The discoverable matches of one game — the MAIN section of the play
 * page (spec section 2). Everything shown comes from the matchmaker's
 * live metadata: phase, players, capacity, spectators. A full table
 * keeps "Regarder"; "Demander à jouer" only appears while seats exist.
 */
export function MatchList({
  rooms,
  loading,
  error,
  onJoinAsPlayer,
  onWatch,
}: MatchListProps) {
  if (error) {
    return (
      <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/[0.06] dark:text-amber-300">
        {error}
      </p>
    );
  }

  if (loading && rooms.length === 0) {
    return (
      <div className="flex flex-col gap-2" role="status">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-[5.25rem] animate-pulse rounded-xl border border-slate-200/80 bg-slate-100 dark:border-white/[0.05] dark:bg-white/[0.02]"
          />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-100/50 px-6 py-10 text-center dark:border-white/[0.1] dark:bg-white/[0.015]">
        <p className="text-sm font-medium text-slate-700 dark:text-white/70">
          Aucune partie pour l&apos;instant
        </p>
        <p className="mt-1.5 text-xs leading-5 text-slate-400 dark:text-white/35">
          Crée la première table — elle apparaît ici en direct et les autres
          joueurs pourront te rejoindre.
        </p>
      </div>
    );
  }

  const sorted = [...rooms].sort(
    (a, b) =>
      (PHASE_ORDER[a.metadata?.phase ?? "waiting"] ?? 3) -
        (PHASE_ORDER[b.metadata?.phase ?? "waiting"] ?? 3) ||
      a.roomId.localeCompare(b.roomId),
  );

  return (
    <ul aria-label="Matchs disponibles" className="flex flex-col gap-2.5">
      {sorted.map((room) => (
        <li key={room.roomId}>
          <MatchRow
            room={room}
            onJoinAsPlayer={onJoinAsPlayer}
            onWatch={onWatch}
          />
        </li>
      ))}
    </ul>
  );
}

function MatchRow({
  room,
  onJoinAsPlayer,
  onWatch,
}: {
  room: RoomListing;
  onJoinAsPlayer: (roomId: string) => void;
  onWatch: (roomId: string) => void;
}) {
  const meta = room.metadata;
  const players = meta?.players ?? 0;
  const capacity = meta?.targetPlayers ?? meta?.maxPlayers ?? 0;
  const spectators = meta?.spectators ?? 0;
  const phase = meta?.phase ?? "waiting";
  const badge = PHASE_BADGE[phase] ?? {
    label: phase,
    className: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-white/60",
  };
  const full = capacity > 0 && players >= capacity;
  const joinable =
    (phase === "waiting" || phase === "ready") && !full;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3.5 shadow-sm shadow-slate-200/50 transition-colors hover:border-slate-300 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.025] dark:shadow-none dark:hover:border-white/[0.14] dark:hover:bg-white/[0.045]">
      <div className="min-w-[13rem] flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-sm font-semibold text-slate-950 dark:text-white">
            {tableLabel(room.roomId)}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-white/40">
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={UserGroupIcon} size={13} strokeWidth={1.8} />
            <span className="tabular-nums">
              {players} / {capacity || "?"} joueurs
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={EyeIcon} size={13} strokeWidth={1.8} />
            <span className="tabular-nums">
              {spectators} spectateur{spectators > 1 ? "s" : ""}
            </span>
          </span>
        </p>

        <SeatDots filled={players} capacity={capacity} />
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onWatch(room.roomId)}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white/80 px-3.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 sm:flex-none dark:border-white/10 dark:bg-white/[0.045] dark:text-white/80 dark:hover:bg-white/[0.09] dark:hover:text-white"
        >
          <HugeiconsIcon icon={EyeIcon} size={13} strokeWidth={1.8} />
          Regarder
        </button>

        {joinable ? (
          <button
            type="button"
            onClick={() => onJoinAsPlayer(room.roomId)}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex-none dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            Demander à jouer
          </button>
        ) : (
          full && (
            <span
              aria-disabled="true"
              className="inline-flex h-9 flex-1 cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-100 px-3.5 text-xs font-medium text-slate-400 sm:flex-none dark:border-white/[0.07] dark:bg-white/[0.02] dark:text-white/30"
            >
              Complet
            </span>
          )
        )}
      </div>
    </div>
  );
}
