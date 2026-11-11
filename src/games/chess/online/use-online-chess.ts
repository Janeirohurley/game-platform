"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Room } from "@colyseus/sdk";

import type { ChessColor, ChessMoveIntent, ChessPromotionPiece } from "../types";

/**
 * Client view of the authoritative Chess room.
 *
 * The room owns the position: `fen`, `history` and the result are read-only
 * mirrors. This hook only derives presentation data and forwards move
 * intents — it never validates a move as an authority.
 */

const PROMOTIONS = new Set<ChessPromotionPiece>(["q", "r", "b", "n"]);

export const CHESS_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface ChessRoomState {
  fen?: string;
  turnColor?: string;
  currentTurn?: string;
  turnSecondsLeft?: number;
  history?: string;
  lastFrom?: string;
  lastTo?: string;
  phase?: string;
  outcome?: string;
  outcomeReason?: string;
  winnerUserId?: string;
  players?: Map<string, { userId: string; name: string; color: string }>;
}

interface MoveAppliedMessage {
  userId?: string;
  from?: string;
  to?: string;
  promotion?: string;
}

export interface OnlineChessMoveEvent {
  move: ChessMoveIntent;
  userId: string;
  /** Monotonic counter so the view can react to identical moves twice. */
  nonce: number;
}

export type OnlineChessOutcome = "playing" | "win" | "draw";

export interface OnlineChess {
  fen: string;
  started: boolean;
  turnColor: ChessColor;
  currentTurn: string;
  viewerColor: ChessColor | null;
  canPlay: boolean;
  labels: Record<ChessColor, string>;
  history: string[];
  turnSecondsLeft: number;
  outcome: OnlineChessOutcome;
  outcomeReason: string;
  winnerUserId: string;
  winnerColor: ChessColor | null;
  lastMoveEvent: OnlineChessMoveEvent | null;
  /** Send a move intent. The room decides whether it happens. */
  sendMove: (move: ChessMoveIntent) => void;
}

const FALLBACK_LABELS: Record<ChessColor, string> = {
  w: "Blancs",
  b: "Noirs",
};

function snapshot(room: Room): ChessRoomState {
  return { ...(room.state as unknown as ChessRoomState) };
}

function promotionOf(value: unknown): ChessPromotionPiece | undefined {
  return typeof value === "string" &&
    PROMOTIONS.has(value as ChessPromotionPiece)
    ? (value as ChessPromotionPiece)
    : undefined;
}

/** Tagged with the room id so a reconnected scene never replays an old move. */
interface TaggedMoveEvent {
  roomId: string;
  event: OnlineChessMoveEvent;
}

export function useOnlineChess(
  room: Room,
  viewerUserId: string,
): OnlineChess {
  const revisionRef = useRef(0);
  const [taggedMove, setTaggedMove] = useState<TaggedMoveEvent | null>(null);

  // Colyseus mutates the schema in place: a revision counter plus
  // `useSyncExternalStore` is what tells React to re-read it.
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const sync = () => {
        revisionRef.current += 1;
        onStoreChange();
      };
      const unsubscribe = room.onStateChange(sync) as unknown as
        | (() => void)
        | { remove: () => void };
      const offMove = room.onMessage(
        "moveApplied",
        (message: MoveAppliedMessage) => {
          if (
            typeof message?.from !== "string" ||
            typeof message?.to !== "string"
          ) {
            return;
          }
          const from = message.from;
          const to = message.to;
          setTaggedMove((current) => {
            const nonce =
              current && current.roomId === room.roomId
                ? current.event.nonce + 1
                : 1;
            return {
              roomId: room.roomId,
              event: {
                move: {
                  from,
                  to,
                  promotion: promotionOf(message.promotion),
                },
                userId:
                  typeof message.userId === "string" ? message.userId : "",
                nonce,
              },
            };
          });
        },
      );

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
        else unsubscribe.remove();
        offMove();
      };
    },
    [room],
  );

  const getRevision = useCallback(() => revisionRef.current, []);
  useSyncExternalStore(subscribe, getRevision, getRevision);

  const raw = snapshot(room);
  const players = raw.players ? [...raw.players.values()] : [];
  const colorByUser: Record<string, ChessColor> = {};
  const labels = { ...FALLBACK_LABELS };

  for (const player of players) {
    if (player.color !== "w" && player.color !== "b") continue;
    colorByUser[player.userId] = player.color;
    labels[player.color] = player.name || FALLBACK_LABELS[player.color];
  }

  const viewerColor = colorByUser[viewerUserId] ?? null;
  const turnColor: ChessColor = raw.turnColor === "b" ? "b" : "w";
  const started =
    (raw.phase === "playing" || raw.phase === "finished") && Boolean(raw.fen);
  const outcome: OnlineChessOutcome =
    raw.outcome === "win" || raw.outcome === "draw" ? raw.outcome : "playing";

  const winnerUserId = raw.winnerUserId ?? "";
  const winnerColor = winnerUserId
    ? (colorByUser[winnerUserId] ?? null)
    : null;

  const canPlay =
    outcome === "playing" &&
    Boolean(viewerColor) &&
    raw.currentTurn === viewerUserId;

  const sendMove = useCallback(
    (move: ChessMoveIntent) => {
      room.send("move", {
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      });
    },
    [room],
  );

  return {
    fen: raw.fen ?? "",
    started,
    turnColor,
    currentTurn: raw.currentTurn ?? "",
    viewerColor,
    canPlay,
    labels,
    history: (raw.history ?? "").split(" ").filter(Boolean),
    turnSecondsLeft: raw.turnSecondsLeft ?? 0,
    outcome,
    outcomeReason: raw.outcomeReason ?? "",
    winnerUserId,
    winnerColor,
    lastMoveEvent:
      taggedMove && taggedMove.roomId === room.roomId
        ? taggedMove.event
        : null,
    sendMove,
  };
}
