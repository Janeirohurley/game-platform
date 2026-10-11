"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Room } from "@colyseus/sdk";

import { readLobbySnapshot } from "@/lib/realtime/snapshot";
import { joinRoom, reconnectRoom, watchRoom } from "@/lib/realtime/client";
import { clearRoomSession, persistRoomSession } from "@/lib/realtime/session-url";
import type {
  JoinRequestStatus,
  LobbySnapshot,
  RoomChatMessage,
} from "@/lib/realtime/types";
import type { MatchRole } from "@/lib/realtime/use-match-room";
import { playSound } from "@/lib/sounds";
import { Floating } from "@/components/floating";
import { RoomChat } from "@/components/realtime/chat";

import { useLiveKitVoice } from "@/lib/realtime/use-livekit-voice";
import { RoomContext, RoomAudioRenderer } from "@livekit/components-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";

import {
  CallBar,
  CloseRoomConfirmDialog,
  CountdownOverlay,
  JoinRequestsPanel,
  LeaveConfirmDialog,
  MatchHud,
  MatchSettingsDialog,
  MatchStartButton,
  RoomClosedNotice,
  WaitingOverlay,
} from "./index";
import { LiveKitStage } from "./livekit-stage";

export interface MatchScreenProps {
  room: Room;
  gameId: string;
  viewerUserId: string;
  joinMode: "play" | "watch";
  /** Parent replaces the room so game views resubscribe to restored state. */
  onRoomReconnected: (room: Room) => void;
  /** Where "back" leads once the room is closed. */
  backHref: string;
  backLabel?: string;
  /** Fired after a confirmed leave (the double confirmation lives here). */
  onLeft?: () => void;
  /** The game board, as the primary visual behind the overlays. */
  children: ReactNode;
}

/**
 * Games whose lobby exposes host-editable settings. Ludo offers the table
 * size + per-turn budget; others (checkers, rally) don't govern one yet.
 */
const SETTINGS_SUPPORTED_GAME_IDS = new Set(["ludo"]);

/**
 * The generic integrated match screen (spec sections 1 and 14).
 *
 * The board — passed as `children` — stays the main visual. Overlays
 * attach around it: match info top-left, join requests bottom-left,
 * quit / close top-right, pending / spectator banners centre-top, chat
 * bottom-right. Roles and permissions derive from the server state;
 * the server re-validates every action anyway.
 */
