"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  GameController02Icon,
  Search01Icon,
  UserGroupIcon,
  FlashIcon,
  CheckmarkCircle02Icon,
  ArrowRight01Icon,
  SmartPhone01Icon,
  ZapIcon,
  MapsGlobal01Icon,
} from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";
import Dice from "@/components/dice";
import MatchWorkflow from "@/components/match-workflow";

const steps = [
  {
    number: "01",
    title: "Find a game",
    description:
      "Browse the public games and choose something you want to play. No invitation is required.",
    icon: Search01Icon,
    accent: "from-cyan-400 to-blue-600",
  },
  {
    number: "02",
    title: "Enter matchmaking",
    description:
      "Join the matchmaking queue. We look for another player who is ready to play the same game.",
    icon: UserGroupIcon,
    accent: "from-violet-400 to-purple-700",
  },
  {
    number: "03",
    title: "Get matched",
    description:
      "As soon as a compatible opponent is found, the two players are connected to the same realtime match.",
    icon: FlashIcon,
    accent: "from-fuchsia-400 to-rose-600",
  },
  {
    number: "04",
    title: "Play",
    description:
      "The match starts immediately. Game state is synchronized in realtime between the players.",
    icon: GameController02Icon,
    accent: "from-orange-300 to-red-600",
  },
];

const features = [
  {
    icon: ZapIcon,
    title: "Realtime",
    description: "Actions and game state stay synchronized while you play.",
  },
  {
    icon: SmartPhone01Icon,
    title: "Cross-device",
    description: "Play from the device that works best for you.",
  },
  {
    icon: MapsGlobal01Icon,
    title: "Public games",
    description:
      "Discover available games and enter without needing an invitation.",
  },
  {
    icon: CheckmarkCircle02Icon,
    title: "Simple flow",
    description: "Pick a game, find a player and start playing.",
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

export default function HowItWorksPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        {/* Dice */}
        <div className="flex justify-center pt-6 sm:pt-8">
          <div className="relative size-32 sm:size-40">
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

        {/* Hero */}
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-xs font-medium  tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
              How it works
            </p>

            <h1 className="font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              From{" "}
              <span className="bg-linear-to-r from-cyan-500 via-slate-950 to-violet-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-white dark:to-violet-300">
                game
              </span>{" "}
              to match.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/50">
              Discover a game, find another player and start playing in a few
              simple steps. The platform handles the connection so you can focus
              on the match.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/games"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                Browse games
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={17}
                  strokeWidth={1.7}
                  className="ml-2"
                />
              </Link>

              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-6 text-sm font-medium text-slate-700 backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Back home
              </Link>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <article
                key={step.number}
                className="group relative overflow-hidden rounded-2xl  bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035]"
              >
                <div
                  className={`absolute -right-10 -top-10 size-32 rounded-full bg-linear-to-br ${step.accent} opacity-15 blur-3xl transition duration-500 group-hover:opacity-25`}
                />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div
                      className={`flex size-11 items-center justify-center rounded-xl bg-linear-to-br ${step.accent} text-white shadow-lg`}
                    >
                      <HugeiconsIcon
                        icon={step.icon}
                        size={21}
                        strokeWidth={1.7}
                      />
                    </div>
                  </div>

                  <h2 className="mt-8 text-xl font-semibold tracking-tight">
                    {step.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                    {step.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-medium  tracking-[0.18em] text-slate-400 dark:text-white/35">
              The match flow
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Follow the connection.
            </h2>

            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-white/45">
              From selecting a game to a live match, every step is connected in
              one realtime flow.
            </p>
          </div>

          <MatchWorkflow />
        </section>

        {/* Features */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
              Built for realtime play
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Designed around the match.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title}>
                <HugeiconsIcon
                  icon={feature.icon}
                  size={22}
                  strokeWidth={1.6}
                  className="text-slate-700 dark:text-white/80"
                />

                <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/40">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl   px-6 py-12 text-center text-black dark:text-white  sm:px-10">
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to play?
              </h2>

              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-black dark:text-white/55">
                Pick a game and find your next opponent.
              </p>

              <Link
                href="/games"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white/70 px-6 text-sm font-medium text-slate-700 backdrop-blur-md transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              >
                Explore games
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={17}
                  strokeWidth={1.7}
                  className="ml-2"
                />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
