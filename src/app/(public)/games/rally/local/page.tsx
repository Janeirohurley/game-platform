import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import { RallyLocalClient } from "./rally-local-client";

export const metadata: Metadata = {
  title: "Rally — Jouer | Game Arena",
  description:
    "Tennis de table contre l'ordinateur : trois niveaux, coups puissants, premier à 11 points.",
};

/** Rally against the computer — no server, everything runs locally. */
export default function RallyLocalPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6">
          <nav
            aria-label="Fil d'Ariane"
            className="flex items-center gap-2 text-xs text-slate-400 dark:text-white/35"
          >
            <Link
              href="/games"
              className="flex items-center gap-1 transition-colors hover:text-slate-600 dark:hover:text-white/70"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.8} />
              Catalogue
            </Link>
            <span aria-hidden>/</span>
            <Link
              href="/games/rally"
              className="transition-colors hover:text-slate-600 dark:hover:text-white/70"
            >
              Rally
            </Link>
            <span aria-hidden>/</span>
            <span className="font-medium text-slate-600 dark:text-white/60">
              Partie
            </span>
          </nav>

          <div className="mt-8">
            <RallyLocalClient />
          </div>
        </section>
      </div>
    </main>
  );
}
