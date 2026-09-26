import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  UserGroupIcon,
  ViewIcon,
  PlayIcon,
  PlusSignIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";

import { auth } from "@/lib/auth";
import { getGameBySlug, isGamePlayableOnline } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import { GameUnavailableNotice } from "@/components/game-unavailable-notice";

import { PlayOnlineLudo } from "./play-online-ludo";

export const metadata: Metadata = {
  title: "Ludo — Jouer en ligne | Game Arena",
  description:
    "Rejoins une partie de Ludo, regarde un match en direct ou crée ta propre table.",
};

export default async function LudoPlayOnlinePage() {
  const game = getGameBySlug("ludo");

  if (!isGamePlayableOnline("ludo")) {
    return (
      <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
        <GameUniverseBackground />

        <div className="relative z-20">
          <Navbar />

          <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-16 sm:px-6">
            <GameUnavailableNotice
              gameTitle={game?.title ?? "Ludo"}
              backHref="/games"
            />
          </div>
        </div>
      </main>
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const viewerUserId = session?.user?.id ?? "";

  const allowedPlayerCounts = game?.allowedPlayerCounts ?? [2, 3, 4];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#070b10] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav
            aria-label="Fil d'Ariane"
            className="flex items-center gap-2 pt-6 text-xs text-slate-400 dark:text-white/35"
          >
            <Link
              href="/games"
              className="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-white/70"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={14}
                strokeWidth={1.8}
              />
              Jeux
            </Link>

            <span>/</span>

            <Link
              href="/games/ludo"
              className="transition-colors hover:text-slate-700 dark:hover:text-white/70"
            >
              Ludo
            </Link>

            <span>/</span>

            <span className="text-slate-600 dark:text-white/60">En ligne</span>
          </nav>

          {/* Hero */}
          <section className="relative mt-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 shadow-xl shadow-slate-300/40 dark:border-white/[0.08] dark:bg-[#0b1219]/90 dark:shadow-2xl dark:shadow-black/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(34,211,238,0.10),transparent_32%),radial-gradient(circle_at_20%_100%,rgba(14,116,144,0.08),transparent_35%)]" />

            <div className="relative grid items-center gap-8 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1fr_380px] lg:px-12 lg:py-12">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 dark:bg-cyan-300" />
                  Game Arena · Online
                </div>

                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-6xl dark:text-white">
                  Ludo
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
                  Entre dans une partie en temps réel, regarde les matchs
                  d&apos;autres joueurs ou crée ta propre table et invite tes
                  amis.
                </p>

                <div className="mt-7 flex flex-wrap gap-2.5">
                  <a
                    href="#parties"
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                  >
                    <HugeiconsIcon
                      icon={PlayIcon}
                      size={17}
                      strokeWidth={2}
                    />
                    Voir les parties
                  </a>

                  <a
                    href="#creer"
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.045] dark:text-white/80 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  >
                    <HugeiconsIcon
                      icon={PlusSignIcon}
                      size={17}
                      strokeWidth={2}
                    />
                    Créer une partie
                  </a>
                </div>

                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-white/[0.07] dark:text-white/40">
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={UserGroupIcon}
                      size={15}
                      strokeWidth={1.8}
                    />
                    {allowedPlayerCounts.join(" · ")} joueurs
                  </span>

                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={ShieldCheckIcon}
                      size={15}
                      strokeWidth={1.8}
                    />
                    Partie arbitrée par le serveur
                  </span>

                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={ViewIcon}
                      size={15}
                      strokeWidth={1.8}
                    />
                    Mode spectateur
                  </span>
                </div>
              </div>

              {/* The Ludo photo from /public, composed into the hero —
                  subtle tilt, rounded frame, one live chip overlay. */}
              <div className="relative hidden lg:block">
                <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px] rotate-[-2deg] overflow-hidden rounded-[1.75rem] border border-slate-200 shadow-2xl shadow-slate-300/60 dark:border-white/10 dark:shadow-cyan-950/30">
                  <Image
                    src="/ludo.jpg"
                    alt=""
                    fill
                    priority
                    sizes="420px"
                    className="object-cover"
                  />

                  <div className="absolute bottom-3 left-3 rounded-full border border-cyan-500/25 bg-white/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 shadow-sm backdrop-blur dark:border-cyan-300/20 dark:bg-black/60 dark:text-cyan-200">
                    Temps réel
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Main game area */}
          <section
            id="parties"
            className="mt-10 scroll-mt-24"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300/70">
                  Maintenant
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
                  Parties disponibles
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-white/40">
                  Rejoins une table existante ou regarde une partie en cours.
                  Les informations sont synchronisées en temps réel.
                </p>
              </div>

              <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex dark:text-white/35">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                En direct
              </div>
            </div>

            <div className="mt-6">
              <PlayOnlineLudo
                gameId={game?.slug ?? "ludo"}
                allowedPlayerCounts={allowedPlayerCounts}
                viewerUserId={viewerUserId}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
