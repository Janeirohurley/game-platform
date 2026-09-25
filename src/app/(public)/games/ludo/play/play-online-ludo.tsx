"use client";

import { useCallback, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CrownIcon, Loading03Icon, Logout01Icon } from "@hugeicons/core-free-icons";

import { useRoom } from "@/lib/realtime";
import type { LobbySnapshot } from "@/lib/realtime/types";
import { LudoRoomView } from "@/games/ludo/online/ludo-room-view";

interface PlayOnlineLudoProps {
  gameId: string;
  minPlayers: number;
  maxPlayers: number;
  viewerUserId: string;
  viewerName: string;
}

/**
 * Online play flow for the Ludo entry page.
 *
 * Step 1 — the user picks a table size (no connection is opened yet).
 * Step 2 — `useRoom` connects, creates the room and mirrors the lobby.
 */
export function PlayOnlineLudo({
  gameId,
  minPlayers,
  maxPlayers,
  viewerUserId,
  viewerName,
}: PlayOnlineLudoProps) {
  const [targetPlayers, setTargetPlayers] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const enabled = targetPlayers !== null;

  const { snapshot, status, error, room, roomId, startGame, leave } = useRoom({
    gameId,
    targetPlayers: targetPlayers ?? maxPlayers,
    enabled,
  });

  const handlePick = useCallback((count: number) => {
    setTargetPlayers(count);
  }, []);

  const handleBack = useCallback(() => {
    leave();
    setTargetPlayers(null);
  }, [leave]);

  const inviteUrl = useMemo(() => {
    if (!roomId || typeof window === "undefined") return "";
    return `${window.location.origin}/games/${gameId}/join/${roomId}`;
  }, [gameId, roomId]);

  const handleCopyInvite = useCallback(() => {
    if (inviteUrl) void navigator.clipboard.writeText(inviteUrl);
  }, [inviteUrl]);

  const handleStart = useCallback(() => {
    setStarting(true);
    startGame();
    setTimeout(() => setStarting(false), 1500);
  }, [startGame]);

  if (!enabled) {
    return <TableSizePicker minPlayers={minPlayers} maxPlayers={maxPlayers} onPick={handlePick} />;
  }

  if (status === "error") {
    return (
      <FlowPanel>
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error ?? "Connexion impossible."}
        </p>

        <button
          type="button"
          onClick={handleBack}
          className="self-start text-sm underline underline-offset-4 text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white"
        >
          Choisir un autre nombre de joueurs
        </button>
      </FlowPanel>
    );
  }

  if (!snapshot || !roomId) {
    return (
      <FlowPanel>
        <p className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40" role="status">
          <HugeiconsIcon icon={Loading03Icon} size={16} strokeWidth={1.8} className="animate-spin" />
          Création de la table…
        </p>
      </FlowPanel>
    );
  }

  // Game started — hand the connection to the Ludo room view (board).
  // LudoRoomView mounts the board fullscreen by itself.
  if (room && (snapshot.phase === "playing" || snapshot.phase === "finished")) {
    return (
      <LudoRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={handleBack}
      />
    );
  }

  return (
    <WaitingLobby
      snapshot={snapshot}
      viewerUserId={viewerUserId}
      viewerName={viewerName}
      inviteUrl={inviteUrl}
      onCopyInvite={handleCopyInvite}
      onLeave={handleBack}
      onStart={handleStart}
      starting={starting}
    />
  );
}

function FlowPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      {children}
    </div>
  );
}

function TableSizePicker({
  minPlayers,
  maxPlayers,
  onPick,
}: {
  minPlayers: number;
  maxPlayers: number;
  onPick: (count: number) => void;
}) {
  const counts = Array.from(
    { length: maxPlayers - minPlayers + 1 },
    (_, index) => minPlayers + index,
  );

  return (
    <FlowPanel>
      <p className="text-sm font-medium">Combien de joueurs à la table ?</p>

      <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Nombre de joueurs">
        {counts.map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onPick(count)}
            className="group flex h-16 flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white/60 text-center transition hover:border-emerald-500/60 hover:bg-emerald-500/5 dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-lg font-semibold">{count}</span>
            <span className="text-[11px] text-slate-400 dark:text-white/35">
              {count === 1 ? "seul" : "joueurs"}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-400 dark:text-white/35">
        Tu pourras inviter les autres joueurs avec un lien une fois la table
        créée.
      </p>
    </FlowPanel>
  );
}

interface WaitingLobbyProps {
  snapshot: LobbySnapshot;
  viewerUserId: string;
  viewerName: string;
  inviteUrl: string;
  onCopyInvite: () => void;
  onLeave: () => void;
  onStart: () => void;
  starting: boolean;
}

function WaitingLobby({
  snapshot,
  viewerUserId,
  viewerName,
  inviteUrl,
  onCopyInvite,
  onLeave,
  onStart,
  starting,
}: WaitingLobbyProps) {
  const isHost = viewerUserId === snapshot.hostUserId;
  const canStart = isHost && snapshot.phase === "ready";
  const occupancy = `${snapshot.players.length} / ${snapshot.targetPlayers}`;

  return (
    <FlowPanel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            En attente de joueurs
          </span>

          <span className="text-sm text-slate-500 dark:text-white/50">
            {occupancy}
          </span>
        </div>

        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-500 dark:text-white/35 dark:hover:text-red-400"
        >
          <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.8} />
          Quitter
        </button>
      </div>

      {/* Seats */}
      <ul className="mt-5 flex flex-col gap-2" aria-label="Joueurs">
        {Array.from({ length: snapshot.targetPlayers }, (_, seat) => {
          const player = snapshot.players[seat];

          if (!player) {
            return (
              <li
                key={`empty-${seat}`}
                className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400 dark:border-white/10 dark:text-white/30"
              >
                <span className="size-2 rounded-full bg-slate-300 dark:bg-white/15" aria-hidden />
                En attente d&apos;un joueur…
              </li>
            );
          }

          const isViewer = player.userId === viewerUserId;

          return (
            <li
              key={player.userId}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5"
            >
              <span className="size-2 rounded-full bg-emerald-400" aria-hidden />

              <span className="font-medium">
                {player.name || "Joueur"}
                {isViewer && viewerName ? " (toi)" : ""}
              </span>

              {player.userId === snapshot.hostUserId && (
                <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-500">
                  <HugeiconsIcon icon={CrownIcon} size={13} strokeWidth={1.8} />
                  Hôte
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Invite */}
      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-white/35">
          Lien d&apos;invitation
        </p>

        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            aria-label="Lien d'invitation"
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/70 px-3 text-xs text-slate-500 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white/50"
          />

          <button
            type="button"
            onClick={onCopyInvite}
            className="h-10 shrink-0 rounded-lg border border-slate-200 px-4 text-xs font-semibold transition hover:bg-slate-950 hover:text-white dark:border-white/10 dark:hover:bg-white dark:hover:text-black"
          >
            Copier
          </button>
        </div>
      </div>

      {/* Start */}
      {canStart ? (
        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="mt-5 h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
        >
          {starting ? "Démarrage…" : "Lancer la partie"}
        </button>
      ) : (
        <p className="mt-5 text-center text-xs text-slate-400 dark:text-white/35" role="status">
          {snapshot.phase === "ready"
            ? "En attente du lancement par l'hôte…"
            : `La partie démarre quand les ${snapshot.targetPlayers} sièges sont remplis.`}
        </p>
      )}
    </FlowPanel>
  );
}
