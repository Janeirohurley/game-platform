"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  GameController02Icon,
  MapsGlobal01Icon,
  UserGroupIcon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import Dice from "@/components/dice";
import Image from "next/image";
import { socialLinks } from "@/lib/social-config";
type Player = {
  name: string;
  status: string;
  game: string;
  initials: string;
  accent: string;
};

type Activity = {
  player: string;
  action: string;
  game: string;
  time: string;
  accent: string;
};

type Community = {
  name: string;
  description: string;
  members: number;
  category: string;
  accent: string;
};

const players: Player[] = [
  {
    name: "Nova",
    status: "In match",
    game: "Neon Drift",
    initials: "N",
    accent: "bg-cyan-500",
  },
  {
    name: "Kairo",
    status: "Looking for player",
    game: "Hex Clash",
    initials: "K",
    accent: "bg-violet-500",
  },
  {
    name: "Lumi",
    status: "In match",
    game: "Pixel Duel",
    initials: "L",
    accent: "bg-rose-500",
  },
  {
    name: "Orbit",
    status: "Online",
    game: "Orbital Chess",
    initials: "O",
    accent: "bg-emerald-500",
  },
  {
    name: "Rex",
    status: "Looking for player",
    game: "Gravity Run",
    initials: "R",
    accent: "bg-orange-500",
  },
  {
    name: "Mika",
    status: "In match",
    game: "Mind Grid",
    initials: "M",
    accent: "bg-indigo-500",
  },
];

const activities: Activity[] = [
  {
    player: "Nova",
    action: "joined a match in",
    game: "Neon Drift",
    time: "Just now",
    accent: "bg-cyan-500",
  },
  {
    player: "Kairo",
    action: "is looking for players in",
    game: "Hex Clash",
    time: "1 min ago",
    accent: "bg-violet-500",
  },
  {
    player: "Lumi",
    action: "finished a match in",
    game: "Pixel Duel",
    time: "3 min ago",
    accent: "bg-rose-500",
  },
  {
    player: "Orbit",
    action: "started playing",
    game: "Orbital Chess",
    time: "5 min ago",
    accent: "bg-emerald-500",
  },
  {
    player: "Rex",
    action: "joined the community",
    game: "",
    time: "8 min ago",
    accent: "bg-orange-500",
  },
];

