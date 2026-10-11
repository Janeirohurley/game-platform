"use client";

import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { MatchScreen } from "@/components/realtime/match";
import type { LudoPlayerView } from "@/lib/realtime/types";

import { OnlineLudoPlay, type ServerLudoSnapshot } from "./online-ludo-play";

export interface LudoRoomViewProps {
  room: Room;
  viewerUserId: string;
  joinMode: "play" | "watch";
  onRoomReconnected: (room: Room) => void;
  /** Fired after a confirmed leave (the double-confirmation lives in the match screen). */
  onLeft: () => void;
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
 * The Ludo match screen: the 3D board as the primary visual, wrapped by
 * the GENERIC match shell (HUD top-left, join requests bottom-left,
 * quit/close top-right, pending/spectator banners, chat bottom-right).
 * The Ludo module only contributes its own state reading and its board;
 * every room concern lives in the shared components (spec section 17).
 */
export function LudoRoomView({
  room,
  viewerUserId,
  joinMode,
  onRoomReconnected,
  onLeft,
}: LudoRoomViewProps) {
  const [game, setGame] = useState<ServerLudoSnapshot | null>(() =>
    readState(room),
  );

  useEffect(() => {
    const update = () => setGame(readState(room));
    update();
    // onStateChange is both a signal and an event object; the callable
    // form subscribes and returns an unsubscribe function.
    const unsubscribe = room.onStateChange(update) as unknown as
      | (() => void)
      | { remove: () => void };
    // The first state frame may arrive before this subscription — poll
    // briefly until a decodable snapshot shows up.
    let waitForState = 0;
    let stopPolling = 0;
    if (readState(room) === null) {
      waitForState = window.setInterval(() => {
        const next = readState(room);
        if (next) {
          window.clearInterval(waitForState);
          setGame(next);
        }
      }, 100);
      stopPolling = window.setTimeout(
        () => window.clearInterval(waitForState),
        5_000,
      );
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      else unsubscribe.remove();
      window.clearInterval(waitForState);
      window.clearTimeout(stopPolling);
    };
  }, [room]);

  if (!game) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
        <p className="text-sm text-neutral-400" role="status">
          Synchronisation avec la room…
        </p>
      </div>
    );
  }

  return (
    <MatchScreen
      room={room}
      gameId={game.gameId}
      viewerUserId={viewerUserId}
      joinMode={joinMode}
      onRoomReconnected={onRoomReconnected}
      backHref="/games/ludo/play"
      backLabel="Retour au Ludo"
      onLeft={onLeft}
    >
      <OnlineLudoPlay
        room={room}
        snapshot={game}
        viewerUserId={viewerUserId}
      />
    </MatchScreen>
  );
}
