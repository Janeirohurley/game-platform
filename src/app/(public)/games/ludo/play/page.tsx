import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { auth } from "@/lib/auth";
import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";

import { PlayOnlineLudo } from "./play-online-ludo";

export const metadata: Metadata = {
  title: "Ludo — Jouer en ligne | Game Arena",
  description: "Crée une partie de Ludo en ligne et invite tes amis avec un lien.",
};

/**
 * Online play entry for Ludo: a proper Game Arena page (universe
 * background, navbar, breadcrumb) hosting the create-room flow —
 * player count → connected waiting lobby → game.
 */
export default async function LudoPlayOnlinePage() {
  const game = getGameBySlug("ludo");
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";
  const viewerName = session?.user?.name ?? "";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto w-full max-w-2xl px-4 pb-20 pt-8 sm:px-6">
          {/* Breadcrumb */}
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
              href="/games/ludo"
              className="transition-colors hover:text-slate-600 dark:hover:text-white/70"
            >
              Ludo
            </Link>

            <span aria-hidden>/</span>

            <span className="font-medium text-slate-600 dark:text-white/60">
              En ligne
            </span>
          </nav>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">
              Nouvelle partie en ligne
            </p>

            <h1 className="mt-3 font-(family-name:--font-playwrite) text-4xl font-normal leading-[0.95] tracking-tight sm:text-5xl">
              Ludo
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
              Crée une table, partage le lien d&apos;invitation et jouez en
              temps réel. Le serveur arbitre les dés, les déplacements et les
              captures — personne ne peut tricher.
            </p>
          </div>

          {/* Create-room flow (player count → lobby → game) */}
          <div className="mt-10">
            <PlayOnlineLudo
              gameId={game?.slug ?? "ludo"}
              minPlayers={game?.minPlayers ?? 2}
              maxPlayers={game?.maxPlayers ?? 4}
              viewerUserId={viewerUserId}
              viewerName={viewerName}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