const communities: Community[] = [
  {
    name: "Arcade Players",
    description: "Fast matches, quick rematches and competitive arcade games.",
    members: 1284,
    category: "Arcade",
    accent: "text-cyan-600 dark:text-cyan-300",
  },
  {
    name: "Strategy Lab",
    description: "Discuss tactics, challenge players and improve your game.",
    members: 846,
    category: "Strategy",
    accent: "text-violet-600 dark:text-violet-300",
  },
  {
    name: "Racing League",
    description: "Find opponents, compare times and organize racing sessions.",
    members: 692,
    category: "Racing",
    accent: "text-orange-600 dark:text-orange-300",
  },
  {
    name: "Puzzle House",
    description:
      "Share solutions and compete against players who love puzzles.",
    members: 518,
    category: "Puzzle",
    accent: "text-emerald-600 dark:text-emerald-300",
  },
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

export default function CommunityPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        {/* Dice */}
        <div className="flex justify-center pt-5 sm:mt-25">
          <div className="absolute right-8 top-4 size-28 sm:size-150">
            <Dice
              size={2.4}
              clickable={false}
              autoRotate
              autoRotateSpeed={0.2}
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

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-3 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Play together.
              <br />
              <span className="text-cyan-500 dark:text-cyan-300">
                Meet your people.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base dark:text-white/50">
              See who&apos;s online, discover active groups and find players who
              enjoy the same games as you.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/games"
                className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                Find a game
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={16}
                  strokeWidth={1.7}
                  className="ml-2"
                />
              </Link>

              <a
                href="#communities"
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:text-white/75 dark:hover:border-white/20 dark:hover:bg-white/[0.03]"
              >
                Browse communities
              </a>
            </div>
          </div>
        </section>

        {/* Live statistics */}
        <section className="overflow-hidden my-28  mx-auto max-w-7xl ">
          <div className="relative flex overflow-hidden">
            <div className="flex min-w-max animate-[community-marquee_32s_linear_infinite]">
              {[...Array(2)].flatMap((_, copyIndex) =>
                [
                  {
                    icon: UserGroupIcon,
                    label: "Total members",
                    value: "1,348",
                  },
                  {
                    icon: Wifi01Icon,
                    label: "Online members",
                    value: "443",
                  },
                  {
                    icon: GameController02Icon,
                    label: "Active matches",
                    value: "128",
                  },
                  {
                    icon: GameController02Icon,
                    label: "Public games",
                    value: "24",
                  },
                  {
                    icon: UserGroupIcon,
                    label: "Communities",
                    value: "36",
                  },
                  {
                    icon: MapsGlobal01Icon,
                    label: "Countries",
                    value: "42",
                  },
                ].map((stat, index) => (
                  <div
                    key={`${copyIndex}-${stat.label}-${index}`}
                    className="flex shrink-0 items-center gap-3  px-6 py-5 dark:border-white/10 sm:px-8"
                  >
                    <HugeiconsIcon
                      icon={stat.icon}
                      size={18}
                      strokeWidth={1.6}
                      className="shrink-0 text-slate-400 dark:text-white/35"
                    />

                    <span className="text-xs text-slate-400 dark:text-white/35">
                      {stat.label}
                    </span>

                    <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                      {stat.value}
                    </span>
                  </div>
                )),
              )}
            </div>
          </div>

          <style jsx>{`
            @keyframes community-marquee {
              from {
                transform: translateX(0);
              }

              to {
                transform: translateX(-50%);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .animate-\\[community-marquee_32s_linear_infinite\\] {
                animation: none;
              }
            }
          `}</style>
        </section>

        {/* Communities */}
        <section
          id="communities"
          className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8"
        >
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400 dark:text-white/30">
              Find your group
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Communities
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/40">
              Join players around the games and play styles you enjoy.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {communities.map((community) => (
              <article key={community.name} className="">
                <div className="flex items-start justify-between">
                  <span
                    className={`text-xs font-medium uppercase tracking-[0.14em] ${community.accent}`}
                  >
                    {community.category}
                  </span>

                  <HugeiconsIcon
                    icon={ArrowUpRight01Icon}
                    size={16}
                    strokeWidth={1.6}
                    className="text-slate-300 dark:text-white/20"
                  />
                </div>

                <h3 className="mt-4 text-lg font-semibold tracking-tight">
                  {community.name}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/40">
                  {community.description}
                </p>

                <div className="mt-5 flex items-center gap-2 text-xs text-slate-400 dark:text-white/30">
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    size={14}
                    strokeWidth={1.6}
                  />
                  {community.members.toLocaleString()} members
                </div>

                <button
                  type="button"
                  className="mt-5 text-sm font-medium text-slate-700 transition hover:text-slate-950 dark:text-white/65 dark:hover:text-white"
                >
                  Join community →
                </button>
              </article>
            ))}
          </div>

          <section
            id="creator"
            className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
          >
            <div className="grid items-center gap-12 lg:grid-cols-[480px_1fr] lg:gap-20">
              {/* Portrait */}
              <div className="relative mx-auto h-[600px] w-[480px] max-w-full overflow-hidden">
                <Image
                  src="/concepter.png"
                  alt="Concepteur de Game Arena"
                  fill
                  priority
                  className="object-contain"
                  sizes="(max-width: 1024px) 90vw, 480px"
                />
              </div>

              {/* Content */}
              <div className="max-w-2xl">
                <h2 className="mt-4 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl">
                  Behind
                  <br />
                  <span className="text-cyan-500 dark:text-cyan-300">
                    Game Arena.
                  </span>
                </h2>

                <p className="mt-6 text-base leading-7 text-slate-500 dark:text-white/45">
                  Game Arena was created to make multiplayer gaming feel simple,
                  immediate and social. The idea is straightforward: find a
                  game, find someone to play with, and get into the match
                  without unnecessary friction.
                </p>

                <p className="mt-4 text-base leading-7 text-slate-500 dark:text-white/45">
                  The platform brings together public games, realtime
                  matchmaking and a community built around playing together
                  across devices.
                </p>

                <h2 className="mt-20 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl">
                  <span className="text-cyan-500 dark:text-cyan-300">
                    Janeiro Hurley.
                  </span>
                </h2>
              </div>
            </div>
          </section>
          <section>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-between">
              <h3 className="text-sm font-medium tracking-tight">
                Follow Janeirohurley
              </h3>

              <div className="flex items-center gap-5">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target={
                      social.href.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      social.href.startsWith("http") ? "noreferrer" : undefined
                    }
                    aria-label={social.name}
                    className="text-slate-400 transition hover:text-slate-950 dark:text-white/40 dark:hover:text-white"
                  >
                    {social.type === "image" ? (
                      <Image
                        src={social.src}
                        alt={social.name}
                        width={24}
                        height={24}
                        className="object-contain"
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={social.icon}
                        size={21}
                        strokeWidth={1.6}
                      />
                    )}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: typeof UserGroupIcon;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-slate-200 px-4 py-5 sm:border-b-0 sm:border-r dark:border-white/10">
      <HugeiconsIcon
        icon={icon}
        size={20}
        strokeWidth={1.6}
        className="shrink-0 text-slate-500 dark:text-white/50"
      />

      <div>
        <p className="text-lg font-semibold tracking-tight">{value}</p>

        <p className="mt-0.5 text-xs text-slate-400 dark:text-white/30">
          {label}
        </p>
      </div>
    </div>
  );
}
