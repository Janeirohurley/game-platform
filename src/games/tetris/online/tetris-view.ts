import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  type Board,
  type Cell,
  type PieceType,
  type TetrisState,
} from "../engine";
import type { TetrisPlayerView, TetrisRoomView } from "./types";

const PIECES: readonly string[] = ["I", "J", "L", "O", "S", "T", "Z"];

function isPiece(value: string): value is PieceType {
  return PIECES.includes(value);
}

/** Décode la chaîne de 200 caractères du serveur ; une chaîne invalide donne un plateau vide. */
export function boardFromString(encoded: string): Board {
  const board: Board = [];
  const valid = encoded.length === BOARD_WIDTH * BOARD_HEIGHT;
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const digit = valid ? Number(encoded[y * BOARD_WIDTH + x]) : 0;
      row.push((digit >= 0 && digit <= 7 ? digit : 0) as Cell);
    }
    board.push(row);
  }
  return board;
}

/**
 * Convertit la vue du serveur en `TetrisState` pour réutiliser tel quel la
 * console et le dessin du plateau du mode local. Ce n'est qu'un AFFICHAGE :
 * rien ici n'est jamais renvoyé au serveur.
 *
 * `status` reste « playing » même pour un joueur éliminé : la console
 * afficherait « Appuie sur R », une consigne fausse en ligne. L'élimination
 * est signalée par la vue de la salle, par-dessus la console.
 */
export function viewToGame(view: TetrisPlayerView | undefined): TetrisState {
  const type: PieceType =
    view && isPiece(view.pieceType) ? view.pieceType : "T";
  const hasPiece = Boolean(view && isPiece(view.pieceType));
  const queue = (view?.next ?? "").split("").filter(isPiece);
  // La console ne lit que `queue[0]` ; on garantit qu'il existe.
  while (queue.length < 5) queue.push(queue[queue.length - 1] ?? "T");

  return {
    board: boardFromString(view?.board ?? ""),
    // Hors plateau tant qu'il n'y a pas de pièce (avant le départ).
    current: hasPiece
      ? {
          type,
          rotation: view?.pieceRotation ?? 0,
          x: view?.pieceX ?? 0,
          y: view?.pieceY ?? 0,
        }
      : { type, rotation: 0, x: 0, y: -10 },
    queue,
    rngState: 0,
    score: view?.score ?? 0,
    lines: view?.lines ?? 0,
    startLevel: 1,
    level: Math.min(6, Math.max(1, view?.level ?? 1)),
    status: "playing",
  };
}

interface RawPlayer {
  userId: string;
  name: string;
  sessionId: string;
  seat: number;
  connected: boolean;
  avatarUrl?: string;
  voiceMuted?: boolean;
  adminMuted?: boolean;
  board?: string;
  pieceType?: string;
  pieceRotation?: number;
  pieceX?: number;
  pieceY?: number;
  next?: string;
  score?: number;
  lines?: number;
  level?: number;
  status?: string;
  place?: number;
}

interface RawState {
  phase?: string;
  playersAlive?: number;
  winnerUserId?: string;
  players?: Map<string, RawPlayer>;
}

export const EMPTY_ROOM_VIEW: TetrisRoomView = {
  phase: "waiting",
  players: [],
  playersAlive: 0,
  winnerUserId: "",
};

/** Lit l'état synchronisé de la room (objets Colyseus) vers des objets simples. */
export function readTetrisRoom(state: unknown): TetrisRoomView {
  const raw = state as RawState | undefined;
  if (!raw?.players) return EMPTY_ROOM_VIEW;

  const players = [...raw.players.values()]
    .map(
      (p): TetrisPlayerView => ({
        userId: p.userId,
        name: p.name,
        sessionId: p.sessionId,
        seat: p.seat,
        connected: p.connected,
        avatarUrl: p.avatarUrl ?? "",
        voiceMuted: p.voiceMuted,
        adminMuted: p.adminMuted,
        board: p.board ?? "",
        pieceType: p.pieceType ?? "",
        pieceRotation: p.pieceRotation ?? 0,
        pieceX: p.pieceX ?? 0,
        pieceY: p.pieceY ?? 0,
        next: p.next ?? "",
        score: p.score ?? 0,
        lines: p.lines ?? 0,
        level: p.level ?? 1,
        status:
          p.status === "playing" || p.status === "over" ? p.status : "waiting",
        place: p.place ?? 0,
      }),
    )
    .sort((a, b) => a.seat - b.seat);

  return {
    phase: (raw.phase ?? "waiting") as TetrisRoomView["phase"],
    players,
    playersAlive: raw.playersAlive ?? 0,
    winnerUserId: raw.winnerUserId ?? "",
  };
}

/** Classement d'affichage : les vivants par score, puis les éliminés du mieux classé au moins bon. */
export function rankPlayers(players: TetrisPlayerView[]): TetrisPlayerView[] {
  return [...players].sort((a, b) => {
    const aAlive = a.place === 0;
    const bAlive = b.place === 0;
    if (aAlive !== bAlive) return aAlive ? -1 : 1;
    if (aAlive) return b.score - a.score;
    return a.place - b.place;
  });
}

export function ordinal(place: number): string {
  return place === 1 ? "1er" : `${place}e`;
}
