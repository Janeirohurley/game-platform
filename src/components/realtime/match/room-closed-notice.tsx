"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";

export interface RoomClosedNoticeProps {
  /** Where "back" leads — usually the game's play page or catalog. */
  backHref: string;
  backLabel?: string;
}

/**
 * Full-screen notice shown when the admin closes the room (spec section
 * 12): everyone is disconnected and this state is terminal.
 */
export function RoomClosedNotice({
  backHref,
  backLabel = "Retour au catalogue",
}: RoomClosedNoticeProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center text-white shadow-2xl">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-500/15 text-red-400">
          <HugeiconsIcon icon={Alert02Icon} size={22} strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-lg font-semibold">La room a été fermée</h1>
        <p className="mt-2 text-sm text-white/60">
          Le créateur a mis fin à la partie. Cette session est terminée
          définitivement — il faut en créer une nouvelle pour rejouer.
        </p>
        <a
          href={backHref}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} strokeWidth={1.8} />
          {backLabel}
        </a>
      </div>
    </div>
  );
}
