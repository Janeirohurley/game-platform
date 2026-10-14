import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  JoystickIcon,
  TimeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";

export const metadata: Metadata = {
  title: "Tetris | Game Arena",
  description:
    "Le Tetris classique — empile les pièces, complète des lignes et grimpe de niveau. Partie locale sans inscription, ou en ligne jusqu'à 10 joueurs.",
};

/**
 * Fiche d'entrée du Tetris : partie locale (solo, sans compte) et partie en
 * ligne (2 à 10 joueurs, le dernier en vie gagne). Le bouton « en ligne »
 * n'apparaît que si le registre déclare le jeu jouable en ligne.
 */
export default function TetrisPage() {
  const game = getGameBySlug("tetris");
  if (!game) return null;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-300">
                <HugeiconsIcon icon={TimeIcon} size={14} strokeWidth={1.8} />
                {game.category} · Parties de 5 à 15 min
              </p>

              <h1 className="mt-4 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                {game.title}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
                {game.description} Chaque ligne complète fait disparaître les
                blocs et te rapporte des points ; plus tu avances, plus les
                pièces tombent vite.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-white/40">
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.6} />
                  Solo{game.playableOnline ? " · 2 à 10 en ligne" : ""}
                </span>

                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={JoystickIcon} size={15} strokeWidth={1.6} />
                  Clavier ou boutons tactiles
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/games/tetris/local"
                  className="inline-flex min-h-12 items-center border border-purple-500 px-6 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 dark:text-purple-300"
                >
                  Jouer en local
                </Link>

                {game.playableOnline && (
                  <Link
                    href="/games/tetris/play"
                    className="inline-flex min-h-12 items-center bg-purple-600 px-6 text-sm font-medium text-white transition-colors hover:bg-purple-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                  >
                    Jouer en ligne
                  </Link>
                )}
              </div>
            </div>

            {/* Visuel : un aperçu de pile de pièces, purement décoratif. */}
            <div className="relative" aria-hidden="true">
              <div
                className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl border border-slate-200/70 bg-linear-to-br shadow-2xl dark:border-white/10 ${game.accent ?? ""}`}
              >
                <div className="grid grid-cols-6 gap-1">
                  {HERO_CELLS.map((color, index) => (
                    <div
                      key={index}
                      className={`size-8 sm:size-10 ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div
                className={`absolute -right-6 -top-6 -z-10 size-40 rounded-full blur-3xl ${game.glow ?? ""}`}
              />
            </div>
          </div>
        </section>

        {/* Comment jouer */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Comment jouer
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Déplace et tourne",
                body: "Flèches gauche et droite pour déplacer la pièce, flèche haut pour la tourner. Sur mobile, utilise les boutons sous le plateau.",
              },
              {
                step: "2",
                title: "Complète des lignes",
                body: "Une ligne pleine disparaît. Quatre lignes d'un coup rapportent 1 500 points — le meilleur coup du jeu.",
              },
              {
                step: "3",
                title: "Tiens la cadence",
                body: "Tous les 20 lignes, le niveau monte et les pièces tombent plus vite. La partie s'arrête quand la pile touche le haut.",
              },
            ].map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-slate-200/80 bg-white/75 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white dark:bg-white dark:text-black">
                  {item.step}
                </span>

                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/50">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <p className="mt-8 text-sm text-slate-400 dark:text-white/35">
            Envie d&apos;autre chose ?{" "}
            <Link
              href="/games"
              className="font-medium text-purple-600 underline-offset-4 hover:underline dark:text-purple-300"
            >
              Retour au catalogue
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

/** Mini-pile décorative : 6 colonnes x 4 lignes, `bg-white/10` = case vide. */
const HERO_CELLS = [
  "bg-white/10", "bg-white/10", "bg-violet-500", "bg-violet-500", "bg-violet-500", "bg-white/10",
  "bg-white/10", "bg-white/10", "bg-white/10", "bg-violet-500", "bg-white/10", "bg-white/10",
  "bg-cyan-500", "bg-cyan-500", "bg-white/10", "bg-emerald-500", "bg-emerald-500", "bg-white/10",
  "bg-cyan-500", "bg-amber-500", "bg-amber-500", "bg-amber-500", "bg-rose-500", "bg-rose-500",
];
