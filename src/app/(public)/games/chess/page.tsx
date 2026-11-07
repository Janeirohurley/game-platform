import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Chess01Icon,
  JoystickIcon,
  Robot01Icon,
  TimeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "Chess | Game Arena",
  description:
    "Échecs 3D sur Game Arena : deux joueurs sur un écran, contre Stockfish ou en ligne, avec toutes les règles.",
};

const START_BOARD: (string | null)[][] = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
];

const RULES = [
  {
    step: "1",
    title: "Mater le roi",
    body: "Le but est d'attaquer le roi adverse sans qu'aucun coup ne puisse le sauver. Échec et mat, la partie s'arrête.",
  },
  {
    step: "2",
    title: "Roque et promotion",
    body: "Le roi peut roquer avec une tour, et un pion qui atteint la dernière rangée devient dame, tour, fou ou cavalier.",
  },
  {
    step: "3",
    title: "Une vraie scène 3D",
    body: "Plateau et pièces rendus en 3D, caméra libre et animations. Stockfish calcule les réponses de l'IA dans le navigateur.",
  },
];

/** Catalog entry page for Chess: local (hotseat/Stockfish) and online rooms. */
export default function ChessPage() {
  const game = getGameBySlug("chess");
  if (!game) return null;

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-184 bg-[radial-gradient(ellipse_60%_60%_at_70%_20%,rgba(251,191,36,.15),transparent_70%)]"
      />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">
                <HugeiconsIcon icon={TimeIcon} size={14} strokeWidth={1.8} />
                {game.category} · 10–60 min par partie
              </p>

              <h1 className="mt-4 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                {game.title}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
                {game.description}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-white/40">
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.6} />
                  2 joueurs
                </span>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Robot01Icon} size={15} strokeWidth={1.6} />
                  IA Stockfish locale
                </span>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={JoystickIcon} size={15} strokeWidth={1.6} />
                  Mode local sur un seul écran
                </span>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/games/chess/local"
                  className="flex h-12 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                >
                  <HugeiconsIcon icon={Chess01Icon} size={17} strokeWidth={1.8} />
                  Jouer en local
                </Link>

                <Link
                  href="/games/chess/play"
                  className="flex h-12 items-center gap-2 rounded-xl border border-slate-300 px-6 text-sm font-semibold text-slate-700 transition hover:border-amber-500 hover:text-amber-600 dark:border-white/15 dark:text-white/80 dark:hover:border-amber-400/60 dark:hover:text-amber-300"
                >
                  <HugeiconsIcon icon={UserGroupIcon} size={17} strokeWidth={1.8} />
                  Jouer en ligne
                </Link>

                <p className="max-w-[15rem] text-xs leading-5 text-slate-400 dark:text-white/35">
                  Le serveur valide chaque coup et tient l&apos;état de la
                  partie.
                </p>
              </div>
            </div>

            <div className="relative">
              <div
                aria-hidden
                className="relative mx-auto grid aspect-square w-full max-w-md grid-cols-8 overflow-hidden rounded-3xl border border-slate-200/70 shadow-2xl dark:border-white/10"
              >
                {START_BOARD.flatMap((row, rowIndex) =>
                  row.map((piece, columnIndex) => {
                    const dark = (rowIndex + columnIndex) % 2 === 1;
                    const whitePiece =
                      piece !== null && "♙♖♘♗♕♔".includes(piece);

                    return (
                      <div
                        key={`${rowIndex}-${columnIndex}`}
                        className={`flex items-center justify-center text-[clamp(1.2rem,4vw,2.2rem)] leading-none ${
                          dark
                            ? "bg-amber-800/90 dark:bg-amber-950"
                            : "bg-amber-100 dark:bg-amber-200/80"
                        }`}
                      >
                        {piece && (
                          <span
                            className={
                              whitePiece
                                ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,.65)]"
                                : "text-slate-950"
                            }
                          >
                            {piece}
                          </span>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>

              <div className="absolute -right-6 -top-6 -z-10 size-40 rounded-full bg-amber-400/20 blur-3xl" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Comment jouer</h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {RULES.map((item) => (
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
              className="font-medium text-amber-600 underline-offset-4 hover:underline dark:text-amber-300"
            >
              Retour au catalogue
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
