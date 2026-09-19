import Link from "next/link";
import type { ReactNode } from "react";

import Navbar from "@/components/navbar";
import GameUniverseBackground from "@/components/game-universe-background";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  children: ReactNode;
};

export default function LegalPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  children,
}: LegalPageProps) {
  return (
    <main className="relative min-h-screen bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20">
        <Navbar />

        <div className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <header className="border-b border-slate-200 pb-10 dark:border-white/10">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
              {eyebrow}
            </p>

            <h1 className="mt-4 font-(family-name:--font-playwrite) text-5xl font-normal leading-[0.95] tracking-tight sm:text-6xl">
              {title}
            </h1>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7 dark:text-white/45">
              {description}
            </p>

            <p className="mt-5 text-xs text-slate-400 dark:text-white/30">
              Last updated: {lastUpdated}
            </p>
          </header>

          <div className="py-10">
            <div className="prose prose-slate max-w-none dark:prose-invert">
              {children}
            </div>
          </div>

          <footer className="border-t border-slate-200 pt-8 dark:border-white/10">
            <div className="flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between dark:text-white/35">
              <p>© {new Date().getFullYear()} Game Arena</p>

              <div className="flex gap-5">
                <Link
                  href="/terms"
                  className="transition hover:text-slate-950 dark:hover:text-white"
                >
                  Terms
                </Link>

                <Link
                  href="/privacy"
                  className="transition hover:text-slate-950 dark:hover:text-white"
                >
                  Privacy
                </Link>

                <Link
                  href="/"
                  className="transition hover:text-slate-950 dark:hover:text-white"
                >
                  Home
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}