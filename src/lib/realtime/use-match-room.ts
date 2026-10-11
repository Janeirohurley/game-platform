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
  const retryRequestAfterReconnect = useRef(false);
  const previousRoomStatus = useRef(status);
  const [joinRequestStatus, setJoinRequestStatus] = useState<
    JoinRequestStatus | "idle" | "submitting" | "retrying" | "failed"
  >("idle");
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);
  const [, setRetryTick] = useState(0);

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
    const ownLatestOutcome = snapshot.joinRequestResults
      ?.filter((item) => item.userId === viewerUserId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (ownPending?.requestId && ownPending.requestId !== requestIdRef.current) {
      requestIdRef.current = ownPending.requestId;
      if (typeof window !== "undefined" && joinedRoomId) {
        window.sessionStorage.setItem(
          `game-arena:join-request:${joinedRoomId}:${viewerUserId}`,
          ownPending.requestId,
        );
      }
    } else if (!requestIdRef.current && ownLatestOutcome?.requestId) {
      requestIdRef.current = ownLatestOutcome.requestId;
      if (typeof window !== "undefined" && joinedRoomId) {
        window.sessionStorage.setItem(
          `game-arena:join-request:${joinedRoomId}:${viewerUserId}`,
          ownLatestOutcome.requestId,
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
      retryRequestAfterReconnect.current = false;
      setJoinRequestStatus("pending");
      setJoinRequestError(null);
    } else if (result) {
      retryRequestAfterReconnect.current = false;
      setJoinRequestStatus(result.status);
      setJoinRequestError(null);
    }
  }, [joinedRoomId, snapshot, viewerUserId]);

  useEffect(() => {
    if (!room) return;
    return room.onMessage(
      "joinRequestRegistrationFailed",
      (payload: { reason?: string }) => {
        retryRequestAfterReconnect.current = true;
        setJoinRequestStatus("retrying");
        setJoinRequestError(
          payload?.reason === "persistence-unavailable"
            ? "Le serveur vérifie encore ta demande. Nouvelle tentative automatique…"
            : "La demande n'a pas pu être confirmée. Nouvelle tentative automatique…",
        );
      },
    );
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const registered = room.onMessage(
      "joinRequestRegistered",
      (payload: { requestId?: string }) => {
        if (payload?.requestId !== requestIdRef.current) return;
        retryRequestAfterReconnect.current = false;
        setJoinRequestStatus("pending");
        setJoinRequestError(null);
      },
    );
    const rejected = room.onMessage(
      "joinRequestRejected",
      (payload: { userId?: string; requestId?: string; reason?: string }) => {
        if (
          payload?.userId !== viewerUserId &&
          payload?.requestId !== requestIdRef.current
        ) return;
        retryRequestAfterReconnect.current = false;
        setJoinRequestStatus(payload?.reason === "declined" ? "rejected" : "failed");
        setJoinRequestError(
          payload?.reason === "declined"
            ? "Le créateur a refusé ta demande. Tu peux en envoyer une nouvelle."
            : payload?.reason === "room-full"
              ? "La partie est complète. Tu peux réessayer si une place se libère."
              : payload?.reason === "guests-watch-only"
                ? "Un compte invité peut regarder, mais ne peut pas demander une place."
                : "Cette partie n’accepte plus de demandes. Choisis une autre partie.",
        );
      },
    );
    return () => {
      registered();
      rejected();
    };
  }, [room, viewerUserId]);

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
    if (alreadyReconciled || status !== "connected" || !snapshot) return;

    const attempt = retryAttemptRef.current;
    if (attempt >= 5) {
      retryRequestAfterReconnect.current = true;
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
        // `retrying` is already the current status after the first attempt;
        // changing only that state would not re-arm this effect.
        setRetryTick((tick) => tick + 1);
    }, delay);
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [joinRequestStatus, room, snapshot, status]);

  useEffect(() => {
    const previous = previousRoomStatus.current;
    previousRoomStatus.current = status;
    if (
      status !== "connected" ||
      previous === "connected" ||
      joinRequestStatus !== "failed" ||
      !retryRequestAfterReconnect.current
    ) return;
    const requestId = requestIdRef.current;
    if (!requestId) return;
    const reconciled =
      snapshot?.pendingPlayerRequests.some((item) => item.requestId === requestId) ||
      snapshot?.joinRequestResults?.some((item) => item.requestId === requestId);
    if (reconciled) return;
    retryAttemptRef.current = 0;
    setJoinRequestStatus("retrying");
    setJoinRequestError("Reconnecté. Vérification de ta demande en cours…");
  }, [joinRequestStatus, snapshot, status]);

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
    const terminal = ["accepted", "rejected", "cancelled", "expired"].includes(
      joinRequestStatus,
    );
    const requestId = terminal
      ? crypto.randomUUID()
      : requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    if (typeof window !== "undefined" && joinedRoomId) {
      window.sessionStorage.setItem(
        `game-arena:join-request:${joinedRoomId}:${viewerUserId}`,
        requestId,
      );
    }
    retryAttemptRef.current = 0;
    retryRequestAfterReconnect.current = false;
    setJoinRequestError(null);
    setJoinRequestStatus("submitting");
    try {
      room.send("requestJoinAsPlayer", { requestId });
    } catch (sendError) {
      retryRequestAfterReconnect.current = true;
      setJoinRequestStatus("failed");
      setJoinRequestError(
        sendError instanceof Error ? sendError.message : "La demande n'a pas pu être envoyée.",
      );
    }
  }, [joinRequestStatus, joinedRoomId, room, viewerUserId]);

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
