import type { Metadata } from "next";
import Link from "next/link";

import { isGameLive } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import { LocalTetris } from "@/games/tetris/local/local-tetris";

export const metadata: Metadata = {
  title: "Tetris — partie locale | Game Arena",
};

export default function TetrisLocalPage() {
  // Même garde que le reste du catalogue : un jeu « coming-soon » n'est pas jouable.
  if (!isGameLive("tetris")) {
    return (
      <main className="relative min-h-screen bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
        <div className="relative z-20">
          <Navbar />
          <p className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500">
            Ce jeu n&apos;est pas encore disponible.{" "}
            <Link href="/games" className="underline">
              Retour au catalogue
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {/* La console affiche déjà « T E T R I S » ; ce titre sert aux lecteurs d'écran. */}
          <h1 className="sr-only">Tetris — partie locale</h1>
          <LocalTetris />
        </div>
      </div>
    </main>
  );
}
