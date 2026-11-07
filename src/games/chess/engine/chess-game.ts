/**
 * Thin wrapper around `chess.js`. This is the *local* authority for rules:
 * exactly like the local Checkers and Ludo modes, the browser owns the game
 * because there is no server room. Online chess will later move the same
 * calls behind a Colyseus room and this file will become the client mirror.
 */

import {
  Chess,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";

import type {
  ChessColor,
  ChessEndReason,
  ChessMoveRecord,
  ChessPromotionPiece,
  ChessSnapshot,
} from "../types";

export interface ChessGameMove {
  from: string;
  to: string;
  promotion?: ChessPromotionPiece;
}

function toRecord(move: Move): ChessMoveRecord {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    color: move.color,
    captured: move.captured,
    promotion: move.promotion,
  };
}

export class ChessGame {
  private chess = new Chess();

  reset(): void {
    this.chess.reset();
  }

  /**
   * Adopts an external position (the server's FEN). Returns false instead of
   * throwing when the string is malformed, so a bad frame can never wipe the
   * local mirror.
   */
  load(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): ChessColor {
    return this.chess.turn();
  }

  isGameOver(): boolean {
    return this.chess.isGameOver();
  }

  isCheck(): boolean {
    return this.chess.isCheck();
  }

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isDraw(): boolean {
    return this.chess.isDraw();
  }

  pieceAt(square: string): { color: ChessColor; type: PieceSymbol } | null {
    const piece = this.chess.get(square as Square);
    return piece ? { color: piece.color, type: piece.type } : null;
  }

  /** Every occupied square of the board, for a full visual rebuild. */
  boardPieces(): { square: string; color: ChessColor; type: PieceSymbol }[] {
    const pieces: { square: string; color: ChessColor; type: PieceSymbol }[] = [];
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell) {
          pieces.push({
            square: cell.square,
            color: cell.color,
            type: cell.type,
          });
        }
      }
    }
    return pieces;
  }

  legalMovesFrom(square: string): Move[] {
    return this.chess.moves({ verbose: true, square: square as Square });
  }

  allLegalMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  /** A promotion is required when a legal pawn move lands on the last rank. */
  needsPromotion(from: string, to: string): boolean {
    return this.legalMovesFrom(from).some(
      (move) => move.to === to && Boolean(move.promotion),
    );
  }

  /** Applies a move. Returns `null` instead of throwing on illegal input. */
  move(move: ChessGameMove): Move | null {
    try {
      return this.chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      });
    } catch {
      return null;
    }
  }

  /**
   * Parses a Stockfish/UCI move (`e2e4`, `e7e8q`) and validates it against
   * the current position, so a misbehaving engine can never corrupt the board.
   */
  moveFromUci(uci: string): ChessGameMove | null {
    const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(uci.trim());
    if (!match) return null;

    const [, from, to, promotion] = match;
    const legal = this.legalMovesFrom(from).some(
      (move) => move.to === to && (promotion ? move.promotion === promotion : true),
    );
    if (!legal) return null;

    return {
      from,
      to,
      promotion: promotion?.toLowerCase() as ChessPromotionPiece | undefined,
    };
  }

  /** Deterministic fallback when the engine cannot be reached. */
  randomMove(): ChessGameMove | null {
    const moves = this.allLegalMoves();
    if (moves.length === 0) return null;
    const move = moves[Math.floor(Math.random() * moves.length)];
    return {
      from: move.from,
      to: move.to,
      promotion: move.promotion as ChessPromotionPiece | undefined,
    };
  }

  history(): ChessMoveRecord[] {
    return this.chess.history({ verbose: true }).map(toRecord);
  }

  lastMove(): ChessMoveRecord | null {
    const history = this.history();
    return history.length > 0 ? history[history.length - 1] : null;
  }

  endReason(): ChessEndReason | null {
    if (this.chess.isCheckmate()) return "checkmate";
    if (this.chess.isStalemate()) return "stalemate";
    if (this.chess.isInsufficientMaterial()) return "insufficient-material";
    if (this.chess.isThreefoldRepetition()) return "threefold";
    if (this.chess.isDrawByFiftyMoves()) return "fifty-move";
    if (this.chess.isDraw()) return "draw";
    return null;
  }

  winner(): ChessColor | null {
    if (!this.chess.isCheckmate()) return null;
    return this.chess.turn() === "w" ? "b" : "w";
  }

  capturedBy(): Record<ChessColor, string[]> {
    const captured: Record<ChessColor, string[]> = { w: [], b: [] };
    for (const move of this.chess.history({ verbose: true })) {
      if (move.captured) captured[move.color as Color].push(move.captured);
    }
    return captured;
  }

  snapshot(isThinking = false): ChessSnapshot {
    const endReason = this.endReason();
    return {
      fen: this.fen(),
      turn: this.turn(),
      inCheck: this.isCheck(),
      isGameOver: this.isGameOver(),
      isCheckmate: this.isCheckmate(),
      isDraw: this.isDraw(),
      endReason,
      winner: this.winner(),
      lastMove: this.lastMove(),
      history: this.history(),
      capturedBy: this.capturedBy(),
      isThinking,
    };
  }
}
