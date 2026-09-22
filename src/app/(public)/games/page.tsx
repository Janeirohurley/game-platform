"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GameController02Icon,
  Search01Icon,
  UserGroupIcon,
  FlashIcon,
  Clock01Icon,
  ArrowUpRight01Icon,
  FilterHorizontalIcon,
} from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import Dice from "@/components/dice";

type Category = "All" | "Arcade" | "Strategy" | "Racing" | "Puzzle";

type Game = {
  title: string;
  slug: string;
  description: string;
  category: Exclude<Category, "All">;
  players: number;
  maxPlayers: number;
  status: "Live" | "Open";
  accent: string;
  glow: string;
  icon: string;
};

const games: Game[] = [
  {
    title: "Ludo",
    slug: "ludo",
    description: "Fast two-player races through a neon orbital track.",
    category: "Puzzle",
    players: 184,
    maxPlayers: 4,
    status: "Live",
    accent: "from-cyan-400 via-sky-500 to-blue-700",
    glow: "bg-cyan-400/20",
    icon: "RD",
  },
  {
    title: "Neon Drift",
    slug: "neon-drift",
    description: "Fast two-player races through a neon orbital track.",
    category: "Racing",
    players: 184,
    maxPlayers: 2,
    status: "Live",
    accent: "from-cyan-400 via-sky-500 to-blue-700",
    glow: "bg-cyan-400/20",
    icon: "ND",
  },
  {
    title: "Hex Clash",
    slug: "hex-clash",
    description:
      "Claim territory, outplay your opponent and control the board.",
    category: "Strategy",
    players: 96,
    maxPlayers: 2,
    status: "Live",
    accent: "from-violet-400 via-fuchsia-500 to-purple-800",
    glow: "bg-violet-500/20",
    icon: "HX",
  },
  {
    title: "Pixel Duel",
    slug: "pixel-duel",
    description: "Quick competitive rounds built for instant matchmaking.",
    category: "Arcade",
    players: 241,
    maxPlayers: 2,
    status: "Live",
    accent: "from-rose-400 via-red-500 to-orange-700",
    glow: "bg-rose-500/20",
    icon: "PD",
  },
  {
    title: "Orbital Chess",
    slug: "orbital-chess",
    description: "Classic strategy with a futuristic space-board twist.",
    category: "Strategy",
    players: 63,
    maxPlayers: 2,
    status: "Open",
    accent: "from-emerald-300 via-teal-500 to-cyan-800",
    glow: "bg-emerald-400/20",
    icon: "OC",
  },
  {
    title: "Gravity Run",
    slug: "gravity-run",
    description: "Defy gravity, collect energy and finish the course first.",
    category: "Arcade",
    players: 118,
    maxPlayers: 4,
    status: "Live",
    accent: "from-amber-300 via-orange-500 to-red-700",
    glow: "bg-orange-400/20",
    icon: "GR",
  },
  {
    title: "Mind Grid",
    slug: "mind-grid",
    description: "Solve evolving patterns before the clock reaches zero.",
    category: "Puzzle",
    players: 52,
    maxPlayers: 2,
    status: "Open",
    accent: "from-blue-300 via-indigo-500 to-violet-700",
    glow: "bg-indigo-400/20",
    icon: "MG",
  },
];

const categories: Category[] = [
  "All",
  "Arcade",
  "Strategy",
  "Racing",
  "Puzzle",
];

const dicePalettes = [
  {
    body: "#5bd8f3",
    pip: "#07101b",
    light: "#63dcff",
  },
  {
    body: "#bd67ff",
    pip: "#08040e",
    light: "#c77dff",
  },
  {
    body: "#ffad4d",
    pip: "#161006",
    light: "#ffb45c",
  },
];



export default function GamesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return games.filter((game) => {
      const matchesCategory = category === "All" || game.category === category;

      const matchesSearch =
        !normalizedQuery ||
        game.title.toLowerCase().includes(normalizedQuery) ||
        game.description.toLowerCase().includes(normalizedQuery) ||
        game.category.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [category, query]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        {/* Dice above all page content */}
        <div className="flex justify-center pt-6 sm:pt-8">
          <div className="absolute sm:right-30 right-0  size-25 sm:size-89 lg:size-80">
            <Dice
              size={2.4}
              clickable={false}
              autoRotate
              autoRotateSpeed={0.5}
              style={{
                minHeight: 0,
                width: "100%",
                height: "100%",
              }}
              colorAnimation={{
                enabled: true,
                duration: 4000,
                palettes: dicePalettes,
              }}
            />
          </div>
        </div>

        <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 sm:pt-6 lg:px-8">
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
              Browse public games, discover active players and jump into a
              realtime match without waiting for an invitation.
            </p>
          </div>

          {/* Controls */}
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
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

            {/* Categories */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="mr-1 hidden shrink-0 items-center gap-2 text-xs text-slate-400 sm:flex dark:text-white/35">
                <HugeiconsIcon
                  icon={FilterHorizontalIcon}
                  size={15}
                  strokeWidth={1.6}
                />
                Filter
              </div>

              {categories.map((item) => {
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
              <p className="text-sm font-medium">
                {filteredGames.length} games
              </p>

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
                <article
                  key={game.slug}
                  className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 shadow-sm backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035]"
                >
                  {/* Game visual */}
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <div
                      className={[
                        "absolute inset-0 bg-linear-to-br",
                        game.accent,
                      ].join(" ")}
                    />

                    <div
                      className={[
                        "absolute -right-8 -top-8 size-40 rounded-full blur-3xl",
                        game.glow,
                      ].join(" ")}
                    />

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.35)_100%)]" />

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="relative">
                        <div className="absolute inset-0 scale-150 rounded-full bg-white/10 blur-2xl" />

                        <div className="relative flex size-20 items-center justify-center rounded-2xl border border-white/20 bg-black/20 text-2xl font-semibold tracking-tight text-white shadow-2xl backdrop-blur-md">
                          {game.icon}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="absolute left-4 top-4 flex items-center gap-2">
                      {game.status === "Live" && (
                        <span
                          className="size-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                          aria-label="Live"
                        />
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
                        <HugeiconsIcon
                          icon={UserGroupIcon}
                          size={15}
                          strokeWidth={1.6}
                        />
                        {game.players} online
                      </span>

                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon
                          icon={GameController02Icon}
                          size={15}
                          strokeWidth={1.6}
                        />
                        {game.maxPlayers} players
                      </span>

                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon
                          icon={
                            game.status === "Live" ? FlashIcon : Clock01Icon
                          }
                          size={15}
                          strokeWidth={1.6}
                        />
                        {game.status}
                      </span>
                    </div>

                    <Link
                      href={`/games/${game.slug}`}
                      className="mt-5 flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      Play now
                    </Link>
                  </div>
                </article>
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
