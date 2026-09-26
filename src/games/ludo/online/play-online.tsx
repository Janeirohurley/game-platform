"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";

import { GameLobby } from "@/components/realtime/lobby";
import { resolveRealtimeUrl, useRoom } from "@/lib/realtime";

const GAME_ID = "ludo";

/** The realtime URL never changes while the page is open. */
const NO_SUBSCRIPTION = () => () => {};
/** Nothing to show while rendering on the server. */
const SERVER_SNAPSHOT = () => "";

/**
 * Ludo "play online" entry: pick how many players will sit at the table,
 * then hand over to the connection + lobby flow.
 */
export function PlayOnline({ viewerUserId }: { viewerUserId: string }) {
  const router = useRouter();
  const [requestedPlayers, setRequestedPlayers] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  /*
   * The realtime URL depends on the page's own address, which the
   * server render cannot know. `useSyncExternalStore` is the way to
   * read a client-only value: it hands the server an empty snapshot and
   * the browser the real one, with no state written from an effect and
   * no hydration mismatch. The value never changes, so the subscribe
   * callback has nothing to do.
   */
  const realtimeUrl = useSyncExternalStore(
    NO_SUBSCRIPTION,
    resolveRealtimeUrl,
    SERVER_SNAPSHOT,
  );

  if (requestedPlayers === null) {
    return (
      <section
        aria-label="Nouvelle partie en ligne"
        className="mx-auto flex w-full max-w-md flex-col gap-6"
      >
        <header>
          <h1 className="text-2xl font-bold text-neutral-100">
            Ludo — partie en ligne
          </h1>
          <p className="text-sm text-neutral-400">
            Choisis combien de joueurs participeront. Tu pourras inviter les
            autres avec un lien.
          </p>
        </header>

        <div
          className="flex flex-col gap-2"
          role="radiogroup"
          aria-label="Nombre de joueurs"
        >
          {[2, 3, 4].map((count) => (
            <button
              key={count}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => setRequestedPlayers(count)}
              className="flex items-center justify-between rounded-lg border border-neutral-700 px-4 py-3 text-left transition-colors hover:border-emerald-500/60 hover:bg-neutral-800"
            >
              <span className="text-sm font-semibold text-neutral-100">
                {count} joueurs
              </span>
              <span className="text-xs text-neutral-500">
                toi + {count - 1} invités
              </span>
            </button>
          ))}
        </div>

        {realtimeUrl && (
          <p className="text-xs text-neutral-500">
            Serveur temps réel : {realtimeUrl}
          </p>
        )}
      </section>
    );
  }

  // Once a table size is picked, the connected flow takes over.
  return (
    <ConnectedLobby
      viewerUserId={viewerUserId}
      targetPlayers={requestedPlayers}
      onBack={() => {
        setRequestedPlayers(null);
        router.refresh();
      }}
    />
  );
}

interface ConnectedLobbyProps {
  viewerUserId: string;
  targetPlayers: number;
  onBack: () => void;
}

function ConnectedLobby({
  viewerUserId,
  targetPlayers,
  onBack,
}: ConnectedLobbyProps) {
  const [starting, setStarting] = useState(false);

  const { snapshot, status, error, roomId, startGame, leave } = useRoom({
    gameId: GAME_ID,
    targetPlayers,
  });

  const inviteUrl = useMemo(() => {
    if (!roomId || typeof window === "undefined") return "";
    return `${window.location.origin}/games/${GAME_ID}/join/${roomId}`;
  }, [roomId]);

  const handleCopyInvite = useCallback(() => {
    if (!inviteUrl) return;
    void navigator.clipboard.writeText(inviteUrl);
  }, [inviteUrl]);

  const handleLeave = useCallback(() => {
    leave();
    onBack();
  }, [leave, onBack]);

  const handleStart = useCallback(() => {
    setStarting(true);
    startGame();
    setTimeout(() => setStarting(false), 1500);
  }, [startGame]);

  if (status === "error") {
    return (
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Connexion impossible."}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-800"
        >
          Retour
        </button>
      </section>
    );
  }

  if (!snapshot || !roomId) {
    return (
      <p className="mx-auto text-sm text-neutral-400" role="status">
        Connexion à la room…
      </p>
    );
  }

  return (
    <GameLobby
      snapshot={snapshot}
      viewerUserId={viewerUserId}
      inviteUrl={inviteUrl}
      onCopyInvite={handleCopyInvite}
      onLeave={handleLeave}
      onStart={handleStart}
      starting={starting}
    />
  );
}
