"use client";

import Link from "next/link";
import Dice from "@/components/dice";
import { signOut, useSession } from "@/lib/auth-client";

const navigation = [
  {
    label: "Games",
    href: "/games",
  },
  {
    label: "How it works",
    href: "/how-it-works",
  },
  {
    label: "Community",
    href: "/community",
  },
];

export default function Navbar() {
  const { data: session, isPending } = useSession();
  return (
    <header className="relative z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between bg-transparent px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-wide sm:text-base"
          aria-label="Game Arena"
        >
          <span className="relative size-9 shrink-0">
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
                palettes: [
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
                ],
              }}
            />
          </span>

          <span className="hidden sm:inline">Game Arena</span>
        </Link>

        {/* Navigation */}
        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Main navigation"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-slate-500 transition-colors hover:text-slate-950 dark:text-white/65 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {session ? (
            <div className="flex items-center gap-4">
              <span>{session.user.name}</span>

              <button type="button" onClick={() => signOut()}>
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="hidden rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:text-slate-950 dark:text-white/70 dark:hover:text-white sm:block"
            >
              Sign in
            </Link>
          )}

          <Link
            href="/games"
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-black sm:px-4"
          >
            Play now
          </Link>
        </div>
      </div>
    </header>
  );
}
