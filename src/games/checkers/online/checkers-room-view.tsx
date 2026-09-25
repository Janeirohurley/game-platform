"use client";

import type { Room } from "@colyseus/sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon } from "@hugeicons/core-free-icons";

import { RoomChat } from "@/components/realtime/chat";
import { CheckersBoard } from "../components/checkers-board";
import { GameStatus } from "../components/game-status";
import { useCheckersSelection } from "../use-checkers-selection";
import { useOnlineCheckers } from "./use-online-checkers";

interface CheckersRoomViewProps {
  room: Room;
  viewerUserId: string;
  onLeave: () => void;
}

/**
 * Online board.
 *
 * The server owns the game: this view renders what it synchronizes and
 * sends move intents back. Local legality checks exist only to highlight
 * squares — they are a convenience, never an authority.
 */
export function CheckersRoomView({
  room,
  viewerUserId,
  onLeave,
}: CheckersRoomViewProps) {
  const { state, viewerColor, canPlay, labels, lastMove, sendMove } =
    useOnlineCheckers(room, viewerUserId);

  const { from, pending, targets, movableFrom, rejected, select } =
    useCheckersSelection(state, canPlay, sendMove);

  return (
    <div className="flex flex-col items-center gap-4">
      <GameStatus
        board={state.board}
        turn={state.turn}
        outcome={state.outcome}
        labels={labels}
        viewerColor={viewerColor ?? undefined}
        invalidHint={rejected !== null}
      />

      <CheckersBoard
        board={state.board}
        orientation={viewerColor ?? "white"}
        from={from}
        pending={pending}
        targets={targets}
        movableFrom={movableFrom}
        rejected={rejected}
        lastMove={lastMove}
        disabled={!canPlay}
        onSelect={select}
      />

      {!canPlay && state.outcome.kind === "playing" && (
        <p className="text-xs text-slate-400 dark:text-white/35" role="status">
          En attente du coup adverse…
        </p>
      )}

      {/* Room chat — generic infrastructure, not Checkers-specific. */}
      <RoomChat room={room} viewerUserId={viewerUserId} />

      <button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-500 dark:text-white/35 dark:hover:text-red-400"
      >
        <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.8} />
        Quitter la partie
      </button>
    </div>
  );
}
