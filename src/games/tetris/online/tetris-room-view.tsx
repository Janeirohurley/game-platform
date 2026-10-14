"use client";

import { useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { ConsoleFit } from "../components/console/console-fit";
import { TetrisConsole } from "../components/console/tetris-console";
import { MiniBoard } from "./mini-board";
import { ordinal, rankPlayers, viewToGame } from "./tetris-view";
import { useConsoleInput } from "./use-console-input";
import { useOnlineTetris } from "./use-online-tetris";
import type { TetrisPlayerView } from "./types";

interface TetrisRoomViewProps {
  room: Room;
  viewerUserId: string;
  onLeave?: () => void;
}

/** `best` hors d'atteinte : la console n'affiche jamais « Max » en ligne. */
const NO_RECORD = Number.MAX_SAFE_INTEGER;

/**
 * Tetris en ligne : chacun joue SON plateau (même suite de pièces pour
 * tous), le dernier en vie gagne. La console du mode local affiche le
 * plateau du joueur ; les adversaires sont en miniature à côté.
 *
 * Un spectateur (ou un joueur qui n'est plus en vie) peut cliquer sur un
 * petit plateau pour le suivre en grand.
 */
export function TetrisRoomView({ room, viewerUserId }: TetrisRoomViewProps) {
  const { room: view, me, canPlay, send } = useOnlineTetris(room, viewerUserId);
  const { pressed, dropped, handleKey } = useConsoleInput(canPlay, send);

  const [followedId, setFollowedId] = useState<string | null>(null);

  // On ne peut suivre quelqu'un que si on ne joue pas soi-même.
  const iAmAlive = canPlay;
  const ranking = rankPlayers(view.players);
  const followed =
    (!iAmAlive && view.players.find((p) => p.userId === followedId)) ||
    (iAmAlive ? me : undefined) ||
    me ||
    ranking[0];

  const showEliminated =
    view.phase === "playing" && me !== undefined && me.status === "over";

  // L'élimination se remarque mieux avec une alerte vocale discrète.
  const announce = useRef("");
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const text = showEliminated ? `Éliminé, ${ordinal(me?.place ?? 0)} place.` : "";
    if (text !== announce.current) {
      announce.current = text;
      setAnnouncement(text);
    }
  }, [showEliminated, me?.place]);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden px-3 pt-16 pb-3 lg:flex-row lg:gap-8 lg:pt-3">
      <div className="relative">
        <ConsoleFit>
          <TetrisConsole
            game={viewToGame(followed)}
            paused={false}
            best={NO_RECORD}
            soundOn={false}
            pressed={pressed}
            dropped={dropped}
            onKey={handleKey}
          />
        </ConsoleFit>

        {showEliminated && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
            <p className="rounded-xl bg-black/75 px-5 py-3 text-center text-white shadow-lg backdrop-blur">
              <span className="block text-lg font-bold">Éliminé</span>
              <span className="block text-sm text-white/70">
                {ordinal(me?.place ?? 0)} place · tu peux suivre les autres
              </span>
            </p>
          </div>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {view.players.length > 1 && (
        <aside
          aria-label="Adversaires"
          className="flex max-h-[28vh] w-full max-w-full flex-row gap-3 overflow-x-auto overflow-y-hidden pb-1 lg:max-h-[90vh] lg:w-auto lg:max-w-[230px] lg:flex-row lg:flex-wrap lg:justify-center lg:overflow-y-auto lg:overflow-x-hidden"
        >
          {ranking.map((player) => (
            <OpponentCard
              key={player.userId}
              player={player}
              isMe={player.userId === viewerUserId}
              isFollowed={player.userId === followed?.userId}
              canFollow={!iAmAlive}
              onFollow={() => setFollowedId(player.userId)}
            />
          ))}
        </aside>
      )}

      {view.phase === "finished" && (
        <ResultOverlay
          ranking={ranking}
          winnerUserId={view.winnerUserId}
          viewerUserId={viewerUserId}
        />
      )}
    </div>
  );
}

function OpponentCard({
  player,
  isMe,
  isFollowed,
  canFollow,
  onFollow,
}: {
  player: TetrisPlayerView;
  isMe: boolean;
  isFollowed: boolean;
  canFollow: boolean;
  onFollow: () => void;
}) {
  const out = player.status === "over";
  const body = (
    <>
      <MiniBoard player={player} dimmed={out} />
      <span className="mt-1 block max-w-[72px] truncate text-[10px] font-semibold text-white/85">
        {isMe ? "Toi" : player.name}
      </span>
      <span className="block text-[10px] tabular-nums text-white/55">
        {out ? `${ordinal(player.place)}` : player.score}
      </span>
    </>
  );

  const className = `shrink-0 rounded-lg p-1.5 text-center ${
    isFollowed ? "bg-white/15 ring-1 ring-sky-300/60" : "bg-black/35"
  }`;

  return canFollow ? (
    <button
      type="button"
      onClick={onFollow}
      aria-pressed={isFollowed}
      className={`${className} transition hover:bg-white/15`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

function ResultOverlay({
  ranking,
  winnerUserId,
  viewerUserId,
}: {
  ranking: TetrisPlayerView[];
  winnerUserId: string;
  viewerUserId: string;
}) {
  const iWon = winnerUserId !== "" && winnerUserId === viewerUserId;
  const winner = ranking.find((p) => p.userId === winnerUserId);
  const title =
    winnerUserId === ""
      ? "Égalité"
      : iWon
        ? "Victoire !"
        : `${winner?.name ?? "Un joueur"} gagne`;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-white shadow-2xl">
        <h2 className="text-center text-2xl font-bold">{title}</h2>
        <ol className="mt-4 space-y-1.5">
          {ranking.map((player, index) => (
            <li
              key={player.userId}
              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-7 shrink-0 text-white/50 tabular-nums">
                  {ordinal(player.place || index + 1)}
                </span>
                <span className="truncate">
                  {player.userId === viewerUserId ? "Toi" : player.name}
                </span>
              </span>
              <span className="tabular-nums text-white/60">
                {player.score}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
