import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { auth } from "@/lib/auth";
import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";

import { PlayOnlineRally } from "./play-online-rally";

export const metadata: Metadata = {
  title: "Rally — Jouer en ligne | Game Arena",
  description: "Crée une table de tennis de table en ligne et invite ton adversaire.",
};

export default async function RallyPlayOnlinePage() {
  const game = getGameBySlug("rally");
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs text-slate-400 dark:text-white/35">
            <Link href="/games" className="flex items-center gap-1 transition-colors hover:text-slate-600 dark:hover:text-white/70">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.8} />
              Catalogue
            </Link>
            <span aria-hidden>/</span>
            <Link href="/games/rally" className="transition-colors hover:text-slate-600 dark:hover:text-white/70">
              Rally
            </Link>
            <span aria-hidden>/</span>
            <span className="font-medium text-slate-600 dark:text-white/60">En ligne</span>
          </nav>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-300">
              Nouvelle partie en ligne
            </p>
            <h1 className="mt-3 font-(family-name:--font-playwrite) text-4xl font-normal leading-[0.95] tracking-tight sm:text-5xl">
              Rally
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
              Partage le lien, prenez chacun un bout de table. Le serveur fait
              tourner la physique et arbitre chaque point — personne ne peut
              tricher.
            </p>
          </div>

          <div className="mt-10">
            <PlayOnlineRally gameId={game?.slug ?? "rally"} viewerUserId={viewerUserId} />
          </div>
        </section>
      </div>
    </main>
  );
}
