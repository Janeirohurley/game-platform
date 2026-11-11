"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Chess01Icon,
  ChessKingIcon,
  ChessPawnIcon,
  Robot01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import type { ChessMode } from "../types";

interface ChessMenuProps {
  onStart: (mode: ChessMode) => void;
}

const MODES: {
  mode: ChessMode;
  title: string;
  body: string;
  icon: typeof ChessKingIcon;
  accent: string;
}[] = [
  {
    mode: "hotseat",
    title: "Deux joueurs",
    body: "À tour de rôle sur le même écran. Les Blancs commencent.",
    icon: UserGroupIcon,
    accent: "bg-slate-950 text-white dark:bg-white dark:text-black",
  },
  {
    mode: "vs-bot-white",
    title: "Je joue les Blancs",
    body: "Stockfish répond avec les Noirs, environ une seconde par coup.",
    icon: ChessKingIcon,
    accent: "bg-emerald-600 text-white",
  },
  {
    mode: "vs-bot-black",
    title: "Je joue les Noirs",
    body: "L'IA ouvre la partie avec les Blancs. À toi de répondre.",
    icon: ChessPawnIcon,
    accent: "bg-slate-800 text-white",
  },
];

/**
 * Full-surface mode picker. It intentionally covers the board: the first
 * decision is the opponent, not the first move.
 */
export function ChessMenu({ onStart }: ChessMenuProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#080d15]/95 p-6 text-white shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-amber-300">
            <HugeiconsIcon icon={Chess01Icon} size={22} strokeWidth={1.7} />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Nouvelle partie
            </h2>
            <p className="text-xs text-white/45">
              Choisis ton camp. Les Blancs commencent toujours.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          {MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => onStart(item.mode)}
              className="group flex w-full items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${item.accent}`}
              >
                <HugeiconsIcon
                  icon={item.mode === "hotseat" ? item.icon : Robot01Icon}
                  size={18}
                  strokeWidth={1.8}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/45">
                  {item.body}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-[11px] leading-5 text-white/30">
          Règles validées par chess.js · moteur Stockfish exécuté dans le
          navigateur · aucun serveur requis.
        </p>
      </div>
    </div>
  );
}
