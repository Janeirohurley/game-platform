"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, PlusSignIcon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import {
  createRoom,
  fetchRealtimeToken,
  getRealtimeClient,
  joinRoom,
  reconnectRoom,
  useMatchList,
  watchRoom,
} from "@/lib/realtime";
import {
  clearRoomSession,
  persistRoomSession,
  readRoomIdFromUrl,
  readRoomSession,
} from "@/lib/realtime/session-url";
import {
  AuthRequiredDialog,
  MatchList,
  RoomClosedNotice,
} from "@/components/realtime/match";
import { LudoRoomView } from "@/games/ludo/online/ludo-room-view";

/**
 * Detects the platform's "no session" answer from a token fetch — the
 * cue to open the sign-in popup instead of a bare error banner.
 */
function isAuthRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Connecte-toi");
}

interface PlayOnlineLudoProps {
  gameId: string;
  /** Table sizes Ludo supports — read from the games registry. */
  allowedPlayerCounts: readonly number[];
  viewerUserId: string;
}

type PendingJoin = { roomId: string; mode: "play" | "watch" };

/**
 * The live area of the Ludo play page.
 *
 * Hierarchy follows the spec: the match LIST is the main content; table
 * creation stays a compact secondary strip below it. Both paths lead
 * straight into the match screen — the board — with no lobby page in
 * between. Everything shown comes from the realtime matchmaker; no
 * mocked data anywhere.
 */
