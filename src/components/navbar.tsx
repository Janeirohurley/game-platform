"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, RefreshCw } from "lucide-react";

import Dice from "@/components/dice";
import { useResilientSession } from "@/components/auth/use-resilient-session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/lib/auth-client";
import { cn } from "cn";

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

/**
 * Indicateur affiché dans le header pendant le chargement de la session, et
 * tant qu'on n'arrive pas à la récupérer après une coupure réseau.
 *
 * Il occupe le même gabarit que l'avatar (bouton profil) : rien ne bouge
 * quand la session arrive, et l'attente est annoncée aux lecteurs d'écran
 * via `role="status"`. En reconnexion, l'anneau passe en ambre et le libellé
 * change, pour ne jamais laisser l'utilisateur dans le flou.
 */
function SessionStatusIndicator({ reconnecting }: { reconnecting: boolean }) {
  const label = reconnecting ? "Reconnecting…" : "Loading…";

  return (
    <div
      role="status"
      aria-label={reconnecting ? "Reconnecting to the server" : "Loading session"}
      className="flex items-center gap-3"
    >
      <span className="relative grid size-9 place-items-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border border-border"
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 animate-spin rounded-full border-2 border-transparent",
            reconnecting ? "border-t-amber-500" : "border-t-foreground",
          )}
        />
        {reconnecting ? (
          <RefreshCw className="size-3.5 text-amber-500" aria-hidden="true" />
        ) : (
          <span
            aria-hidden="true"
            className="size-2 animate-pulse rounded-full bg-muted-foreground/50"
          />
        )}
      </span>
      <span
        aria-hidden="true"
        className="hidden text-xs font-medium text-muted-foreground sm:inline"
      >
        {label}
      </span>
    </div>
  );
}

export default function Navbar() {
  const { session, isLoadingSession, isReconnecting } = useResilientSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const links = session
    ? [...navigation, { label: "Wallet", href: "/wallet" }]
    : navigation;

  const handleSignOut = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await signOut();
    } finally {
      setIsLoggingOut(false);
    }
  };

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
          {links.map((item) => (
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
          {isLoadingSession ? (
            <SessionStatusIndicator reconnecting={isReconnecting} />
          ) : session ? (
            <div className="flex items-center gap-4">
              {/* Profile Avatar */}
              <Link
                href="/profile"
                className="flex items-center rounded-full border border-border bg-card p-1 transition hover:border-ring/60"
                aria-label="Open your profile"
              >
                <Avatar className="size-8 transition hover:ring-2 hover:ring-ring">
                  {session.user.image ? (
                    <AvatarImage
                      className="object-cover"
                      src={session.user.image}
                      alt={session.user.name ?? "Profile"}
                    />
                  ) : (
                    <AvatarFallback className="text-xs font-semibold">
                      {session.user.name?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  )}
                </Avatar>
              </Link>

              {/* Logout */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isLoggingOut}
                aria-label={isLoggingOut ? "Logging out..." : "Sign out"}
                title={isLoggingOut ? "Logging out..." : "Sign out"}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? (
                  <span className="flex size-4 items-center justify-center">
                    <svg
                      className="size-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  </span>
                ) : (
                  <LogOut className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:text-slate-950 dark:text-white/70 dark:hover:text-white"
            >
              Sign in
            </Link>
          )}

          {/* Play Now */}
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
