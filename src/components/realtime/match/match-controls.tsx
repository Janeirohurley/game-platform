"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Logout01Icon } from "@hugeicons/core-free-icons";

export interface MatchControlsProps {
  isAdmin: boolean;
  /** Open the two-step leave confirmation (owned by the match screen). */
  onLeaveRequest: () => void;
  /** Admin only — close the room for everyone, for good. */
  onCloseRoom: () => void;
}

/**
 * Top-right controls of the integrated match screen: Quitter for
 * everyone, Fermer la room for the admin only. Closing gets its own
 * confirmation — it is a different, harsher action than leaving (spec
 * section 12): it ends the session for every participant.
 */
export function MatchControls({
  isAdmin,
  onLeaveRequest,
  onCloseRoom,
}: MatchControlsProps) {
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <>
      <div className="pointer-events-auto absolute right-3 top-3 z-40 flex items-start gap-2 sm:right-4 sm:top-4">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmClose(true)}
            className="rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-red-300 backdrop-blur-md transition hover:bg-red-500/70 hover:text-white"
          >
            Fermer la room
          </button>
        )}
        <button
          type="button"
          onClick={onLeaveRequest}
          className="flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-red-500/70"
        >
          <HugeiconsIcon icon={Logout01Icon} size={12} strokeWidth={1.8} />
          Quitter
        </button>
      </div>

      {confirmClose && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-room-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-white shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h2 id="close-room-title" className="text-base font-semibold">
                  Fermer la room pour tout le monde ?
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  La partie se termine définitivement. Joueurs et spectateurs
                  en seront informés puis déconnectés. Cette action est
                  irréversible.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  onCloseRoom();
                }}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Fermer la room
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
