"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FlashIcon,
  Loading03Icon,
  PlusSignIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import {
  createRoom,
  fetchRealtimeToken,
  getRealtimeClient,
  joinRoom,
  reconnectRoom,
  useMatchList,
  waitForRoomReady,
  watchRoom,
} from "@/lib/realtime";
import {
  clearRoomSession,
  persistRoomSession,
  readRoomIdFromUrl,
  readRoomSession,
} from "@/lib/realtime/session-url";
import {
  freeSeats,
  rankQuickPlayCandidates,
} from "@/lib/realtime/quick-play";

import { AuthRequiredDialog } from "./auth-required-dialog";
import { MatchList } from "./match-list";
import { RoomClosedNotice } from "./room-closed-notice";

/**
 * The online entry point of EVERY game — one implementation.
 *
 * It replaces four hand-written variants (Ludo 458 lines, Tetris 199,
 * Checkers 126, Rally 113) that had drifted apart badly: only Ludo
 * listed the open tables, only Ludo offered bots, two games never showed
 * the sign-in dialog and three never told you the room had closed. Worse,
 * Checkers and Rally called `createRoom` on mount, and `createRoom` maps
 * to Colyseus' `client.create()` — ALWAYS a new room. Two players opening
 * the same page at the same moment each got their own table and waited
 * for each other forever; the only way to meet was to trade a link.
 *
 * Everything here is driven by the games registry (`allowedPlayerCounts`,
 * `supportsBots`); nothing is game-specific. The board itself stays with
 * the game, injected through `renderRoom`, because that is the one part
 * that genuinely differs.
 */

/** What a game needs to render its own board once a room is joined. */
export interface PlayOnlineRoomRenderArgs {
  room: Room;
  viewerUserId: string;
  /** Seat or stand: how this viewer entered (restored from the session). */
  joinMode: "play" | "watch";
  /** The realtime layer handed us a NEW Room object after reconnecting. */
  onRoomReconnected: (room: Room) => void;
  /** A confirmed leave — the double-confirmation lives in the match screen. */
  onLeft: () => void;
}

export interface PlayOnlineProps {
  gameId: string;
  viewerUserId: string;
  /**
   * Table sizes this game accepts, from the registry. The server holds
   * the same list and is the authority; offering a size it refuses would
   * only fail at creation, so these two must agree.
   */
  allowedPlayerCounts: readonly number[];
  /**
   * Whether the server can seat platform bots for this game.
   *
   * Ludo only, today: `attachBrain` is overridden in `LudoRoom` and
   * nowhere else, so bots seated in another game would occupy a seat and
   * never play — they would freeze the table instead of filling it.
   */
  supportsBots?: boolean;
  /** Where "retour" leads when the room closes under the viewer. */
  backHref: string;
  backLabel: string;
  renderRoom: (args: PlayOnlineRoomRenderArgs) => ReactNode;
}

type PendingJoin = { roomId: string; mode: "play" | "watch" };

/**
 * Detects the platform's "no session" answer from a token fetch — the
 * cue to open the sign-in popup instead of a bare error banner.
 */
function isAuthRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Connecte-toi");
}

