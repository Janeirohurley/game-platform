"use client";

import type { ChessColor, ChessPromotionPiece } from "../types";
import { pieceGlyph, PROMOTION_CHOICES } from "./piece-glyphs";

interface PromotionDialogProps {
  color: ChessColor;
  onPick: (piece: ChessPromotionPiece) => void;
  onCancel: () => void;
}

/** Promotion cannot be guessed: the player must choose the new piece. */
export function PromotionDialog({
  color,
  onPick,
  onCancel,
}: PromotionDialogProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#080d15]/95 p-5 text-white shadow-2xl">
        <h2 className="text-sm font-semibold">Promotion du pion</h2>
        <p className="mt-1 text-xs text-white/45">
          Choisis la pièce qui remplace ton pion.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {PROMOTION_CHOICES.map((choice) => (
            <button
              key={choice.piece}
              type="button"
              onClick={() => onPick(choice.piece)}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:border-amber-300/50 hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <span
                className={`text-3xl leading-none ${
                  color === "w" ? "text-white" : "text-slate-300"
                }`}
              >
                {pieceGlyph(color, choice.piece)}
              </span>
              <span className="text-sm font-medium">{choice.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/5 hover:text-white/80"
        >
          Annuler le coup
        </button>
      </div>
    </div>
  );
}
