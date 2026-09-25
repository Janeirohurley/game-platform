"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpRight01Icon,
  Clock01Icon,
  FlashIcon,
  Gamepad01Icon,
  GameController02Icon,
  Search01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";

import type { GameEntry, GameCategory } from "@/lib/games/registry";

type FilterCategory = "All" | GameCategory;

interface GamesBrowserProps {
  games: GameEntry[];
  categories: GameCategory[];
}

export function GamesBrowser({ games, categories }: GamesBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("All");

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return games.filter((game) => {
      const matchesCategory =
        category === "All" || game.category === category;

      const matchesSearch =
        !normalizedQuery ||
        game.title.toLowerCase().includes(normalizedQuery) ||
        game.description.toLowerCase().includes(normalizedQuery) ||
        game.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [category, games, query]);

  const filters: FilterCategory[] = ["All", ...categories];

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-10 max-w-3xl">
            <h1 className="font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Find a game.
              <br />
              <span className="bg-linear-to-r from-cyan-500 via-slate-950 to-violet-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-white dark:to-violet-300">
                Find your match.
              </span>
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
              Browse the catalog and jump into a realtime match — every game
              here is playable, no placeholders.
            </p>
          </div>

          {/* Controls */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-xl">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                strokeWidth={1.7}
                className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400 dark:text-white/35"
              />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search games..."
                aria-label="Search games"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white/80 pl-11 pr-4 text-sm outline-none backdrop-blur-md transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/30"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {filters.map((item) => {
                const active = category === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={[
                      "shrink-0 rounded-lg border px-4 py-2 text-sm transition",
                      active
                        ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-slate-200 bg-white/70 text-slate-500 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10",
                    ].join(" ")}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{filteredGames.length} games</p>

              <p className="mt-1 text-xs text-slate-400 dark:text-white/35">
                Open to everyone
              </p>
            </div>

            <div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex dark:text-white/35">
              <span className="size-2 rounded-full bg-emerald-400" />
              Live matchmaking
            </div>
          </div>

          {/* Games */}
          {filteredGames.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredGames.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-6 py-20 text-center dark:border-white/10 dark:bg-white/[0.025]">
              <HugeiconsIcon
                icon={GameController02Icon}
                size={32}
                strokeWidth={1.7}
                className="mx-auto text-slate-300 dark:text-white/20"
              />

              <h2 className="mt-4 text-lg font-semibold">No games found</h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400 dark:text-white/40">
                Try another search or choose a different category.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function GameCard({ game }: { game: GameEntry }) {
  const live = game.status === "live";

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035]">
      {/* Game visual */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {game.image ? (
          <Image
            src={game.image}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={[
              "absolute inset-0 bg-linear-to-br",
              game.accent ?? "from-slate-400 to-slate-700",
            ].join(" ")}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 scale-150 rounded-full bg-white/10 blur-2xl" />

                <div className="relative flex size-20 items-center justify-center rounded-2xl border border-white/20 bg-black/20 text-2xl font-semibold tracking-tight text-white shadow-2xl backdrop-blur-md">
                  {game.icon}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.45)_100%)]" />

        {/* Status */}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          {live ? (
            <>
              <span
                className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                aria-hidden
              />
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-emerald-300 backdrop-blur-sm">
                Live
              </span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-amber-400" aria-hidden />
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-amber-200 backdrop-blur-sm">
                Coming soon
              </span>
            </>
          )}
        </div>

        {/* Card title */}
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
          <div>
            <p className="text-xs text-white/65">{game.category}</p>

            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              {game.title}
            </h2>
          </div>

          <div className="flex size-10 items-center justify-center rounded-full border border-white/15 bg-black/20 backdrop-blur-md transition group-hover:scale-105">
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              size={18}
              strokeWidth={1.7}
            />
          </div>
        </div>
      </div>

      {/* Card content */}
      <div className="p-5">
        <p className="min-h-12 text-sm leading-6 text-slate-500 dark:text-white/50">
          {game.description}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 dark:text-white/40">
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={UserGroupIcon} size={15} strokeWidth={1.6} />
            {game.minPlayers}–{game.maxPlayers} players
          </span>

          <span className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={game.playableOnline ? FlashIcon : Gamepad01Icon}
              size={15}
              strokeWidth={1.6}
            />
            {game.playableOnline ? "Local + Online" : "Local"}
          </span>

          <span className="flex items-center gap-1.5">
            <HugeiconsIcon
              icon={live ? FlashIcon : Clock01Icon}
              size={15}
              strokeWidth={1.6}
            />
            {live ? "Available" : "In development"}
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          {game.playableOnline && (
            <Link
              href={`/games/${game.slug}/play`}
              className="flex h-11 flex-1 items-center justify-center rounded-lg bg-emerald-600 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Play online
            </Link>
          )}

          <Link
            href={`/games/${game.slug}`}
            className="flex h-11 flex-1 items-center justify-center rounded-lg bg-slate-950 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {game.playableOnline ? "Play locally" : "Discover"}
          </Link>
        </div>
      </div>
    </article>
  );
}