export function PlayOnline({
  gameId,
  viewerUserId,
  allowedPlayerCounts,
  supportsBots = false,
  backHref,
  backLabel,
  renderRoom,
}: PlayOnlineProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [pendingJoin, setPendingJoin] = useState<PendingJoin | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  /** Bot-seating progress while a freshly created table is prepared. */
  const [seating, setSeating] = useState<{
    requested: number;
    seated: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authIntent, setAuthIntent] = useState<"create" | "join" | null>(null);

  const matchList = useMatchList(gameId);

  const counts = useMemo(
    () => [...allowedPlayerCounts].sort((a, b) => a - b),
    [allowedPlayerCounts],
  );
  /** Quick play opens the SMALLEST table: the fastest one to fill. */
  const smallestTable = counts[0] ?? 2;

  // ------------------------------------------------------------------
  // Refresh survival: the URL carries the room id, sessionStorage the
  // reconnection token. On mount, restore instead of bouncing the viewer
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
          : // Guest or shared link without a stored session: watch.
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
    // Mount only: re-running this would fight the live room state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // Joining an existing table.
  // ------------------------------------------------------------------
  const joinExisting = useCallback(
    async (join: PendingJoin): Promise<Room> => {
      // Watching works without an account (guest token); playing needs
      // one — the server must know who it seats.
      const joined =
        join.mode === "watch"
          ? await watchRoom(join.roomId)
          : await getRealtimeClient().joinById(join.roomId, {
              token: await fetchRealtimeToken(),
              mode: "play",
            });
      persistRoomSession(joined, join.mode);
      return joined;
    },
    [],
  );

  const handleJoin = useCallback(
    (join: PendingJoin) => {
      setError(null);
      setPendingJoin(join);
      void (async () => {
        try {
          setRoom(await joinExisting(join));
        } catch (joinError) {
          if (isAuthRequiredError(joinError)) {
            setAuthIntent("join");
            setPendingJoin(null);
            return;
          }
          setError(
            joinError instanceof Error
              ? joinError.message
              : "Impossible de rejoindre cette partie.",
          );
        } finally {
          if (join.mode === "watch") setPendingJoin(null);
        }
      })();
    },
    [joinExisting],
  );

  // ------------------------------------------------------------------
  // Creating a table.
  // ------------------------------------------------------------------
  const openTable = useCallback(
    async (count: number, botCount: number): Promise<Room> => {
      // At least one human seat always stays: the creator's own.
      const seatedBots = Math.min(Math.max(0, botCount), Math.max(0, count - 1));
      const joined = await createRoom(gameId, count, seatedBots);
      persistRoomSession(joined, "play");
      // Don't drop the creator onto an empty board: hold the
      // "préparation" screen until the server has seated the bots, with
      // a bounded wait so a slow pool never blocks entry.
      if (seatedBots > 0) {
        setSeating({ requested: seatedBots, seated: 0 });
        try {
          await waitForRoomReady(joined, (payload) =>
            setSeating({
              requested: payload?.requested ?? seatedBots,
              seated: payload?.seated ?? 0,
            }),
          );
        } finally {
          setSeating(null);
        }
      } else {
        // Same reason, without bots: wait for the lobby to exist server
        // side before rendering a board that has no state yet.
        await waitForRoomReady(joined);
      }
      return joined;
    },
    [gameId],
  );

  const startCreation = useCallback(
    (count: number, botCount: number) => {
      if (viewerUserId === "") {
        setAuthIntent("create");
        return;
      }
      setError(null);
      setCreating(true);
      void (async () => {
        try {
          setRoom(await openTable(count, botCount));
        } catch (createError) {
          setSeating(null);
          if (isAuthRequiredError(createError)) {
            setAuthIntent("create");
            return;
          }
          setError(
            createError instanceof Error
              ? createError.message
              : "Création de la table impossible.",
          );
        } finally {
          setCreating(false);
        }
      })();
    },
    [openTable, viewerUserId],
  );

  // ------------------------------------------------------------------
  // Quick play — the one gesture this platform was missing.
  //
  // Deliberately NOT Colyseus' `joinOrCreate`. That call picks any
  // unlocked room of the type, including one already PLAYING, and this
  // server refuses a player there (`ServerError 4010`) from inside
  // `onJoin` — the SDK surfaces the error instead of trying the next
  // room, so quick play would fail exactly when tables exist. Choosing
  // here, from the live listing we already poll, keeps the decision
  // where the phase and the seat count are visible.
  //
  // The listing is a snapshot up to 5s old, so the chosen table may be
  // gone by the time we dial it: falling back to opening our own is part
  // of the normal path, not error handling.
  // ------------------------------------------------------------------
  const quickPlay = useCallback(() => {
    if (viewerUserId === "") {
      setAuthIntent("join");
      return;
    }
    setError(null);

    const candidates = rankQuickPlayCandidates(matchList.rooms);

    setPendingJoin(
      candidates[0] ? { roomId: candidates[0].roomId, mode: "play" } : null,
    );
    setCreating(candidates.length === 0);

    void (async () => {
      try {
        for (const candidate of candidates) {
          try {
            setRoom(
              await joinExisting({ roomId: candidate.roomId, mode: "play" }),
            );
            return;
          } catch (joinError) {
            // No account: stop here, the popup is the answer.
            if (isAuthRequiredError(joinError)) {
              setAuthIntent("join");
              return;
            }
            // Table filled up or vanished between two polls: next one.
          }
        }
        setPendingJoin(null);
        setCreating(true);
        setRoom(await openTable(smallestTable, 0));
      } catch (quickError) {
        if (isAuthRequiredError(quickError)) {
          setAuthIntent("join");
          return;
        }
        setError(
          quickError instanceof Error
            ? quickError.message
            : "Aucune partie disponible et la création a échoué.",
        );
      } finally {
        setPendingJoin(null);
        setCreating(false);
      }
    })();
  }, [joinExisting, matchList.rooms, openTable, smallestTable, viewerUserId]);

  // ------------------------------------------------------------------
  // Render.
  // ------------------------------------------------------------------
  const leaveRoom = useCallback(() => {
    if (room) clearRoomSession(room.roomId);
    setRoom(null);
    setPendingJoin(null);
    setCreating(false);
    matchList.refresh();
  }, [matchList, room]);

  if (room) {
    return (
      <ConnectedMatch
        room={room}
        backHref={backHref}
        backLabel={backLabel}
        onLeft={leaveRoom}
      >
        {renderRoom({
          room,
          viewerUserId,
          joinMode: readRoomSession(room.roomId)?.mode ?? "play",
          onRoomReconnected: setRoom,
          onLeft: leaveRoom,
        })}
      </ConnectedMatch>
    );
  }

  if (restoring || pendingJoin || creating) {
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
          {restoring
            ? "Reprise de ta partie…"
            : pendingJoin
              ? "Connexion à la partie…"
              : seating
                ? "Préparation de la partie…"
                : "Ouverture de ta table…"}
        </p>
        {seating && (
          <p className="text-xs text-slate-400 dark:text-white/35">
            Installation des adversaires IA ({seating.seated}/
            {seating.requested})…
          </p>
        )}
      </div>
    );
  }

  const openTables = matchList.rooms.filter(
    (listing) => freeSeats(listing) !== null,
  ).length;

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/25 dark:bg-red-400/[0.08] dark:text-red-300"
        >
          {error}
        </p>
      )}

      <QuickPlayBar
        openTables={openTables}
        loading={matchList.loading}
        onQuickPlay={quickPlay}
      />

      <MatchList
        rooms={matchList.rooms}
        loading={matchList.loading}
        error={matchList.error}
        onJoinAsPlayer={(roomId) => handleJoin({ roomId, mode: "play" })}
        onWatch={(roomId) => handleJoin({ roomId, mode: "watch" })}
      />

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
              depuis le plateau.
              {supportsBots
                ? " Ajoute des adversaires IA pour lancer tout de suite ;"
                : " "}
              {supportsBots ? " les" : "Les"} spectateurs ne comptent pas dans
              la capacité.
            </p>
          </div>

          <TableSizePicker
            counts={counts}
            supportsBots={supportsBots}
            onPick={startCreation}
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

