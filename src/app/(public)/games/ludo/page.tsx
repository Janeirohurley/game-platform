import type { Metadata } from "next";
import Image from "next/image";
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
import GameUniverseBackground from "@/components/game-universe-background";
import { LudoEntryActions } from "./ludo-entry-actions";

export const metadata: Metadata = {
  title: "Ludo | Game Arena",
  description:
    "Le classique jeu de plateau Ludo — joue en local ou rejoins des rooms en ligne temps réel avec 2 à 6 joueurs.",
};

/**
 * Ludo entry page: a real landing for the game — hero, key facts and the
 * two ways to play (online rooms or local 3D). Renders the generic
 * create-room flow inline for signed-in users.
 */
export default async function LudoPage() {
  const game = getGameBySlug("ludo");
  if (!game) return null;

  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
                <HugeiconsIcon icon={TimeIcon} size={14} strokeWidth={1.8} />
                {game.category} · 15–45 min par partie selon la table
              </p>

              <h1 className="mt-4 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
                {game.title}
              </h1>

              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
                {game.description} Sorts tes pions de la base, évite les
                captures et sois le premier à rentrer les quatre pions à la
                maison.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500 dark:text-white/40">
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.6} />
                  {game.minPlayers}–{game.maxPlayers} joueurs
                </span>

                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Globe02Icon} size={15} strokeWidth={1.6} />
                  Rooms temps réel en ligne
                </span>

                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={JoystickIcon} size={15} strokeWidth={1.6} />
                  Mode local sur un seul écran
                </span>
              </div>

              {/* Play actions — links to online play and local play */}
              <LudoEntryActions
                signedIn={Boolean(session?.user)}
                playableOnline={game.playableOnline}
              />
            </div>

            {/* Hero visual */}
            <div className="relative">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-slate-200/70 shadow-2xl dark:border-white/10">
                <Image
                  src="/ludo.jpg"
                  alt="Plateau de Ludo"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,.35)_100%)]" />

                <div className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  Jusq&apos; à 6coleurs · 4 pions chacune · 1 dé
                </div>
              </div>

              <div className="absolute -right-6 -top-6 -z-10 size-40 rounded-full bg-cyan-400/20 blur-3xl" />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Comment jouer
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Lance le dé",
                body: "Un 6 sort un pion de la base et te donne un lancer bonus. Le serveur tire le dé en ligne — personne ne triche.",
              },
              {
                step: "2",
                title: "Cours et capture",
                body: "Atterris sur un adverse pour le renvoyer à sa base. Les étoiles et les départs sont des cases sûres.",
              },
              {
                step: "3",
                title: "Rentre les 4 pions",
                body: "Le compte exact est requis pour entrer à la maison. Le premier qui rentre ses quatre pions gagne.",
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
              className="font-medium text-cyan-600 underline-offset-4 hover:underline dark:text-cyan-300"
            >
              Retour au catalogue
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
