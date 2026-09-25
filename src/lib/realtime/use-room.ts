"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { createRoom as createRoomRequest, joinRoom as joinRoomRequest, reconnectRoom } from "./client";
import type { LobbyPlayerView, LobbySnapshot, RoomPhase } from "./types";

export type RoomStatus = "idle" | "connecting" | "connected" | "error";

interface UseRoomOptions {
  gameId: string;
  roomId?: string;
  targetPlayers?: number;
  reconnectionToken?: string;
  onPlaying?: (roomId: string) => void;
}

interface RoomController {
  snapshot: LobbySnapshot | null;
  status: RoomStatus;
  error: string | null;
  roomId: string | null;
  /** The live room connection — needed by gameplay views that send intents. */
  room: Room | null;
  reconnectionToken: string | null;
  startGame: () => void;
  leave: () => void;
}

/**
 * Options that actually trigger a connection. When `disabled` the hook
 * stays idle — used until the user has picked a table size (or until an
 * invitation route has confirmed it wants to connect).
 */
interface UseRoomEnabledOptions extends UseRoomOptions {
  /** When false, no connection is opened and status stays "idle". */
  enabled?: boolean;
}

function readSnapshot(room: Room): LobbySnapshot | null {
  const state = room.state as unknown as
    | {
        gameId: string;
        gameName: string;
        minPlayers: number;
        maxPlayers: number;
        targetPlayers: number;
        phase: RoomPhase;
        hostUserId: string;
        players: Map<string, LobbyPlayerView>;
      }
    | undefined;

  // The SDK resolves create()/joinById() on the join handshake, but the
  // first full state message can arrive on a later WebSocket frame.
  // Until it does, `room.state` fields are undefined — return null and
  // let the onStateChange subscription populate the snapshot instead of
  // crashing on a half-decoded state.
  if (!state?.players) return null;

  return {
    gameId: state.gameId,
    gameName: state.gameName,
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
    targetPlayers: state.targetPlayers,
    phase: state.phase,
    hostUserId: state.hostUserId,
    players: [...state.players.values()].map((player) => ({ ...player })),
  };
}

/**
 * Game-agnostic room hook: connect, mirror the lobby state in React,
 * expose lifecycle actions. Games read `snapshot` and, once
 * `phase === "playing"`, hand the connection to their own gameplay view.
 *
 * Pass `enabled: false` to hold the connection until the user has made
 * their choices (e.g. table size) — nothing is created before that.
 */
export function useRoom(options: UseRoomEnabledOptions): RoomController {
  const {
    gameId,
    roomId,
    targetPlayers,
    reconnectionToken,
    onPlaying,
    enabled = true,
  } = options;

  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [status, setStatus] = useState<RoomStatus>(
    enabled ? "connecting" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [storedReconnectionToken, setStoredReconnectionToken] = useState<
    string | null
  >(reconnectionToken ?? null);

  const onPlayingRef = useRef(onPlaying);

  useEffect(() => {
    onPlayingRef.current = onPlaying;
  }, [onPlaying]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let activeRoom: Room | null = null;

    const attach = (joined: Room) => {
      activeRoom = joined;
      setRoom(joined);
      setStoredReconnectionToken(
        (joined as unknown as { reconnectionToken?: string })
          .reconnectionToken ?? null,
      );
      // May be null if the first state frame has not arrived yet —
      // the onStateChange subscription below fills it in.
      setSnapshot(readSnapshot(joined));
      setStatus("connected");

      joined.onStateChange(() => {
        if (!disposed) setSnapshot(readSnapshot(joined));
      });

      // Belt and braces: state frames can precede our subscription on
      // very fast connections. Poll briefly until the first snapshot
      // lands so the lobby never stays stuck on the spinner.
      if (readSnapshot(joined) === null) {
        const waitForState = window.setInterval(() => {
          const snapshot = readSnapshot(joined);
          if (snapshot) {
            window.clearInterval(waitForState);
            if (!disposed) setSnapshot(snapshot);
          }
        }, 100);
        window.setTimeout(() => window.clearInterval(waitForState), 5_000);
      }

      joined.onMessage("gameStarted", () => {
        onPlayingRef.current?.(joined.roomId);
      });

      joined.onError((message: unknown) => {
        if (!disposed) setError(String(message ?? "Erreur temps réel"));
      });

      joined.onLeave(() => {
        if (!disposed) setStatus("idle");
      });
    };

    const connect = async () => {
      setStatus("connecting");
      setError(null);
      try {
        let joined: Room;
        if (reconnectionToken) {
          joined = await reconnectRoom(reconnectionToken);
        } else if (roomId) {
          joined = await joinRoomRequest(gameId, roomId);
        } else {
          joined = await createRoomRequest(gameId, targetPlayers ?? 4);
        }
        if (disposed) {
          void joined.leave();
          return;
        }
        attach(joined);
      } catch (connectionError) {
        if (disposed) return;
        setError(
          connectionError instanceof Error
            ? connectionError.message
            : "Connexion à la room impossible.",
        );
        setStatus("error");
      }
    };

    void connect();

    return () => {
      disposed = true;
      if (activeRoom) {
        activeRoom.removeAllListeners();
        void activeRoom.leave(true);
      }
    };
  }, [gameId, roomId, targetPlayers, reconnectionToken, enabled]);

  const startGame = useCallback(() => {
    room?.send("startGame", {});
  }, [room]);

  const leave = useCallback(() => {
    room?.leave(true);
  }, [room]);

  return {
    snapshot,
    status,
    error,
    room,
    roomId: room?.roomId ?? null,
    reconnectionToken: storedReconnectionToken,
    startGame,
    leave,
  };
}
