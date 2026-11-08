import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  gameSupportsBots,
  getGameBySlug,
  isGamePlayableOnline,
  tablePlayerCounts,
} from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import { GameUnavailableNotice } from "@/components/game-unavailable-notice";

import { PlayOnlineLudo } from "./play-online-ludo";

export const metadata: Metadata = {
  title: "Ludo — Jouer en ligne | Game Arena",
  description:
    "Rejoins une partie de Ludo, regarde un match en direct ou crée ta propre table.",
};

const PAGE_BG =
  "bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white";

/**
 * Une table de n joueurs : n points pleins, un point par siège. Même motif que
 * le catalogue et la page du jeu, où les points vides montraient les places en
 * option ; ici chaque taille de table est une table complète, donc tout est plein.
 */
function TableSize({ players }: { players: number }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="flex items-center gap-[3px]">
        {Array.from({ length: Math.min(players, 8) }, (_, index) => (
          <span
            key={index}
            className="size-2 rounded-full bg-zinc-900 dark:bg-zinc-100"
          />
        ))}
      </span>
      <span className="tabular-nums">{players}</span>
    </li>
  );
}

export default async function LudoPlayOnlinePage() {
  const game = getGameBySlug("ludo");

  if (!isGamePlayableOnline("ludo")) {
    return (
      <main className={`min-h-screen ${PAGE_BG}`}>
        <Navbar />

        <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-16 sm:px-6">
          <GameUnavailableNotice
            gameTitle={game?.title ?? "Ludo"}
            backHref="/games"
          />
        </div>
      </main>
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const viewerUserId = session?.user?.id ?? "";

  const allowedPlayerCounts = tablePlayerCounts("ludo");

  const button =
    "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

  return (
    <main className={`relative isolate min-h-screen overflow-x-clip ${PAGE_BG}`}>
      {/* Le plateau en silhouette derrière l'en-tête, comme sur la page du
          jeu : décor pur, niveaux de gris, faible opacité, bords estompés par
          un masque. Il s'arrête avant la liste des parties pour ne pas
          gêner la lecture des tables. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-136 mask-[radial-gradient(ellipse_60%_75%_at_78%_32%,#000_18%,transparent_76%)]"
      >
        <Image
          src="/ludo.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_40%] opacity-[.16]  contrast-125 sm:opacity-[.2] dark:opacity-[.24]"
        />
      </div>

      <Navbar />

      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li>
              <Link
                href="/games"
                className="underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:text-white"
              >
                Jeux
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/games/ludo"
                className="underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:text-white"
              >
                Ludo
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-zinc-950 dark:text-white">
              En ligne
            </li>
          </ol>
        </nav>

        {/* En-tête compact : la tâche de la page est la liste des parties */}
        <header className="mt-8 max-w-xl">
          <div>
            <h1 className="font-(family-name:--font-playwrite) text-4xl font-normal tracking-tight sm:text-5xl">
              Ludo en ligne
            </h1>

            <p className="mt-4 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Entre dans une partie en temps réel, regarde les matchs
              d&apos;autres joueurs ou crée ta propre table et invite tes
              amis.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="#parties"
                className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}
              >
                Voir les parties
              </a>

              <a
                href="#creer"
                className={`${button} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/10`}
              >
                Créer une partie
              </a>
            </div>
          </div>

          <dl className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 text-sm dark:divide-white/10 dark:border-white/10">
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Tables</dt>
              <dd className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  {allowedPlayerCounts.map((players) => (
                    <TableSize key={players} players={players} />
                  ))}
                </ul>
                <span className="text-zinc-500 dark:text-zinc-400">joueurs</span>
              </dd>
            </div>

            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Arbitrage</dt>
              <dd>Le serveur tire le dé et valide chaque coup.</dd>
            </div>

            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
              <dt className="text-zinc-500 dark:text-zinc-400">Spectateurs</dt>
              <dd>Tu peux suivre une partie en cours sans y jouer.</dd>
            </div>
          </dl>
        </header>

        {/* Parties */}
        <section
          id="parties"
          aria-labelledby="parties-titre"
          className="mt-16 scroll-mt-24"
        >
          <h2
            id="parties-titre"
            className="text-2xl font-semibold tracking-tight"
          >
            Parties disponibles
          </h2>

          <p className="mt-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Rejoins une table existante ou regarde une partie en cours. La
            liste se met à jour en temps réel.
          </p>

          <div className="mt-6">
            <PlayOnlineLudo
              gameId={game?.slug ?? "ludo"}
              allowedPlayerCounts={allowedPlayerCounts}
              supportsBots={gameSupportsBots("ludo")}
              viewerUserId={viewerUserId}
            />
          </div>
        </section>
      </div>
    </main>
  );
}