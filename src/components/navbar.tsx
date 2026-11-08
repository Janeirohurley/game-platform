"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, RefreshCw } from "lucide-react";

import Dice from "@/components/dice";
import { WifiOff } from "lucide-react";
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
 * Placeholder du tout premier aller-retour de session.
 *
 * Volontairement muet : à ce stade on ne sait pas encore si le visiteur est
 * connecté, et annoncer quoi que ce soit serait un mensonge une fois sur
 * deux. Il occupe EXACTEMENT le gabarit de ce qui va le remplacer (avatar +
 * bouton, ou lien « Sign in »), pour que le header ne sursaute pas à
 * l'arrivée de la réponse.
 */
function SessionSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3"
      data-testid="session-skeleton"
    >
      <span className="size-9 animate-pulse rounded-full bg-muted" />
      <span className="hidden h-4 w-16 animate-pulse rounded bg-muted sm:block" />
    </div>
  );
}

/**
 * État de panne réseau, affiché à la place (ou à côté) du bloc profil.
 *
 * N'apparaît QUE sur un échec réel — requête en erreur ou navigateur
 * hors-ligne. Un visiteur simplement déconnecté voit « Sign in », jamais
 * ceci : c'est précisément la confusion que corrige `useResilientSession`.
 *
 * Deux variantes, parce que les deux situations n'appellent pas la même
 * réaction de l'utilisateur :
 *   - hors-ligne  → c'est SON réseau, il peut agir. Point fixe, pas
 *     d'animation : rien n'est en cours, on attend le retour du réseau.
 *   - reconnexion → c'est NOUS qui réessayons. Point pulsé : quelque chose
 *     se passe, il n'a rien à faire.
 *
 * `aria-live="polite"` annonce le changement sans interrompre la navigation
 * au clavier ou la lecture en cours.
 */
function ConnectionStatus({
  offline,
  compact = false,
}: {
  offline: boolean;
  compact?: boolean;
}) {
  const label = offline ? "Offline" : "Reconnecting…";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        offline
          ? "You are offline. Waiting for the network to come back."
          : "Connection lost. Reconnecting to the server."
      }
      title={label}
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border px-2.5 text-xs font-medium",
        "transition-colors",
        offline
          ? "border-border bg-muted/60 text-muted-foreground"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      )}
    >
      <span className="relative grid size-2.5 shrink-0 place-items-center">
        {!offline && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-full bg-amber-500/60"
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "relative size-2 rounded-full",
            offline ? "bg-muted-foreground/60" : "bg-amber-500",
          )}
        />
      </span>

      {offline ? (
        <WifiOff className="size-3.5 shrink-0 sm:hidden" aria-hidden="true" />
      ) : (
        <RefreshCw
          className="size-3.5 shrink-0 animate-spin sm:hidden"
          aria-hidden="true"
        />
      )}

      {/* Le libellé disparaît sous `sm` (l'icône porte alors le sens) et dans
          la variante compacte, qui vit à côté d'un avatar déjà présent. */}
      <span
        aria-hidden="true"
        className={cn("hidden whitespace-nowrap", !compact && "sm:inline")}
      >
        {label}
      </span>
    </div>
  );
}

export default function Navbar() {
  const { session, isLoadingSession, isReconnecting, isOffline } =
    useResilientSession();
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
          {/* Ordre des cas, et il compte:
              1. premier chargement        → squelette muet
              2. panne SANS session connue → pastille de statut seule
              3. session                   → profil (+ pastille si panne, car
                                             les données affichées datent
                                             alors du dernier aller-retour)
              4. rien de tout ça           → visiteur anonyme → « Sign in »

              Le cas 4 est celui qui était inatteignable avant le correctif
              de `useResilientSession`. */}
          {isLoadingSession ? (
            <SessionSkeleton />
          ) : isReconnecting && !session ? (
            <ConnectionStatus offline={isOffline} />
          ) : session ? (
            <div className="flex items-center gap-4">
              {isReconnecting && <ConnectionStatus offline={isOffline} compact />}

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
