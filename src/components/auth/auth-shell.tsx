"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";

export const AUTH_DICE_PALETTES = [
  { body: "#5bd8f3", pip: "#07101b", light: "#63dcff" },
  { body: "#bd67ff", pip: "#08040e", light: "#c77dff" },
  { body: "#ffad4d", pip: "#161006", light: "#ffb45c" },
];

const ACCENTS = {
  cyan: "bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_55%)]",
  violet:
    "bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_55%)]",
} as const;

interface AuthShellProps {
  heading: ReactNode;
  description: ReactNode;
  children: ReactNode;
  visual: ReactNode;
  accent?: keyof typeof ACCENTS;
  backHref?: string;
  backLabel?: string;
  footerTitle: string;
  footerText: string;
}

/**
 * Shared chrome for the authentication screens (sign-in / sign-up).
 * Presentational only — the forms live in the pages so each can keep its
 * own fields, while the background, columns and 3D panel stay identical.
 */
export default function AuthShell({
  heading,
  description,
  children,
  visual,
  accent = "cyan",
  backHref = "/",
  backLabel = "Retour à Game Arena",
  footerTitle,
  footerText,
}: AuthShellProps) {
  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20 min-h-svh">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none dark:text-white/55 dark:hover:text-white"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={17} strokeWidth={1.7} />
            {backLabel}
          </Link>
        </div>

        <section className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Form column */}
          <div className="flex items-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <Link
                  href="/"
                  className="mb-6 inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
                >
                  <span className="relative size-8 shrink-0">
                    <Dice
                      size={2.1}
                      clickable={false}
                      autoRotate
                      autoRotateSpeed={0.5}
                      style={{ minHeight: 0, width: "100%", height: "100%" }}
                      colorAnimation={{
                        enabled: true,
                        duration: 4000,
                        palettes: AUTH_DICE_PALETTES,
                      }}
                    />
                  </span>

                  <span>Game Arena</span>
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {heading}
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                  {description}
                </p>
              </div>

              {children}
            </div>
          </div>

          {/* 3D column */}
          <div className="relative hidden min-h-[calc(100svh-4rem)] items-center justify-center lg:flex">
            <div className={`absolute inset-0 ${ACCENTS[accent]}`} />

            <div className="relative size-[min(42vw,520px)]">{visual}</div>

            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/25">
                {footerTitle}
              </p>

              <p className="mt-2 text-sm text-slate-500 dark:text-white/40">
                {footerText}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
