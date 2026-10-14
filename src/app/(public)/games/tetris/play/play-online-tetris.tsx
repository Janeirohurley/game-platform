"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import {
  createRoom,
  joinRoom,
  reconnectRoom,
  watchRoom,
} from "@/lib/realtime";
import {
  clearRoomSession,
  persistRoomSession,
  readRoomIdFromUrl,
  readRoomSession,
} from "@/lib/realtime/session-url";
import { AuthRequiredDialog, MatchScreen } from "@/components/realtime/match";
import { TetrisRoomView } from "@/games/tetris/online/tetris-room-view";

interface PlayOnlineTetrisProps {
  gameId: string;
  /** Tailles de table autorisées — lues dans le registre des jeux. */
  allowedPlayerCounts: readonly number[];
  viewerUserId: string;
}

/**
 * Parcours en ligne du Tetris : le créateur choisit le nombre de places
 * (2 à 10), puis arrive directement sur l'écran de partie. Un rafraîchissement
 * de la page restaure la table grâce à `?room=` et au jeton de reconnexion.
 */
export function PlayOnlineTetris({
  gameId,
  allowedPlayerCounts,
  viewerUserId,
}: PlayOnlineTetrisProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);

  // Restauration après rafraîchissement : l'identifiant de la room est dans l'URL.
  useEffect(() => {
    const roomId = readRoomIdFromUrl();
    if (!roomId) return;
    let cancelled = false;
    // L'identifiant de la room n'est lisible que dans le navigateur : on ne
    // peut pas en faire l'état initial sans désaccord entre le HTML serveur
    // et le client (hydratation). On l'active donc ici, une seule fois.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true);
    void (async () => {
      try {
        const session = readRoomSession(roomId);
        const mode = session?.mode ?? "watch";
        const restored = session
          ? await reconnectRoom(session.reconnectionToken).catch(() =>
              mode === "watch" ? watchRoom(roomId) : joinRoom(gameId, roomId, mode),
            )
          : await watchRoom(roomId);
        if (cancelled) {
          void restored.leave();
          return;
        }
        persistRoomSession(restored, mode);
        setRoom(restored);
      } catch {
        clearRoomSession(roomId);
        setError("Cette partie n'est plus disponible.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const create = (count: number) => {
    if (!viewerUserId) {
      setNeedAuth(true);
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const created = await createRoom(gameId, count);
        persistRoomSession(created, "play");
        setRoom(created);
      } catch (createError) {
        setError(
          createError instanceof Error
            ? createError.message
            : "Création de la table impossible.",
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const leave = () => {
    if (room) clearRoomSession(room.roomId);
    setRoom(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  if (room) {
    return (
      <MatchScreen
        room={room}
        gameId={gameId}
        viewerUserId={viewerUserId}
        joinMode={readRoomSession(room.roomId)?.mode ?? "play"}
        onRoomReconnected={setRoom}
        backHref="/games/tetris"
        backLabel="Retour à Tetris"
        onLeft={leave}
      >
        <TetrisRoomView room={room} viewerUserId={viewerUserId} onLeave={leave} />
      </MatchScreen>
    );
  }

  if (busy) {
    return (
      <p
        className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40"
        role="status"
      >
        <HugeiconsIcon
          icon={Loading03Icon}
          size={16}
          strokeWidth={1.8}
          className="animate-spin"
        />
        Connexion à la table…
      </p>
    );
  }

  const counts = [...allowedPlayerCounts].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Nombre de places"
      >
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => create(count)}
            className="group flex h-14 w-14 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white text-center transition hover:border-purple-500/50 hover:bg-purple-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-purple-300/40 dark:hover:bg-purple-300/[0.07]"
          >
            <HugeiconsIcon
              icon={UserGroupIcon}
              size={14}
              strokeWidth={1.8}
              className="text-slate-400 transition group-hover:text-purple-600 dark:text-white/35 dark:group-hover:text-purple-200"
            />
            <span className="mt-1 text-sm font-semibold tabular-nums text-slate-700 group-hover:text-slate-950 dark:text-white/80 dark:group-hover:text-white">
              {count}
            </span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 dark:text-white/30">
        Nombre de places à la table. Tu peux lancer la partie dès que
        2 joueurs sont assis.
      </p>

      <AuthRequiredDialog
        open={needAuth}
        onClose={() => setNeedAuth(false)}
        intent="create"
      />
    </div>
  );
}
