"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Logout01Icon } from "@hugeicons/core-free-icons";

export interface LeaveConfirmDialogProps {
  /** Final action, run only after the second confirmation. */
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Two-step leave confirmation (spec section 10): a simple click never
 * ejects anyone. Step 1 asks whether they really want to leave; step 2
 * warns the others will be notified. Only then does `onConfirm` fire —
 * the server treats it as a deliberate, seat-freeing departure.
 */
export function LeaveConfirmDialog({
  onConfirm,
  onCancel,
}: LeaveConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-5 text-white shadow-2xl">
        {step === 1 ? (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h2
                  id="leave-dialog-title"
                  className="text-base font-semibold"
                >
                  Voulez-vous vraiment quitter le match ?
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Tu pourras revenir, mais il faudra redemander l&apos;accès
                  auprès du créateur.
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
                Quitter
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
                  id="leave-dialog-title"
                  className="text-base font-semibold"
                >
                  Tu vas quitter cette partie
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Les autres joueurs seront informés de ton départ. Ta place
                  sera libérée. Voulez-vous continuer ?
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
                Oui, quitter le match
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
