"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";

import type { LobbySnapshot } from "@/lib/realtime/types";

export interface MatchStartButtonProps {
  snapshot: LobbySnapshot;
  /** Fired when the admin asks to start (sends startGame + 3 s countdown). */
  onStart: () => void;
  /** True while the 3 s start countdown is running (button feedback). */
  starting?: boolean;
}

/**
 * The admin's start control, floating alone in the top-right corner of
 * the match screen. Only ever shown while the lobby is waiting/ready —
 * once the game is running the server owns the flow and the button
 * disappears. The number of still-missing players lives in the tooltip
 * so the pill itself stays compact.
 */
export function MatchStartButton({
  snapshot,
  onStart,
  starting = false,
}: MatchStartButtonProps) {
  const phase = snapshot.phase;
  if (phase !== "waiting" && phase !== "ready") return null;

    // Tetris : on peut lancer dès `minPlayers` joueurs assis, table pleine ou non.
  const required =
    snapshot.gameId === "tetris" ? snapshot.minPlayers : snapshot.targetPlayers;
  const freeSeats = Math.max(0, required - snapshot.players.length);

  return (
    <div className="pointer-events-auto absolute top-3 right-3 z-40 sm:top-4 sm:right-4">
      <button
        type="button"
        onClick={onStart}
        disabled={starting || (snapshot.gameId === "tetris" && freeSeats > 0)}
        title={
          freeSeats > 0
            ? `Lance la partie — il manque ${freeSeats} joueur${
                freeSeats > 1 ? "s" : ""
              }`
            : "La table est prête : lance la partie"
        }
        className="flex h-10 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-600/90 px-4 text-xs font-semibold text-white shadow-lg transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {starting ? (
          <span
            aria-hidden="true"
            className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white"
          />
        ) : (
          <HugeiconsIcon icon={PlayIcon} size={14} strokeWidth={2} />
        )}
        {starting ? "Lancement…" : "Démarrer"}
      </button>
    </div>
  );
}