/**
 * Owns the "room closed under the viewer" case. Closing the tab or
 * navigating away only DROPS the connection — the server holds the seat
 * through its grace window — so this is about a room the host actually
 * ended.
 */
function ConnectedMatch({
  room,
  backHref,
  backLabel,
  onLeft,
  children,
}: {
  room: Room;
  backHref: string;
  backLabel: string;
  onLeft: () => void;
  children: ReactNode;
}) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    const unsubscribe = room.onMessage("roomClosed", () => setClosed(true));
    return unsubscribe;
  }, [room]);

  if (closed) {
    return (
      <RoomClosedNotice
        backHref={backHref}
        backLabel={backLabel}
        onBack={() => {
          clearRoomSession(room.roomId);
          onLeft();
        }}
      />
    );
  }

  return <>{children}</>;
}

/**
 * The headline action: one click lands the player at a table.
 *
 * It states how many tables are open rather than promising an instant
 * match, because joining someone else's table sends a request the host
 * must accept — the platform's own rule, enforced server-side in
 * `enqueueJoinRequest`. Saying "partie immédiate" would be a lie the
 * waiting screen would then have to walk back.
 */
function QuickPlayBar({
  openTables,
  loading,
  onQuickPlay,
}: {
  openTables: number;
  loading: boolean;
  onQuickPlay: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-emerald-600/20 bg-emerald-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-400/15 dark:bg-emerald-400/[0.04]">
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <HugeiconsIcon
            icon={FlashIcon}
            size={15}
            strokeWidth={2}
            className="text-emerald-600 dark:text-emerald-300"
          />
          Partie rapide
        </h3>
        <p className="mt-1.5 max-w-md text-xs leading-5 text-slate-600 dark:text-white/45">
          {loading
            ? "Recherche des tables ouvertes…"
            : openTables > 0
              ? `${openTables} table${openTables > 1 ? "s" : ""} ouverte${openTables > 1 ? "s" : ""} — on te place à la plus remplie. L'hôte doit accepter ta demande.`
              : "Aucune table ouverte pour l'instant : on t'en ouvre une et les autres joueurs pourront te rejoindre."}
        </p>
      </div>

      <button
        type="button"
        onClick={onQuickPlay}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        <HugeiconsIcon icon={FlashIcon} size={16} strokeWidth={2} />
        Jouer maintenant
      </button>
    </div>
  );
}

/**
 * Capacity selector: compact chips reading their values from the games
 * registry — nothing hardcoded, so a size a game does not support simply
 * never appears. The bot row shows only where the server has a brain for
 * the game; at least one seat is always kept for the human creator.
 */
function TableSizePicker({
  counts,
  supportsBots,
  onPick,
}: {
  counts: readonly number[];
  supportsBots: boolean;
  onPick: (count: number, bots: number) => void;
}) {
  const [bots, setBots] = useState(0);

  const maxBots = Math.max(1, Math.max(...counts) - 1);
  const botOptions = useMemo(
    () => Array.from({ length: maxBots + 1 }, (_, index) => index),
    [maxBots],
  );

  // A single allowed size is not a choice: label the button instead of
  // showing a one-option "picker" that looks broken (Checkers and Rally
  // are two-seat games — their old settings dialog had exactly this
  // problem, one chip already active).
  const single = counts.length === 1;

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      {supportsBots && (
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
      )}

      {single ? (
        <button
          type="button"
          onClick={() => onPick(counts[0], Math.min(bots, counts[0] - 1))}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
        >
          <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.8} />
          Ouvrir une table de {counts[0]}
        </button>
      ) : (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Nombre de joueurs"
          >
            {counts.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onPick(count, Math.min(bots, count - 1))}
                className="group flex size-14 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white text-center transition hover:border-cyan-500/50 hover:bg-cyan-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/[0.07]"
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
            Nombre de places à la table
          </p>
        </>
      )}
    </div>
  );
}
