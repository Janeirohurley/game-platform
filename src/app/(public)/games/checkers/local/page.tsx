import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import { LocalCheckers } from "@/games/checkers/local/local-checkers";

export const metadata: Metadata = {
  title: "Checkers — Mode local | Game Arena",
  description:
    "Joue aux dames à deux sur le même écran, chacun son tour. Aucun serveur nécessaire.",
};

/** Local two-player Checkers: both players share this screen. */
export default function CheckersLocalPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto w-full max-w-7xl px-4 pb-20 pt-8 sm:px-6">
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
              href="/games/checkers"
              className="transition-colors hover:text-slate-600 dark:hover:text-white/70"
            >
              Checkers
            </Link>

            <span aria-hidden>/</span>

            <span className="font-medium text-slate-600 dark:text-white/60">
              Local
            </span>
          </nav>

          <div className="mt-8">
            <h1 className="font-(family-name:--font-playwrite) text-4xl font-normal leading-[0.95] tracking-tight sm:text-5xl">
              Partie locale
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 dark:text-white/50">
              Deux joueurs, un seul écran. Les blancs commencent. La prise est
              obligatoire, et la rafle la plus longue s&apos;impose.
            </p>
          </div>

          <div className="mt-10 flex justify-center">
            <LocalCheckers />
          </div>
        </section>
      </div>
    </main>
  );
}
