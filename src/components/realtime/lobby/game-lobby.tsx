"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { LogoutCircle01Icon } from "@hugeicons/core-free-icons";

import { InviteBar } from "./invite-bar";
import type { LobbyViewProps } from "./lobby-types";
import { PlayerList } from "./player-list";
import { RoomStatus } from "./room-status";

/**
 * Generic waiting lobby used by every game.
 * Receives a `LobbySnapshot` (game-agnostic) and callbacks; the game
 * module only supplies configuration and handlers.
 */
export function GameLobby(props: LobbyViewProps) {
  const { snapshot, onLeave } = props;

  return (
    <section
      aria-label={`Lobby ${snapshot.gameName}`}
      className="mx-auto flex w-full max-w-md flex-col gap-4"
    >
      <header>
        <h1 className="text-2xl font-bold text-neutral-100">
          {snapshot.gameName}
        </h1>
        <p className="text-sm text-neutral-400">
          Room créée — partage le lien pour inviter des joueurs.
        </p>
      </header>

      <RoomStatus {...props} />
      <PlayerList {...props} />
      <InviteBar {...props} />

      <button
        type="button"
        onClick={onLeave}
        className="flex items-center justify-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
      >
        <HugeiconsIcon icon={LogoutCircle01Icon} className="size-4" />
        Quitter la room
      </button>
    </section>
  );
}
