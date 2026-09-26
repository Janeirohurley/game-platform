"use client";

import { useCallback, useMemo } from "react";

import { useRoom, type JoinMode, type RoomStatus } from "./use-room";
import type { LobbySnapshot } from "./types";

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
  approveJoin: (userId: string) => void;
  /** Host only — decline a pending requester. */
  rejectJoin: (userId: string) => void;
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

  const actions = useMemo<MatchActions>(
    () => ({
      startGame: () => send("startGame"),
      requestJoinAsPlayer: () => send("requestJoinAsPlayer"),
      cancelJoinRequest: () => send("cancelJoinRequest"),
      approveJoin: (userId: string) => send("approveJoin", { userId }),
      rejectJoin: (userId: string) => send("rejectJoin", { userId }),
      closeRoom: () => send("closeRoom"),
      leaveMatch: () => leave(),
    }),
    [send, leave],
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
    actions,
  };
}