export function PlayOnlineLudo({
  gameId,
  allowedPlayerCounts,
  viewerUserId,
}: PlayOnlineLudoProps) {
  const [targetPlayers, setTargetPlayers] = useState<number | null>(null);
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** "create" | "join" | null — drives the sign-in popup when set. */
  const [authIntent, setAuthIntent] = useState<"create" | "join" | null>(
    null,
  );

  const matchList = useMatchList(gameId);

  // ------------------------------------------------------------------
  // Refresh survival: the URL carries the room id, sessionStorage the
  // reconnection token. On mount, restore instead of bouncing the user
  // back to the list — the server kept their seat (grace window).
  // ------------------------------------------------------------------
  const restoredForRef = useRef<string | null>(null);
  useEffect(() => {
    const urlRoomId = readRoomIdFromUrl();
    if (!urlRoomId || restoredForRef.current === urlRoomId) return;
    restoredForRef.current = urlRoomId;
    setRestoring(true);
    void (async () => {
      try {
        const session = readRoomSession(urlRoomId);
        const mode = session?.mode ?? "watch";
        const joined = session
          ? // 1) Preferred: full reconnection (same seat, same role).
            await reconnectRoom(session.reconnectionToken).catch(() =>
              // 2) Fallback: fresh join; the server reclaims the seat
              //    for the same userId or applies its own rules.
              mode === "watch"
                ? watchRoom(urlRoomId)
                : joinRoom(gameId, urlRoomId, mode),
            )
          : // Guest/shared link without a stored session: watch.
            await watchRoom(urlRoomId);
        persistRoomSession(joined, mode);
        setRoom(joined);
      } catch {
        // Room gone (closed, disposed) or session expired: clean slate.
        clearRoomSession(urlRoomId);
        setError(
          "Cette partie n'est plus disponible. Voici les tables en cours.",
        );
      } finally {
        setRestoring(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoin = useCallback((join: PendingJoin) => {
    setError(null);
    setPendingJoin(join);
    void (async () => {
      try {
        // Watching works without an account (guest token); playing
        // requires one — the server must know who it seats.
        const joined =
          join.mode === "watch"
            ? await watchRoom(join.roomId)
            : await getRealtimeClient().joinById(join.roomId, {
                token: await fetchRealtimeToken(),
                mode: "play",
              });
        persistRoomSession(joined, join.mode);
        setRoom(joined);
      } catch (joinError) {
        if (isAuthRequiredError(joinError)) {
          // Anonymous visitor asking for a seat: popup, not banner.
          setAuthIntent("join");
          setPendingJoin(null);
          return;
        }
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Impossible de rejoindre cette room.",
        );
      } finally {
        if (join.mode === "watch") setPendingJoin(null);
      }
    })();
  }, []);

  const startCreation = useCallback(
    (count: number, botCount: number) => {
      setError(null);
      setTargetPlayers(count);
      void (async () => {
        try {
          // At least one human seat always stays: the creator's own.
          const seatedBots = Math.min(
            Math.max(0, botCount),
            Math.max(0, count - 1),
          );
          const joined = await createRoom(gameId, count, seatedBots);
          persistRoomSession(joined, "play");
          setRoom(joined);
        } catch (createError) {
          setTargetPlayers(null);
          if (isAuthRequiredError(createError)) {
            // Anonymous visitor creating a table: popup, not banner.
            setAuthIntent("create");
            return;
          }
          setError(
            createError instanceof Error
              ? createError.message
              : "Création de la table impossible.",
          );
        }
      })();
    },
    [gameId],
  );

  if (room) {
    return (
      <ConnectedMatch
        room={room}
        viewerUserId={viewerUserId}
        onRoomReconnected={setRoom}
        onLeft={() => {
          clearRoomSession(room.roomId);
          setRoom(null);
          setPendingJoin(null);
          setTargetPlayers(null);
          matchList.refresh();
        }}
      />
    );
  }

  if (restoring || pendingJoin || (targetPlayers !== null && !error)) {
    return (
      <div
        className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-100/60 dark:border-white/[0.07] dark:bg-white/[0.02]"
        role="status"
      >
        <HugeiconsIcon
          icon={Loading03Icon}
          size={22}
          strokeWidth={1.8}
          className="animate-spin text-slate-500 dark:text-white/60"
        />
        <p className="text-sm text-slate-500 dark:text-white/60">
          {pendingJoin ? "Connexion à la partie…" : "Ouverture de ta table…"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/25 dark:bg-red-400/[0.08] dark:text-red-300">
          {error}
        </p>
      )}

      {/* MAIN content — the live tables (spec section 2). */}
      <MatchList
        rooms={matchList.rooms}
        loading={matchList.loading}
        error={matchList.error}
        onJoinAsPlayer={(roomId) => handleJoin({ roomId, mode: "play" })}
        onWatch={(roomId) => handleJoin({ roomId, mode: "watch" })}
      />

      {/* SECONDARY — creating, compact and out of the way (spec 4). */}
      <div
        id="creer"
        className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm shadow-slate-200/50 sm:p-6 dark:border-white/[0.07] dark:bg-white/[0.015] dark:shadow-none"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
              <HugeiconsIcon
                icon={PlusSignIcon}
                size={15}
                strokeWidth={2}
                className="text-cyan-600 dark:text-cyan-300"
              />
              Nouvelle table
            </h3>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-500 dark:text-white/40">
              Tu entres directement dans le match et acceptes les demandes
              depuis le board. Ajoute des adversaires IA pour lancer tout de
              suite ; les spectateurs ne comptent pas dans la capacité.
            </p>
          </div>

          <TableSizePicker
            allowedPlayerCounts={allowedPlayerCounts}
            onPick={startCreation}
            viewerSignedIn={viewerUserId !== ""}
            onNeedSignIn={() => setAuthIntent("create")}
          />
        </div>
      </div>

      <AuthRequiredDialog
        open={authIntent !== null}
        intent={authIntent ?? "join"}
        onClose={() => setAuthIntent(null)}
      />
    </div>
  );
}

interface ConnectedMatchProps {
  room: Room;
  viewerUserId: string;
  onRoomReconnected: (room: Room) => void;
  onLeft: () => void;
}

/**
 * Owns the "creator left without closing" case: closing the tab or
 * navigating away drops the connection — the SERVER holds the seat and
 * the room, so a refresh restores it through reconnection rather than
 * ending the match.
 */
function ConnectedMatch({
  room,
  viewerUserId,
  onRoomReconnected,
  onLeft,
}: ConnectedMatchProps) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const unsubscribe = room.onMessage("roomClosed", () => {
      setClosed(true);
    });
    return unsubscribe;
  }, [room]);

  if (closed) {
    return (
      <RoomClosedNotice
        backHref="/games/ludo/play"
        backLabel="Retour au Ludo"
        onBack={() => clearRoomSession(room.roomId)}
      />
    );
  }

  return (
    <LudoRoomView
      room={room}
      viewerUserId={viewerUserId}
      joinMode={readRoomSession(room.roomId)?.mode ?? "play"}
      onRoomReconnected={onRoomReconnected}
      onLeft={onLeft}
    />
  );
}

/**
 * The capacity selector, inline: compact chips reading their values from
 * the games registry (`allowedPlayerCounts`) — nothing hardcoded. The
 * sizes a game does not support simply never appear. A second chip row
 * sets how many of those seats the server fills with platform bots; at
 * least one seat is always kept for a human (the creator), so the bot
 * count is clamped to `count - 1` at pick time.
 */
function TableSizePicker({
  allowedPlayerCounts,
  onPick,
  viewerSignedIn,
  onNeedSignIn,
}: {
  allowedPlayerCounts: readonly number[];
  onPick: (count: number, bots: number) => void;
  /** Anonymous visitors get the sign-in popup before anything else. */
  viewerSignedIn: boolean;
  onNeedSignIn: () => void;
}) {
  const counts = useMemo(
    () => [...allowedPlayerCounts].sort((a, b) => a - b),
    [allowedPlayerCounts],
  );
  const [bots, setBots] = useState(0);

  // Bots can never occupy every seat: keep one for the human creator.
  const maxBots = Math.max(1, Math.max(...counts) - 1);
  const botOptions = useMemo(
    () => Array.from({ length: maxBots + 1 }, (_, index) => index),
    [maxBots],
  );

  const handlePick = (count: number) => {
    if (!viewerSignedIn) {
      onNeedSignIn();
      return;
    }
    onPick(count, Math.min(bots, Math.max(0, count - 1)));
  };

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
        <span className="text-[11px] font-medium text-slate-500 dark:text-white/45">
          Adversaires IA
        </span>
        <div
          className="flex gap-1.5"
          role="radiogroup"
          aria-label="Nombre d’adversaires IA"
        >
          {botOptions.map((value) => {
            const active = value === bots;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBots(value)}
                className={`flex size-8 items-center justify-center rounded-lg text-xs font-semibold tabular-nums transition ${
                  active
                    ? "bg-violet-600 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/70 dark:hover:bg-white/[0.07]"
                }`}
              >
                {value}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex gap-2"
        role="radiogroup"
        aria-label="Nombre de joueurs"
      >
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => handlePick(count)}
            className="group flex h-14 w-14 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white text-center transition hover:border-cyan-500/50 hover:bg-cyan-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/[0.07]"
          >
            <HugeiconsIcon
              icon={UserGroupIcon}
              size={14}
              strokeWidth={1.8}
              className="text-slate-400 transition group-hover:text-cyan-600 dark:text-white/35 dark:group-hover:text-cyan-200"
            />
            <span className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700 group-hover:text-slate-950 dark:text-white/80 dark:group-hover:text-white">
              {count}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 dark:text-white/30">
        Capacités autorisées pour Ludo
      </p>
    </div>
  );
}
