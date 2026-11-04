import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Globe02Icon,
  JoystickIcon,
  TimeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { auth } from "@/lib/auth";
import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import { CheckersEntryActions } from "./checkers-entry-actions";

export const metadata: Metadata = {
  title: "Checkers | Game Arena",
  description:
    "Le jeu de dames — capture obligatoire, rafles et promotion en dame. À deux sur un écran ou en ligne en temps réel.",
};

/** The three rules that actually change how you play. */
const RULES = [
  {
    step: "1",
    title: "Avance en diagonale",
    body: "Les pions avancent d'une case en diagonale, jamais en arrière. Seule la dame recule librement.",
  },
  {
    step: "2",
    title: "La prise est obligatoire",
    body: "Si une capture existe, il faut la jouer — et s'il y a plusieurs rafles, la plus longue s'impose. Les pions capturent aussi en arrière.",
  },
  {
    step: "3",
    title: "Promotion en dame",
    body: "Un pion qui termine son coup sur la dernière rangée devient dame. Gagne en capturant tout, ou en bloquant l'adversaire.",
  },
];

/**
 * Checkers entry page — hero, key facts and the explicit Local / Online
 * choice, following the same layout as the other games in the catalog.
 */
export default async function CheckersPage() {
  const game = getGameBySlug("checkers");
  if (!game) return null;

  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-184 mask-[radial-gradient(ellipse_60%_72%_at_78%_38%,#000_18%,transparent_76%)]"
      >
        <Image
          src="/checkers.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_40%] opacity-[.16] contrast-125 sm:opacity-[.2] dark:opacity-[.24]"
        />
      </div>

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">
                <HugeiconsIcon icon={TimeIcon} size={14} strokeWidth={1.8} />
                {game.category} · 10–20 min par partie
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
                  {game.minPlayers} joueurs
                </span>

                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Globe02Icon} size={15} strokeWidth={1.6} />
                  Partie temps réel arbitrée par le serveur
                </span>

                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={JoystickIcon} size={15} strokeWidth={1.6} />
                  Mode local sur un seul écran
                </span>
              </div>

              <CheckersEntryActions
                signedIn={Boolean(session?.user)}
                playableOnline={game.playableOnline}
              />
            </div>

            {/* Hero visual: a rendered corner of the board, no asset needed. */}
            <div className="relative">
              <div
                aria-hidden
                className="relative grid aspect-square w-full max-w-md grid-cols-6 overflow-hidden rounded-3xl border border-slate-200/70 shadow-2xl dark:border-white/10"
              >
                {Array.from({ length: 36 }, (_, cell) => {
                  const row = Math.floor(cell / 6);
                  const col = cell % 6;
                  const dark = (row + col) % 2 === 1;
                  const white = dark && row >= 4;
                  const black = dark && row <= 1;

                  return (
                    <div
                      key={cell}
                      className={`flex items-center justify-center ${
                        dark
                          ? "bg-amber-800/90 dark:bg-amber-950"
                          : "bg-amber-100 dark:bg-amber-200/80"
                      }`}
                    >
                      {(white || black) && (
                        <span
                          className={`size-[72%] rounded-full border-2 shadow-md ${
                            white
                              ? "border-slate-300 bg-gradient-to-br from-slate-50 to-slate-300"
                              : "border-slate-900 bg-gradient-to-br from-slate-700 to-slate-950"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
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
