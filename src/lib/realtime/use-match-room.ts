"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRoom, type JoinMode, type RoomStatus } from "./use-room";
import type { JoinRequestStatus, LobbySnapshot } from "./types";

/**
 * The viewer's role in the room, as decided by the SERVER state.
 *
 * The four roles are mutually exclusive and disjoint on the server
 * (players / pending requests / spectators are three separate maps);
 * the client only reads that truth, it never decides a role itself.
 */
export type MatchRole = "admin" | "player" | "pending" | "spectator";

export interface MatchActions {
  /** Host only — actually starts once the table conditions are met. */
  startGame: () => void;
  /** Ask for a seat (pending users resend through the same channel). */
  requestJoinAsPlayer: () => void;
  /** Withdraw your own pending request. */
  cancelJoinRequest: () => void;
  /** Host only — grant a seat to a pending requester. */
  approveJoin: (userId: string, requestId: string) => void;
  /** Host only — decline a pending requester. */
  rejectJoin: (userId: string, requestId: string) => void;
  /** Host only — shut the room down for everyone, for good. */
  closeRoom: () => void;
  /**
   * Final, deliberate leave. The UI must have run its two-step
   * confirmation BEFORE calling this — the server treats it as
   * consented, the seat is freed and everyone is told.
   */
  leaveMatch: () => void;
}

export interface MatchController {
  snapshot: LobbySnapshot | null;
  status: RoomStatus;
  error: string | null;
  roomId: string | null;
  /** The live connection, for game views that send their own intents. */
  room: ReturnType<typeof useRoom>["room"];
  reconnectionToken: string | null;
  /** The viewer's role, read from the server's disjoint records. */
  role: MatchRole;
  /** True when the viewer is the room admin. */
  isAdmin: boolean;
  /** True when the viewer is a seated player (admin included). */
  isPlayer: boolean;
  /** Viewer's own pending request, when they are waiting for approval. */
  pendingRequest: boolean;
  /** Client-side submission phase, reconciled against server state. */
  joinRequestStatus: JoinRequestStatus | "idle" | "submitting" | "retrying" | "failed";
  joinRequestError: string | null;
  retryJoinRequest: () => void;
  actions: MatchActions;
}

interface UseMatchRoomOptions {
  gameId: string;
  viewerUserId: string;
  /** Room to join when the viewer is not the creator. */
  roomId?: string;
  /** Table size at creation — the game's allowed sizes are enforced server-side. */
  targetPlayers?: number;
  /** "play" requests a seat, "watch" lands as a spectator immediately. */
  joinMode?: JoinMode;
  reconnectionToken?: string;
  enabled?: boolean;
}

/**
 * Game-agnostic match controller on top of the connection hook.
 *
 * Everything here derives from the mirrored server state: the role,
 * the permissions, who may press what. The server re-validates every
 * message it receives, so a tampered client cannot gain rights.
 */
