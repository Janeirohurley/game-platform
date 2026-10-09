"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Settings01Icon } from "@hugeicons/core-free-icons";

import type { LobbySnapshot } from "@/lib/realtime/types";
import { LUDO_TURN_DURATION_OPTIONS } from "@/lib/realtime/types";

export interface MatchSettingsDialogProps {
  snapshot: LobbySnapshot;
  /** The host edits the settings — everyone else sees them read-only. */
  isAdmin: boolean;
  onClose: () => void;
  /** Fired whenever the host changes a value; the server state syncs back. */
  onUpdate: (settings: { targetPlayers: number; turnDurationMs: number }) => void;
}

/**
 * The lobby's host-configurable settings: table size and (Ludo) per-turn
 * budget. Values are read straight from the server snapshot, so the dialog
 * always mirrors the room's truth and reverts by itself when the server
 * rejects an update (too small a table, mid-match, …). Anyone can open it,
 * but only the host's controls are live.
 */
export function MatchSettingsDialog({
  snapshot,
  isAdmin,
  onClose,
  onUpdate,
}: MatchSettingsDialogProps) {
  const playerCounts: number[] = [];
  for (let size = snapshot.minPlayers; size <= snapshot.maxPlayers; size++) {
    playerCounts.push(size);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-white shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
            <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="settings-dialog-title" className="text-base font-semibold">
              Paramètres de la partie
            </h2>
            <p className="mt-0.5 text-sm text-white/60">
              {isAdmin
                ? "Modifiables jusqu'au lancement de la partie."
                : "Lecture seule — seule l'hôte peut les modifier."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-white/50 uppercase">
              Nombre de joueurs
            </p>
            <div className="mt-2 flex gap-2">
              {playerCounts.map((count) => {
                const active = snapshot.targetPlayers === count;
                return (
                  <button
                    key={count}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() =>
                      onUpdate({
                        targetPlayers: count,
                        turnDurationMs: snapshot.turnDurationMs,
                      })
                    }
                    aria-pressed={active}
                    className={`flex h-9 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                      active
                        ? "border-sky-400/60 bg-sky-500/20 text-sky-300"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-turn-duration"
              className="block text-[11px] font-semibold tracking-wide text-white/50 uppercase"
            >
              Temps par coup
            </label>
            <select
              id="settings-turn-duration"
              disabled={!isAdmin}
              value={snapshot.turnDurationMs}
              onChange={(event) =>
                onUpdate({
                  targetPlayers: snapshot.targetPlayers,
                  turnDurationMs: Number(event.target.value),
                })
              }
              className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-neutral-800 px-3 text-sm text-white transition focus:border-sky-400/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {LUDO_TURN_DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-white/45">
              {snapshot.turnDurationMs === 0
                ? "Aucune limite : un joueur peut prendre tout son temps."
                : "Le tour est automatiquement passé quand le temps s'écoule."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}