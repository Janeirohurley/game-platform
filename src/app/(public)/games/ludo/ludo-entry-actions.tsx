"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Globe02Icon, JoystickIcon } from "@hugeicons/core-free-icons";

interface LudoEntryActionsProps {
  signedIn: boolean;
  playableOnline: boolean;
}

/**
 * Landing page play actions: simple, professional links to the two ways
 * to play. The online create-room flow lives on its own page
 * (/games/ludo/play) so the landing stays clean and lightweight.
 */
export function LudoEntryActions({ signedIn, playableOnline }: LudoEntryActionsProps) {
  const [joining, setJoining] = useState(false);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        {playableOnline && (
          <Link
            href={signedIn ? "/games/ludo/play" : "/sign-in?callbackUrl=%2Fgames%2Fludo%2Fplay"}
            onClick={() => setJoining(true)}
            className="flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <HugeiconsIcon icon={Globe02Icon} size={17} strokeWidth={1.8} />
            {joining ? "Chargement…" : "Jouer en ligne"}
          </Link>
        )}

        <Link
          href="/games/ludo/local"
          className="flex h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          <HugeiconsIcon icon={JoystickIcon} size={17} strokeWidth={1.8} />
          Jouer en local
        </Link>

        {!signedIn && playableOnline && (
          <p className="text-xs text-slate-400 dark:text-white/35">
            Connecte-toi pour créer une room en ligne
          </p>
        )}
      </div>
    </div>
  );
}
