import type { ChessColor, ChessPromotionPiece } from "../types";

const GLYPHS: Record<ChessColor, Record<string, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

export function pieceGlyph(color: ChessColor, type: string): string {
  return GLYPHS[color][type] ?? "?";
}

export const PROMOTION_CHOICES: {
  piece: ChessPromotionPiece;
  label: string;
  glyph: string;
}[] = [
  { piece: "q", label: "Dame", glyph: "♕" },
  { piece: "r", label: "Tour", glyph: "♖" },
  { piece: "b", label: "Fou", glyph: "♗" },
  { piece: "n", label: "Cavalier", glyph: "♘" },
];
