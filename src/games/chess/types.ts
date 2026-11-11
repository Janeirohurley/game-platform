/**
 * Shared contracts between the Three.js scene, the chess rules wrapper and
 * the React HUD. Kept free of Three.js and chess.js types so the UI never
 * depends on either implementation.
 */

export type ChessColor = "w" | "b";

export type ChessPromotionPiece = "q" | "r" | "b" | "n";

/**
 * `vs-bot-white` means the human takes White — the bot plays Black.
 * Naming the human side instead of the bot side avoids the classic
 * off-by-one when the bot has to move first.
 */
export type ChessMode = "hotseat" | "vs-bot-white" | "vs-bot-black";

export type ChessDrawReason =
  | "stalemate"
  | "fifty-move"
  | "threefold"
  | "insufficient-material"
  | "draw";

export type ChessEndReason = "checkmate" | ChessDrawReason;

export interface ChessMoveRecord {
  from: string;
  to: string;
  san: string;
  color: ChessColor;
  captured?: string;
  promotion?: string;
}

/** What the online scene sends to the room. The server decides. */
export interface ChessMoveIntent {
  from: string;
  to: string;
  promotion?: ChessPromotionPiece;
}

export interface ChessSnapshot {
  fen: string;
  turn: ChessColor;
  inCheck: boolean;
  isGameOver: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  endReason: ChessEndReason | null;
  winner: ChessColor | null;
  lastMove: ChessMoveRecord | null;
  history: ChessMoveRecord[];
  /** Pieces captured by each colour, as algebraic piece symbols (p/n/b/r/q). */
  capturedBy: Record<ChessColor, string[]>;
  isThinking: boolean;
}

export interface ChessSceneOptions {
  onProgress?: (progress: number) => void;
  onReady?: () => void;
  onSnapshot?: (snapshot: ChessSnapshot) => void;
  onPromotion?: (from: string, to: string) => void;
  /**
   * Online mode only: fired when the viewer commits a move (after the
   * promotion choice, if any). The scene never applies that move itself —
   * the room applies it and broadcasts `moveApplied`, which the view feeds
   * back through `applyRemoteMove`.
   */
  onMoveIntent?: (move: ChessMoveIntent) => void;
  onError?: (message: string) => void;
  /** Fired when the browser gives the WebGL context back after a loss. */
  onContextRestored?: () => void;
}