export function MatchScreen({
  room,
  gameId,
  viewerUserId,
  joinMode,
  onRoomReconnected,
  backHref,
  backLabel,
  onLeft,
  children,
}: MatchScreenProps) {
  const [lobby, setLobby] = useState<LobbySnapshot | null>(() =>
    readLobbySnapshot(room),
  );
  const [confirmLeave, setConfirmLeave] = useState(false);
  /** Admin's two-step close-everything confirmation. */
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);
  /** Transient match events — "Jean a quitté le match" etc. (spec §10). */
  const [notices, setNotices] = useState<string[]>([]);
  /** Chat panel + unread badge — driven from the call bar. */
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  /** Full-screen "attention à jouer" — set while the server countdown runs. */
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  /** Lobby settings panel — host edits, everyone else reads. */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const joinRequestId = useRef<string | null>(null);
  const [joinRequestStatus, setJoinRequestStatus] = useState<
    JoinRequestStatus | "idle" | "submitting" | "retrying" | "failed"
  >("idle");
  const [joinRequestError, setJoinRequestError] = useState<string | null>(null);
  const joinRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinRetryAttempt = useRef(0);
  const [, setJoinRetryTick] = useState(0);
  const retryRequestAfterReconnect = useRef(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "degraded" | "reconnecting" | "synchronizing" | "failed"
  >(room.connection?.isOpen ? "synchronizing" : "reconnecting");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const previousConnectionStatus = useRef(connectionStatus);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectInFlight = useRef(false);
  const intentionalLeave = useRef(false);

  const recoverConnection = useCallback(
    async function reconnect(manual = false): Promise<void> {
      if (reconnectInFlight.current) return;
      if (manual) {
        reconnectAttempts.current = 0;
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      }
      reconnectInFlight.current = true;
      setConnectionStatus("reconnecting");
      setConnectionError(null);
      try {
        let restored: Room;
        try {
          restored = await reconnectRoom(room.reconnectionToken);
        } catch {
          // A timed-out seat token can still recover by authenticated room
          // identity; watchRoom also keeps anonymous spectators watch-only.
          restored =
            joinMode === "watch"
              ? await watchRoom(room.roomId)
              : await joinRoom(gameId, room.roomId, joinMode);
        }
        reconnectAttempts.current = 0;
        setConnectionStatus("synchronizing");
        persistRoomSession(restored, joinMode);
        onRoomReconnected(restored);
      } catch {
        const attempt = ++reconnectAttempts.current;
        if (attempt >= 5) {
          setConnectionStatus("failed");
          setConnectionError(
            "La reconnexion automatique a échoué. Réessaie ou quitte la partie.",
          );
          return;
        }
        const delay = Math.min(1_000 * 2 ** attempt, 10_000) + Math.random() * 300;
        reconnectTimer.current = setTimeout(() => {
          void reconnect(false);
        }, delay);
      } finally {
        reconnectInFlight.current = false;
      }
    },
    [gameId, joinMode, onRoomReconnected, room],
  );

  useEffect(() => {
    intentionalLeave.current = false;
    reconnectAttempts.current = 0;
    persistRoomSession(room, joinMode);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
      reconnectInFlight.current = false;
    };
  }, [joinMode, room]);

  useEffect(() => {
    const key = `game-arena:join-request:${room.roomId}:${viewerUserId}`;
    joinRequestId.current = window.sessionStorage.getItem(key);
    return () => {
      joinRequestId.current = null;
    };
  }, [room.roomId, viewerUserId]);

  useEffect(() => {
    const onDrop = () => setConnectionStatus("reconnecting");
    const onReconnect = () => setConnectionStatus("synchronizing");
    const onError = () => setConnectionStatus("degraded");
    const onLeave = () => {
      if (intentionalLeave.current) return;
      setConnectionStatus("reconnecting");
      void recoverConnection();
    };
    room.onDrop(onDrop);
    room.onReconnect(onReconnect);
    room.onError(onError);
    room.onLeave(onLeave);
    return () => {
      room.onDrop.remove(onDrop);
      room.onReconnect.remove(onReconnect);
      room.onError.remove(onError);
      room.onLeave.remove(onLeave);
    };
  }, [recoverConnection, room]);

  useEffect(() => {
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
    const registered = room.onMessage(
      "joinRequestRegistered",
      (payload: { requestId?: string }) => {
        if (payload?.requestId !== joinRequestId.current) return;
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
          payload?.requestId !== joinRequestId.current
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

  // Voice/video rides on LiveKit: roles and the roster derive from
  // the server state, the media room joins on arrival (listen by
  // default), and the mic is requested only for players. A LiveKit
  // outage degrades voice and nothing else — the game state itself
  // never touches this module.
  const voice = useLiveKitVoice({
    room,
    snapshot: lobby,
    viewerUserId,
    autoListenOnArrival: true,
  });

  // Room events without a dedicated handler (departures, reconnections,
  // approvals, transfers) surface as transient notices. The wildcard
  // subscription also silences the SDK's "not registered" warnings.
  const noticeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => {
    const notice = (text: string): void => {
      setNotices((current) => [...current.slice(-3), text]);
      const timer = setTimeout(() => {
        setNotices((current) => current.filter((n) => n !== text));
      }, 4500);
      noticeTimers.current.set(text, timer);
    };
    const playerName = (userId: string): string => {
      const inLobby = lobby?.players.find((p) => p.userId === userId);
      if (inLobby) return inLobby.name;
      const spectator = lobby?.spectators.find((s) => s.userId === userId);
      return spectator?.name ?? "Un participant";
    };

    const unsub = room.onMessage("*", (messageType, payload) => {
      const data = (payload ?? {}) as { userId?: string; name?: string };
      switch (messageType) {
        case "playerLeft":
          playSound("userDisconnected");
          notice(`${data.name ?? playerName(data.userId ?? "")} a quitté le match.`);
          break;
        case "playerDisconnected":
          playSound("userDisconnected");
          notice(
            `${data.name ?? playerName(data.userId ?? "")} est temporairement déconnecté.`,
          );
          break;
        case "playerReconnected":
          notice(`${playerName(data.userId ?? "")} est de retour.`);
          break;
        case "hostTransferred":
          notice(`${playerName(data.userId ?? "")} dirige maintenant la partie.`);
          break;
        case "joinRequestApproved":
          notice(`${playerName(data.userId ?? "")} a rejoint la partie.`);
          break;
        case "joinRequestDecisionFailed":
          notice("La décision n’a pas été confirmée par le serveur. La demande reste en attente.");
          break;
        case "countdown": {
          // The host asked to start: hold everyone behind a full-screen
          // countdown until the server flips to PLAYING (see gameStarted).
          playSound("startGame");
          setCountdownSeconds(
            (payload as { seconds?: number }).seconds ?? 3,
          );
          break;
        }
        case "gameStarted":
          setCountdownSeconds(null);
          break;
        case "spectatorJoined":
        case "spectatorLeft":
          break; // counter in the HUD already reflects this in realtime
        default:
          break; // chat/game events have their own handlers elsewhere
      }
    });

    // The chat chime can't ride the wildcard above: once a dedicated
    // chatMessage handler exists (RoomChat's), the SDK dispatches the
    // message there only — the "*" subscription never sees it. So the
    // sound registers its own dedicated listener.
    const unsubChat = room.onMessage(
      "chatMessage",
      (message: RoomChatMessage) => {
        if (message.userId && message.userId !== viewerUserId) {
          playSound("message");
        }
      },
    );

    const timers = noticeTimers.current;
    return () => {
      unsub();
      unsubChat();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
    // lobby is read through the closure to resolve names; refresh it
    // whenever it changes so notices never show a stale name.
  }, [room, lobby, viewerUserId]);

  useEffect(() => {
    const update = () => {
      const next = readLobbySnapshot(room);
      setLobby(next);
      if (next) {
        reconnectAttempts.current = 0;
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
        setConnectionError(null);
        setConnectionStatus("connected");
      }
    };
    update();
    // onStateChange is both a signal and an event object; the callable
    // form subscribes and returns an unsubscribe function.
    const unsubscribe = room.onStateChange(update) as unknown as
      | (() => void)
      | { remove: () => void };
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      else unsubscribe.remove();
    };
  }, [room]);

  // Join-request chime: someone asked to play — diff the pending list
  // (a map keyed by userId, no "new request" event), ringing once per
  // new face. The first observation only seeds the set: joining a room
  // that already shows pending requests must not replay them all.
  const seenJoinRequests = useRef<Set<string>>(new Set());
  const joinRequestsPrimed = useRef(false);
  useEffect(() => {
    if (!lobby) return;
    const alive = new Set(lobby.pendingPlayerRequests.map((r) => r.userId));
    if (!joinRequestsPrimed.current) {
      joinRequestsPrimed.current = true;
      for (const id of alive) seenJoinRequests.current.add(id);
      return;
    }
    for (const id of alive) {
      if (seenJoinRequests.current.has(id)) continue;
      seenJoinRequests.current.add(id);
      playSound("matchingNotification");
    }
  }, [lobby]);

  useEffect(() => {
    if (!lobby) return;
    const ownPending = lobby.pendingPlayerRequests.find(
      (item) => item.userId === viewerUserId,
    );
    const ownLatestOutcome = lobby.joinRequestResults
      ?.filter((item) => item.userId === viewerUserId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (ownPending?.requestId && ownPending.requestId !== joinRequestId.current) {
      joinRequestId.current = ownPending.requestId;
      window.sessionStorage.setItem(
        `game-arena:join-request:${room.roomId}:${viewerUserId}`,
        ownPending.requestId,
      );
    } else if (!joinRequestId.current && ownLatestOutcome?.requestId) {
      joinRequestId.current = ownLatestOutcome.requestId;
      window.sessionStorage.setItem(
        `game-arena:join-request:${room.roomId}:${viewerUserId}`,
        ownLatestOutcome.requestId,
      );
    }
    if (!joinRequestId.current) return;
    const request = lobby.pendingPlayerRequests.find(
      (item) => item.requestId === joinRequestId.current,
    );
    const result = lobby.joinRequestResults?.find(
      (item) => item.requestId === joinRequestId.current,
    );
    if (request) {
      retryRequestAfterReconnect.current = false;
      setJoinRequestStatus("pending");
      setJoinRequestError(null);
    } else if (result) {
      setJoinRequestStatus(result.status);
      setJoinRequestError(
        result.status === "rejected"
          ? "Le créateur a refusé votre demande."
          : result.status === "expired"
            ? "Cette demande a expiré."
            : null,
      );
    }
  }, [lobby, room.roomId, viewerUserId]);

  useEffect(() => {
    const requestId = joinRequestId.current;
    if (
      !requestId ||
      (joinRequestStatus !== "submitting" && joinRequestStatus !== "retrying") ||
      connectionStatus !== "connected"
    ) {
      return;
    }
    const reconciled =
      lobby?.pendingPlayerRequests.some((item) => item.requestId === requestId) ||
      lobby?.joinRequestResults?.some((item) => item.requestId === requestId);
    if (reconciled) return;
    if (connectionStatus !== "connected" || !lobby) return;
    const attempt = joinRetryAttempt.current;
    if (attempt >= 5) {
      retryRequestAfterReconnect.current = true;
      setJoinRequestStatus("failed");
      setJoinRequestError(
        "La demande n'a pas encore été confirmée. Vérifie la connexion puis réessaie.",
      );
      return;
    }
    const delay = Math.min(1_000 * 2 ** attempt, 10_000) + Math.random() * 300;
    const timer = setTimeout(() => {
      joinRetryAttempt.current = attempt + 1;
      setJoinRequestStatus("retrying");
      try {
        room.send("requestJoinAsPlayer", { requestId });
      } catch {
        setJoinRequestError("Connexion instable. Nouvelle tentative en cours…");
        setConnectionStatus("degraded");
      }
      // `retrying` is already set after the first attempt; bump a separate
      // dependency so each bounded retry schedules the next backoff step.
      setJoinRetryTick((tick) => tick + 1);
    }, delay);
    joinRetryTimer.current = timer;
    return () => clearTimeout(timer);
  }, [connectionStatus, joinRequestStatus, lobby, room]);

  useEffect(() => {
    const previous = previousConnectionStatus.current;
    previousConnectionStatus.current = connectionStatus;
    const wasUnavailable = previous !== "connected";
    if (
      connectionStatus !== "connected" ||
      !wasUnavailable ||
      joinRequestStatus !== "failed" ||
      !retryRequestAfterReconnect.current
    ) return;
    const requestId = joinRequestId.current;
    if (!requestId) return;
    const reconciled =
      lobby?.pendingPlayerRequests.some((item) => item.requestId === requestId) ||
      lobby?.joinRequestResults?.some((item) => item.requestId === requestId);
    if (reconciled) return;
    joinRetryAttempt.current = 0;
    setJoinRequestStatus("retrying");
    setJoinRequestError("Reconnecté. Vérification de ta demande en cours…");
  }, [connectionStatus, joinRequestStatus, lobby]);

  const submitJoinRequest = () => {
    const terminal = ["accepted", "rejected", "cancelled", "expired"].includes(
      joinRequestStatus,
    );
    const requestId = terminal
      ? crypto.randomUUID()
      : joinRequestId.current ?? crypto.randomUUID();
    joinRequestId.current = requestId;
    window.sessionStorage.setItem(
      `game-arena:join-request:${room.roomId}:${viewerUserId}`,
      requestId,
    );
    joinRetryAttempt.current = 0;
    retryRequestAfterReconnect.current = false;
    setJoinRequestStatus("submitting");
    setJoinRequestError(null);
    try {
      room.send("requestJoinAsPlayer", { requestId });
    } catch (error) {
      retryRequestAfterReconnect.current = true;
      setJoinRequestStatus("failed");
      setJoinRequestError(
        error instanceof Error ? error.message : "La demande n'a pas pu être envoyée.",
      );
    }
  };

  if (!lobby) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
        <p className="text-sm text-neutral-400" role="status">
          Synchronisation avec la room…
        </p>
      </div>
    );
  }

  if (lobby.phase === "closed") {
    const pendingRequestWasClosed = lobby.joinRequestResults?.some(
      (result) => result.userId === viewerUserId && result.reason === "room-closed",
    ) ?? false;
    return (
      <RoomClosedNotice
        backHref={backHref}
        backLabel={backLabel}
        onBack={() => clearRoomSession(room.roomId)}
        joinRequestClosed={pendingRequestWasClosed}
      />
    );
  }

  const role: MatchRole = lobby.players.some((p) => p.userId === viewerUserId)
    ? lobby.hostUserId === viewerUserId
      ? "admin"
      : "player"
    : lobby.pendingPlayerRequests.some((r) => r.userId === viewerUserId)
      ? "pending"
      : "spectator";

  const isAdmin = role === "admin";
  const matchLive = lobby.phase === "playing" || lobby.phase === "finished";
  // Anonymous viewers (guest tokens) watch only — the server refuses
  // every seat request from them, so the button must not tease.
  const canRequestJoin = viewerUserId !== "";

  return (
    <RoomContext.Provider value={voice.mediaRoom ?? undefined}>
      <div className="fixed inset-0 z-50">
      {/* The board owns the viewport — the game stays the main event.
          Full-size boards fill the wrapper; column layouts center. */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {children}
      </div>

      {/* The HUD stays through EVERY phase — waiting, playing, finished:
          it is the match's identity card, it must never blink away. */}
      <MatchHud snapshot={lobby} isAdmin={isAdmin} />

      {connectionStatus !== "connected" && (
        <div
          className="pointer-events-auto absolute left-1/2 top-16 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-xl border border-white/10 bg-neutral-950/90 px-4 py-2.5 text-center text-xs text-white shadow-lg backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <p>
            {connectionStatus === "reconnecting"
              ? "Connexion perdue. Reconnexion en cours…"
              : connectionStatus === "synchronizing"
                ? "Reconnecté. Synchronisation de la partie…"
                : connectionStatus === "failed"
                  ? connectionError
                  : "Connexion instable. Vérification de la partie…"}
          </p>
          {connectionStatus === "failed" && (
            <button
              type="button"
              onClick={() => void recoverConnection(true)}
              className="rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white transition hover:bg-white/20"
            >
              Réessayer la reconnexion
            </button>
          )}
        </div>
      )}

      {/* The admin's start control lives alone in the top-right corner,
          visible only while the lobby is waiting or ready. */}
      {isAdmin && (
        <MatchStartButton
          snapshot={lobby}
          onStart={() => room.send("startGame", {})}
          starting={countdownSeconds !== null}
        />
      )}

      {/* Lobby settings gear — just below the start pill for the host,
          alone in the corner for everyone else. Opens the same dialog;
          only the host's controls are live inside it. */}
      {!matchLive && SETTINGS_SUPPORTED_GAME_IDS.has(gameId) && (
        <div
          className={`pointer-events-auto absolute right-3 z-40 sm:right-4 ${
            isAdmin ? "top-16 sm:top-[4.5rem]" : "top-3 sm:top-4"
          }`}
        >
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres de la partie"
            title="Paramètres de la partie"
            className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 shadow-lg transition hover:bg-black/60 hover:text-white"
          >
            <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Waiting-only banners (invite link, pending, spectator CTA).
          They leave the stage once the match is running. */}
      {!matchLive && (
        <WaitingOverlay
          roomId={room.roomId}
          gameId={gameId}
          pendingRequest={role === "pending"}
          isSpectator={role === "spectator"}
          isAdmin={isAdmin}
          onCopyInvite={() => {
            const url = `${window.location.origin}/games/${gameId}/join/${room.roomId}`;
            if (navigator.clipboard?.writeText) {
              void navigator.clipboard.writeText(url);
              return;
            }
            const textarea = document.createElement("textarea");
            textarea.value = url;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            try {
              document.execCommand("copy");
            } catch {
              // ignore
            }
            document.body.removeChild(textarea);
          }}
          requestStatus={joinRequestStatus}
          requestError={joinRequestError}
          onRetryRequest={submitJoinRequest}
          onCancelRequest={
            role === "pending"
              ? () => room.send("cancelJoinRequest", {})
              : undefined
          }
          onRequestJoin={
            role === "spectator" && canRequestJoin
              ? submitJoinRequest
              : undefined
          }
        />
      )}

      <JoinRequestsPanel
        snapshot={lobby}
        role={role}
        onApprove={(userId, requestId) =>
          room.send("approveJoin", { userId, requestId })
        }
        onReject={(userId, requestId) =>
          room.send("rejectJoin", { userId, requestId })
        }
      />

      {/* Transient match notices (departures, reconnections…), stacked
          in the bottom-left zone; nudged up when the admin's request
          panel occupies the corner. */}
      {notices.length > 0 && (
        <div
          className={`pointer-events-none absolute left-3 z-40 flex w-64 max-w-[calc(100vw-1.5rem)] flex-col gap-1.5 sm:left-4 ${
            role === "admin" && lobby.pendingPlayerRequests.length > 0
              ? "bottom-52"
              : "bottom-3 sm:bottom-4"
          }`}
          aria-live="polite"
        >
          {notices.map((text) => (
            <p
              key={text}
              className="rounded-lg border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] leading-snug text-white/85 shadow-lg backdrop-blur-md"
            >
              {text}
            </p>
          ))}
        </div>
      )}

      {/* Remote voices FIRST, unconditionally while the media room is
          connected: hearing the match must never depend on anyone
          having a camera on (the video stage below early-returns when
          nobody publishes one). */}
      {voice.mediaRoom && <RoomAudioRenderer />}

      {/* LiveKit video tiles above the board — only while someone
          publishes a camera. */}
      {voice.mediaRoom && <LiveKitStage />}

      {/* The Zoom-style call bar: mic, camera, participants, chat,
          quit/close — one icon-only line, bottom-centre. */}
      <CallBar
        voice={voice}
        room={room}
        viewerUserId={viewerUserId}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        unreadChat={unreadChat}
        onLeaveRequest={() => setConfirmLeave(true)}
        onCloseRoom={() => setConfirmCloseRoom(true)}
        isAdmin={isAdmin}
      />

      {/* Chat panel — opens above the call bar, bottom-centre-right. */}
      <div className="pointer-events-none absolute bottom-16 right-3 z-50 flex justify-end sm:bottom-[4.5rem] sm:right-4">
        <Floating storageKey="match-screen.chat">
          <RoomChat
            room={room}
            viewerUserId={viewerUserId}
            variant="controlled"
            open={chatOpen}
            onCloseRequest={() => setChatOpen(false)}
            onUnreadChange={setUnreadChat}
          />
        </Floating>
      </div>

      {confirmLeave && (
        <LeaveConfirmDialog
          onConfirm={() => {
            setConfirmLeave(false);
            intentionalLeave.current = true;
            clearRoomSession(room.roomId);
            room.leave(true);
            onLeft?.();
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {/* Admin closes for EVERYONE — two explicit confirmations, like
          leaving (the server re-validates the admin rights anyway). */}
      {confirmCloseRoom && (
        <CloseRoomConfirmDialog
          onConfirm={() => {
            setConfirmCloseRoom(false);
            room.send("closeRoom", {});
          }}
          onCancel={() => setConfirmCloseRoom(false)}
        />
      )}

      {settingsOpen && SETTINGS_SUPPORTED_GAME_IDS.has(gameId) && (
        <MatchSettingsDialog
          snapshot={lobby}
          isAdmin={isAdmin}
          onClose={() => setSettingsOpen(false)}
          onUpdate={(settings) =>
            room.send("updateLobbySettings", settings)
          }
        />
      )}

      {/* Full-screen "attention à jouer" while the server's start
          countdown runs — covers the whole stage, nobody plays early. */}
      {countdownSeconds !== null && (
        <CountdownOverlay seconds={countdownSeconds} />
      )}
      </div>
    </RoomContext.Provider>
  );
}
