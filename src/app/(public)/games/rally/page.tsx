import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, JoystickIcon, TimeIcon, UserGroupIcon } from "@hugeicons/core-free-icons";

import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";

export const metadata: Metadata = {
  title: "Rally | Game Arena",
  description:
    "Tennis de table contre l'ordinateur — trois niveaux, coups puissants, premier à 11 points.",
};

const RULES = [
  {
    step: "1",
    title: "Place ta raquette",
    body: "La souris, les touches A/D ou le doigt déplacent ta raquette. Le coup part tout seul au contact.",
  },
  {
    step: "2",
    title: "Frappe fort",
    body: "Maintiens le clic ou la barre d'espace pour un coup puissant : la balle va plus vite, mais tu perds en contrôle.",
  },
  {
    step: "3",
    title: "Premier à 11",
    body: "Avec deux points d'écart. Le service change toutes les deux manches, puis à chaque point après 20.",
  },
];

/** Rally entry page — one mode, so it leads straight to the table. */
export default function RallyPage() {
  const game = getGameBySlug("rally");
  if (!game) return null;

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-184 mask-[radial-gradient(ellipse_60%_72%_at_78%_38%,#000_18%,transparent_76%)]"
      >
        <Image
          src="/Rally.jpg"
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
          <div className="max-w-xl">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-300">
                <HugeiconsIcon icon={TimeIcon} size={14} strokeWidth={1.8} />
                {game.category} · 5–10 min par partie
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
                  Solo ou à deux en ligne
                </span>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={JoystickIcon} size={15} strokeWidth={1.6} />
                  Souris, clavier ou tactile
                </span>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/games/rally/play"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  <HugeiconsIcon icon={Globe02Icon} size={17} strokeWidth={1.8} />
                  Jouer en ligne
                </Link>

                <Link
                  href="/games/rally/local"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#d9553a] px-6 text-sm font-semibold text-white transition hover:bg-[#c24b32]"
                >
                  <HugeiconsIcon icon={JoystickIcon} size={17} strokeWidth={1.8} />
                  Solo contre l&apos;ordinateur
                </Link>
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
              className="font-medium text-orange-600 underline-offset-4 hover:underline dark:text-orange-300"
            >
              Retour au catalogue
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
