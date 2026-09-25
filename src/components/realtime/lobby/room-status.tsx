"use client";

import type { LobbyViewProps, RoomPhase } from "./lobby-types";

const PHASE_LABELS: Record<RoomPhase, string> = {
  waiting: "En attente de joueurs",
  ready: "Prête à démarrer",
  playing: "Partie en cours",
  finished: "Partie terminée",
};

const PHASE_STYLES: Record<RoomPhase, string> = {
  waiting: "bg-neutral-700/40 text-neutral-300",
  ready: "bg-emerald-500/15 text-emerald-400",
  playing: "bg-sky-500/15 text-sky-400",
  finished: "bg-violet-500/15 text-violet-400",
};

/**
 * Generic room status header: phase badge + occupancy counter.
 * Works for any game; the start button appears when the viewer is
 * the host and the lifecycle says the room is startable.
 */
export function RoomStatus({
  snapshot,
  viewerUserId,
  onStart,
  starting,
}: LobbyViewProps) {
  const canStart =
    snapshot.phase === "ready" && viewerUserId === snapshot.hostUserId;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${PHASE_STYLES[snapshot.phase]}`}
        >
          {PHASE_LABELS[snapshot.phase]}
        </span>
        <span className="text-sm text-neutral-400">
          {snapshot.players.length} / {snapshot.targetPlayers} joueurs
        </span>
      </div>

      {canStart && (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {starting ? "Démarrage…" : "Lancer la partie"}
        </button>
      )}
    </div>
  );
}
