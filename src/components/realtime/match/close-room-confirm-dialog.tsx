"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, DoorClosedIcon } from "@hugeicons/core-free-icons";

export interface CloseRoomConfirmDialogProps {
  /** Final action, run only after the second confirmation. */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Two-step CLOSE-ROOM confirmation (admin only). Closing ends the room
 * for EVERYONE — seats, spectators, the whole match — so a stray click
 * must never do it. Step 1 states what closing means; step 2 makes the
 * irreversibility explicit. Only then does `onConfirm` fire (the server
 * re-checks admin rights anyway).
 */
export function CloseRoomConfirmDialog({
  onConfirm,
  onCancel,
}: CloseRoomConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-room-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-white shadow-2xl">
        {step === 1 ? (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                <HugeiconsIcon
                  icon={DoorClosedIcon}
                  size={18}
                  strokeWidth={1.8}
                />
              </span>
              <div>
                <h2
                  id="close-room-dialog-title"
                  className="text-base font-semibold"
                >
                  Fermer la room pour tout le monde ?
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Tous les joueurs et spectateurs seront déconnectés et la
                  partie sera terminée.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-500"
              >
                Continuer
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <HugeiconsIcon icon={Alert02Icon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h2
                  id="close-room-dialog-title"
                  className="text-base font-semibold"
                >
                  Cette action est définitive
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  La room ne pourra pas être rouverte. Confirmer la fermeture
                  pour tous les participants ?
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Oui, fermer la room
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
