"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, JoystickIcon } from "@hugeicons/core-free-icons";

interface CheckersEntryActionsProps {
  signedIn: boolean;
  playableOnline: boolean;
}

/**
 * The explicit Local / Online choice. Mirrors the Ludo entry actions so
 * every game on the platform offers the same two doors in the same place.
 */
export function CheckersEntryActions({
  signedIn,
  playableOnline,
}: CheckersEntryActionsProps) {
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        {playableOnline && (
          <Link
            href={
              signedIn
                ? "/games/checkers/play"
                : "/sign-in?callbackUrl=%2Fgames%2Fcheckers%2Fplay"
            }
            className="flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <HugeiconsIcon icon={Globe02Icon} size={17} strokeWidth={1.8} />
            Jouer en ligne
          </Link>
        )}

        <Link
          href="/games/checkers/local"
          className="flex h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          <HugeiconsIcon icon={JoystickIcon} size={17} strokeWidth={1.8} />
          Jouer en local
        </Link>

        {!signedIn && playableOnline && (
          <p className="text-xs text-slate-400 dark:text-white/35">
            Connecte-toi pour créer une partie en ligne
          </p>
        )}
      </div>
    </div>
  );
}
