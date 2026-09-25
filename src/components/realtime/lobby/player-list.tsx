"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, UserCircleIcon } from "@hugeicons/core-free-icons";

import type { LobbyViewProps } from "./lobby-types";

/**
 * Generic player list: shows seated players plus empty slots up to
 * targetPlayers. Game-agnostic — no Ludo knowledge here.
 */
export function PlayerList({ snapshot, viewerUserId }: LobbyViewProps) {
  const players = [...snapshot.players].sort((a, b) => a.seat - b.seat);
  const missing = Math.max(
    0,
    snapshot.targetPlayers - players.length,
  );

  return (
    <ul className="flex flex-col gap-2" aria-label="Joueurs dans la room">
      {players.map((player) => {
        const isHost = player.userId === snapshot.hostUserId;
        const isViewer = player.userId === viewerUserId;
        return (
          <li
            key={player.userId}
            className="flex items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2"
          >
            <HugeiconsIcon
              icon={UserCircleIcon}
              className="size-6 shrink-0 text-neutral-300"
            />
            <span className="flex-1 truncate text-sm font-medium text-neutral-100">
              {player.name}
              {isViewer && (
                <span className="ml-2 text-xs text-neutral-400">(toi)</span>
              )}
            </span>
            {isHost && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                <HugeiconsIcon icon={CrownIcon} className="size-3.5" />
                Hôte
              </span>
            )}
            {!player.connected && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                déconnecté
              </span>
            )}
          </li>
        );
      })}

      {Array.from({ length: missing }).map((_, index) => (
        <li
          key={`waiting-${index}`}
          className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-700 px-3 py-2 text-neutral-500"
        >
          <HugeiconsIcon
            icon={UserCircleIcon}
            className="size-6 shrink-0 opacity-50"
          />
          <span className="text-sm">En attente…</span>
        </li>
      ))}
    </ul>
  );
}