export function useMatchRoom(options: UseMatchRoomOptions): MatchController {
  const {
    gameId,
    viewerUserId,
    roomId,
    targetPlayers,
    joinMode,
    reconnectionToken,
    enabled,
  } = options;

  const { snapshot, status, error, room, roomId: joinedRoomId, reconnectionToken: storedToken, leave } =
    useRoom({ gameId, roomId, targetPlayers, joinMode, reconnectionToken, enabled });

  const requestIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const [joinRequestStatus, setJoinRequestStatus] = useState<
    JoinRequestStatus | "idle" | "submitting" | "retrying" | "failed"
  >("idle");
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !joinedRoomId) return;
    const key = `game-arena:join-request:${joinedRoomId}:${viewerUserId}`;
    requestIdRef.current = window.sessionStorage.getItem(key);
    const retryTimer = retryTimerRef.current;
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [joinedRoomId, viewerUserId]);

  useEffect(() => {
    if (!snapshot) return;
    const ownPending = snapshot.pendingPlayerRequests.find(
      (request) => request.userId === viewerUserId,
    );
    if (!requestIdRef.current && ownPending?.requestId) {
      requestIdRef.current = ownPending.requestId;
      if (typeof window !== "undefined" && joinedRoomId) {
        window.sessionStorage.setItem(
          `game-arena:join-request:${joinedRoomId}:${viewerUserId}`,
          ownPending.requestId,
        );
      }
    }
    if (!requestIdRef.current) return;
    const requestId = requestIdRef.current;
    const pending = snapshot.pendingPlayerRequests.find(
      (request) => request.requestId === requestId,
    );
    const result = snapshot.joinRequestResults?.find(
      (item) => item.requestId === requestId,
    );
    if (pending) {
      setJoinRequestStatus("pending");
      setJoinRequestError(null);
    } else if (result) {
      setJoinRequestStatus(result.status);
      setJoinRequestError(null);
    }
  }, [joinedRoomId, snapshot, viewerUserId]);

  useEffect(() => {
    if (
      !room ||
      !requestIdRef.current ||
      (joinRequestStatus !== "submitting" && joinRequestStatus !== "retrying")
    ) {
      return;
    }
    const requestId = requestIdRef.current;
    const alreadyReconciled =
      snapshot?.pendingPlayerRequests.some((item) => item.requestId === requestId) ||
      snapshot?.joinRequestResults?.some((item) => item.requestId === requestId);
    if (alreadyReconciled) return;

    const attempt = retryAttemptRef.current;
    if (attempt >= 5) {
      setJoinRequestStatus("failed");
      setJoinRequestError("La demande n'a pas encore été confirmée. Réessaie lorsque la connexion sera stable.");
      return;
    }
    const delay = Math.min(1_000 * 2 ** attempt, 10_000) + Math.random() * 300;
    retryTimerRef.current = setTimeout(() => {
      retryAttemptRef.current = attempt + 1;
      setJoinRequestStatus("retrying");
      try {
        room.send("requestJoinAsPlayer", { requestId });
      } catch {
        setJoinRequestError("Connexion instable. Nouvelle tentative en cours…");
      }
    }, delay);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [joinRequestStatus, room, snapshot]);

  const role: MatchRole = useMemo(() => {
    if (!snapshot) return "spectator";
    if (snapshot.players.some((p) => p.userId === viewerUserId)) {
      return snapshot.hostUserId === viewerUserId ? "admin" : "player";
    }
    if (snapshot.pendingPlayerRequests.some((r) => r.userId === viewerUserId)) {
      return "pending";
    }
    return "spectator";
  }, [snapshot, viewerUserId]);

  const isAdmin = role === "admin";
  const isPlayer = role === "admin" || role === "player";
  const pendingRequest = role === "pending";

  const send = useCallback(
    (type: string, message?: unknown) => {
      room?.send(type, message ?? {});
    },
    [room],
  );

  const requestJoin = useCallback(() => {
    if (!room) {
      setJoinRequestStatus("failed");
      setJoinRequestError("Connexion indisponible. Réessaie lorsque la room sera reconnectée.");
      return;
    }
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    if (typeof window !== "undefined" && joinedRoomId) {
      window.sessionStorage.setItem(
        `game-arena:join-request:${joinedRoomId}:${viewerUserId}`,
        requestId,
      );
    }
    retryAttemptRef.current = 0;
    setJoinRequestError(null);
    setJoinRequestStatus("submitting");
    try {
      room.send("requestJoinAsPlayer", { requestId });
    } catch (sendError) {
      setJoinRequestStatus("failed");
      setJoinRequestError(
        sendError instanceof Error ? sendError.message : "La demande n'a pas pu être envoyée.",
      );
    }
  }, [joinedRoomId, room, viewerUserId]);

  const retryJoinRequest = useCallback(() => {
    if (!requestIdRef.current) return requestJoin();
    requestJoin();
  }, [requestJoin]);

  const actions = useMemo<MatchActions>(
    () => ({
      startGame: () => send("startGame"),
      requestJoinAsPlayer: requestJoin,
      cancelJoinRequest: () => send("cancelJoinRequest"),
      approveJoin: (userId: string, requestId: string) =>
        send("approveJoin", { userId, requestId }),
      rejectJoin: (userId: string, requestId: string) =>
        send("rejectJoin", { userId, requestId }),
      closeRoom: () => send("closeRoom"),
      leaveMatch: () => leave(),
    }),
    [leave, requestJoin, send],
  );

  return {
    snapshot,
    status,
    error,
    roomId: joinedRoomId,
    room,
    reconnectionToken: storedToken,
    role,
    isAdmin,
    isPlayer,
    pendingRequest,
    joinRequestStatus,
    joinRequestError,
    retryJoinRequest,
    actions,
  };
}
