import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { auth } from "@/lib/auth";
import { getGameBySlug, isGamePlayableOnline } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import { GameUnavailableNotice } from "@/components/game-unavailable-notice";

import { PlayOnlineCheckers } from "./play-online-checkers";

export const metadata: Metadata = {
  title: "Checkers — Jouer en ligne | Game Arena",
  description:
    "Crée une partie de dames en ligne et invite ton adversaire avec un lien.",
};

/**
 * Online play entry for Checkers: creates the two-seat room and hosts
 * the lobby, then the board once the match starts.
 */
export default async function CheckersPlayOnlinePage() {
  const game = getGameBySlug("checkers");

  // Server-side gate: a game still in development never reaches its play
  // flow, even when the URL is typed directly.
  if (!isGamePlayableOnline("checkers")) {
    return (
      <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
        <GameUniverseBackground />
        <div className="relative z-20">
          <Navbar />
          <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-16 sm:px-6">
            <GameUnavailableNotice
              gameTitle={game?.title ?? "Checkers"}
              backHref="/games"
            />
          </div>
        </div>
      </main>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 sm:px-6">
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
              En ligne
            </span>
          </nav>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">
              Nouvelle partie en ligne
            </p>

            <h1 className="mt-3 font-(family-name:--font-playwrite) text-4xl font-normal leading-[0.95] tracking-tight sm:text-5xl">
              Checkers
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
              Partage le lien d&apos;invitation et jouez en temps réel. Le
              serveur valide chaque coup et détient l&apos;état de la partie —
              personne ne peut tricher.
            </p>
          </div>

          <div className="mt-10">
            <PlayOnlineCheckers
              gameId={game?.slug ?? "checkers"}
              viewerUserId={viewerUserId}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
