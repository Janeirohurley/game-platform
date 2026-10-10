"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { createRoom as createRoomRequest, joinRoom as joinRoomRequest, reconnectRoom } from "./client";
import { readLobbySnapshot } from "./snapshot";
import type { LobbySnapshot, RoomPhase } from "./types";

export type RoomStatus =
  | "idle"
  | "connecting"
  | "synchronizing"
  | "connected"
  | "degraded"
  | "reconnecting"
  | "error";

/** How the local user wants to take part in the room. */
export type JoinMode = "play" | "watch";

interface UseRoomOptions {
  gameId: string;
  roomId?: string;
  targetPlayers?: number;
  /** "play" requests a seat, "watch" lands as a spectator. Default "play". */
  joinMode?: JoinMode;
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

/**
 * Game-agnostic room hook: connect (create, join or reconnect), mirror
 * the lobby state in React, expose lifecycle actions. Games read
 * `snapshot` and hand the connection to their own gameplay view once
 * the match is running.
 *
 * Pass `enabled: false` to hold the connection until the user has made
 * their choices (e.g. table size) — nothing is created before that.
 */
export function useRoom(options: UseRoomEnabledOptions): RoomController {
  const {
    gameId,
    roomId,
    targetPlayers,
    joinMode,
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
  const intentionalLeaveRef = useRef(false);

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
    let activeToken = reconnectionToken ?? null;
    let retryAttempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    intentionalLeaveRef.current = false;

    const scheduleReconnect = () => {
      if (disposed || intentionalLeaveRef.current || !activeToken) return;
      if (retryAttempt >= 5) {
        setError("La reconnexion a échoué. Vérifie ta connexion puis réessaie.");
        setStatus("error");
        return;
      }
      const delay = Math.min(1_000 * 2 ** retryAttempt, 10_000) + Math.random() * 300;
      retryAttempt += 1;
      retryTimer = setTimeout(() => void connect(true), delay);
    };

    const attach = (joined: Room) => {
      activeRoom = joined;
      activeToken =
        (joined as unknown as { reconnectionToken?: string }).reconnectionToken ??
        activeToken;
      retryAttempt = 0;
      setRoom(joined);
      setStoredReconnectionToken(
        (joined as unknown as { reconnectionToken?: string })
          .reconnectionToken ?? null,
      );
      // May be null if the first state frame has not arrived yet —
      // the onStateChange subscription below fills it in.
      setSnapshot(readLobbySnapshot(joined));
      setStatus(readLobbySnapshot(joined) ? "connected" : "synchronizing");

      joined.onStateChange(() => {
        if (!disposed) {
          setSnapshot(readLobbySnapshot(joined));
          setStatus("connected");
        }
      });

      // Belt and braces: state frames can precede our subscription on
      // very fast connections. Poll briefly until the first snapshot
      // lands so the lobby never stays stuck on the spinner.
      if (readLobbySnapshot(joined) === null) {
        const waitForState = window.setInterval(() => {
          const snapshot = readLobbySnapshot(joined);
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
        if (!disposed) {
          setError(String(message ?? "Erreur temps réel"));
          setStatus("degraded");
        }
      });

      // Colyseus keeps the room instance alive while it performs its own
      // bounded reconnection attempts. Reflect that intermediate state in
      // the UI; `onLeave` below is reserved for the point where those
      // attempts have ended and the token-based fallback must start.
      const onDrop = () => {
        if (!disposed) setStatus("reconnecting");
      };
      const onReconnect = () => {
        if (!disposed) {
          setError(null);
          setStatus("synchronizing");
        }
      };
      joined.onDrop(onDrop);
      joined.onReconnect(onReconnect);

      joined.onLeave(() => {
        if (!disposed && !intentionalLeaveRef.current) {
          setStatus("reconnecting");
          scheduleReconnect();
        }
      });
    };

    const connect = async (isReconnect = false) => {
      setStatus(isReconnect ? "reconnecting" : "connecting");
      setError(null);
      try {
        let joined: Room;
        if (isReconnect && activeToken) {
          joined = await reconnectRoom(activeToken);
        } else if (reconnectionToken) {
          joined = await reconnectRoom(reconnectionToken);
        } else if (roomId) {
          joined = await joinRoomRequest(gameId, roomId, joinMode);
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
        if (isReconnect) {
          setStatus("reconnecting");
          scheduleReconnect();
        } else {
          setStatus("error");
        }
      }
    };

    void connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (activeRoom) {
        activeRoom.removeAllListeners();
        void activeRoom.leave(true);
      }
    };
  }, [gameId, roomId, targetPlayers, joinMode, reconnectionToken, enabled]);

  const startGame = useCallback(() => {
    room?.send("startGame", {});
  }, [room]);

  const leave = useCallback(() => {
    intentionalLeaveRef.current = true;
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

/** Convenience: which lifecycle phases count as a running or done match. */
export function isMatchLive(phase: RoomPhase): boolean {
  return phase === "playing" || phase === "finished";
}
