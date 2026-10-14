"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { EMPTY_ROOM_VIEW, readTetrisRoom } from "./tetris-view";
import type {
  TetrisClientInput,
  TetrisPlayerView,
  TetrisRoomView,
} from "./types";

export interface OnlineTetris {
  room: TetrisRoomView;
  /** Le joueur local, s'il est assis à la table. */
  me: TetrisPlayerView | undefined;
  /** Vrai si le joueur local peut envoyer des commandes en ce moment. */
  canPlay: boolean;
  send: (input: TetrisClientInput) => void;
}

/**
 * Reflet d'une room Tetris faisant autorité.
 *
 * Le serveur possède la partie (gravité, légalité des coups, élimination) ;
 * ce hook n'affiche que ce qu'il publie et lui envoie des INTENTIONS
 * (`left`, `rotate`…). Aucune prédiction locale : le jeu reflète l'état
 * serveur.
 */
export function useOnlineTetris(
  room: Room,
  viewerUserId: string,
): OnlineTetris {
  const [view, setView] = useState<TetrisRoomView>(EMPTY_ROOM_VIEW);

  useEffect(() => {
    const read = () => setView(readTetrisRoom(room.state));
    read();
    // Selon la version du SDK, `onStateChange` renvoie une fonction de
    // désabonnement : on l'appelle si elle existe.
    const off: unknown = room.onStateChange(read);
    return () => {
      if (typeof off === "function") off();
    };
  }, [room]);

  const me = useMemo(
    () => view.players.find((p) => p.userId === viewerUserId),
    [view.players, viewerUserId],
  );

  const canPlay =
    view.phase === "playing" && me !== undefined && me.status === "playing";

  const send = useCallback(
    (input: TetrisClientInput) => {
      if (!canPlay) return;
      room.send("input", { input });
    },
    [room, canPlay],
  );

  return { room: view, me, canPlay, send };
}
