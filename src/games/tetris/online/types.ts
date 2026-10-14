import type { LobbyPlayerView, RoomPhase } from "@/lib/realtime/types";

/**
 * Vue côté client de l'état Tetris synchronisé par le serveur.
 * Miroir de `server-games/src/games/tetris/tetris-state.ts` (deux dépôts,
 * donc deux copies à garder alignées).
 */
export interface TetrisPlayerView extends LobbyPlayerView {
  /** 200 caractères « 0 »..« 7 », ligne du haut en premier ; vide avant le départ. */
  board: string;
  /** « I J L O S T Z » ; vide avant le départ. */
  pieceType: string;
  pieceRotation: number;
  pieceX: number;
  pieceY: number;
  /** Prochaines pièces, ex. « TLJ ». */
  next: string;
  score: number;
  lines: number;
  level: number;
  /** « waiting » avant le départ, « playing », puis « over » une fois éliminé. */
  status: "waiting" | "playing" | "over";
  /** 0 tant qu'il joue, puis son classement final (1 = vainqueur). */
  place: number;
}

export interface TetrisRoomView {
  phase: RoomPhase;
  /** Triés par siège. */
  players: TetrisPlayerView[];
  playersAlive: number;
  /** Vide tant que le match court, ou en cas d'égalité. */
  winnerUserId: string;
}

/** Les seules intentions que le serveur accepte d'un client. */
export type TetrisClientInput =
  | "left"
  | "right"
  | "rotate"
  | "softDrop"
  | "hardDrop";
