"use client";

import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { GameLobby } from "@/components/realtime/lobby";
import type { LudoPlayerView } from "@/lib/realtime/types";

import { OnlineLudoPlay, type ServerLudoSnapshot } from "./online-ludo-play";

export interface LudoRoomViewProps {
  room: Room;
  viewerUserId: string;
  onLeave: () => void;
}

function readState(room: Room): ServerLudoSnapshot | null {
  const state = room.state as unknown as
    | {
        gameId: string;
        gameName: string;
        minPlayers: number;
        maxPlayers: number;
        targetPlayers: number;
        phase: string;
        hostUserId: string;
        players: Map<string, LudoPlayerView>;
        currentTurn: string;
        diceValue: number;
        turnDeadline: number;
        winnerUserId: string;
      }
    | undefined;

  // The join handshake resolves before the first full state frame may
  // have arrived — guard against the half-decoded state instead of
  // crashing on `players.values()`.
  if (!state?.players) return null;

  return {
    gameId: state.gameId,
    gameName: state.gameName,
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
    targetPlayers: state.targetPlayers,
    phase: state.phase as ServerLudoSnapshot["phase"],
    hostUserId: state.hostUserId,
    players: [...state.players.values()].map((player) => ({
      ...player,
      pieces: player.pieces?.map((piece) => ({ ...piece })) ?? [],
    })),
    currentTurn: state.currentTurn,
    diceValue: state.diceValue,
    turnDeadline: state.turnDeadline,
    winnerUserId: state.winnerUserId,
  };
}

/**
 * Ludo-specific room view. Subscribes to the joined room, keeps a local
 * mirror of the server state, and switches between:
 *   - the generic lobby (waiting / ready),
 *   - the 3D board driven by server state (playing),
 *   - the finished screen (finished).
 */
export function LudoRoomView({ room, viewerUserId, onLeave }: LudoRoomViewProps) {
  const [snapshot, setSnapshot] = useState<ServerLudoSnapshot | null>(() =>
    readState(room),
  );

  useEffect(() => {
    const update = () => setSnapshot(readState(room));
    update();
    // onStateChange is both a signal and an event object; the callable
    // form subscribes and returns an unsubscribe function.
    const unsubscribe = room.onStateChange(update) as unknown as
      | (() => void)
      | { remove: () => void };
    // The first state frame may arrive before this subscription — poll
    // briefly until a decodable snapshot shows up.
    if (readState(room) === null) {
      const waitForState = window.setInterval(() => {
        const next = readState(room);
        if (next) {
          window.clearInterval(waitForState);
          setSnapshot(next);
        }
      }, 100);
      const stopPolling = window.setTimeout(
        () => window.clearInterval(waitForState),
        5_000,
      );
      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
        else unsubscribe.remove();
        window.clearInterval(waitForState);
        window.clearTimeout(stopPolling);
      };
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      else unsubscribe.remove();
    };
  }, [room]);

  const inviteUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/games/ludo/join/${room.roomId}`;

  // State frame not decoded yet — brief loading state.
  if (!snapshot) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
        <p className="text-sm text-neutral-400" role="status">
          Synchronisation avec la room…
        </p>
      </div>
    );
  }

  if (snapshot.phase === "playing" || snapshot.phase === "finished") {
    // The 3D board needs a real viewport: mount it fullscreen regardless
    // of the hosting page layout (entry page, invitation landing…), so
    // host and guests get the exact same full-size experience.
    return (
      <div className="fixed inset-0 z-50">
        <OnlineLudoPlay
          room={room}
          snapshot={snapshot}
          viewerUserId={viewerUserId}
          onLeave={onLeave}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
      <GameLobby
        snapshot={snapshot}
        viewerUserId={viewerUserId}
        inviteUrl={inviteUrl}
        onCopyInvite={() => void navigator.clipboard.writeText(inviteUrl)}
        onLeave={onLeave}
        onStart={() => room.send("startGame", {})}
      />
    </div>
  );
}
