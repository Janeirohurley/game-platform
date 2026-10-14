"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon } from "@hugeicons/core-free-icons";

export interface ActionOverlayAction {
  label: string;
  onClick: () => void;
}

export interface ActionOverlayProps {
  /** Main line — what the server is currently doing for the user. */
  title: string;
  /** Supporting line — the reassurance or the failure reason. */
  detail?: string;
  /** "busy" spins; "error" turns red and offers the actions below. */
  tone?: "busy" | "error";
  /** Primary action, shown on failure (e.g. "Réessayer"). */
  action?: ActionOverlayAction;
  /** Secondary action — usually an escape hatch ("Quitter quand même"). */
  secondaryAction?: ActionOverlayAction;
}

/**
 * Full-screen blocking overlay for an action awaiting its server
 * acknowledgement (leaving, closing, preparing a table). The point is
 * that the UI never advances on its own: it stays behind this overlay
 * until the server answers — the server's answer is what removes it.
 */
export function ActionOverlay({
  title,
  detail,
  tone = "busy",
  action,
  secondaryAction,
}: ActionOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-6 text-center text-white shadow-2xl">
        <span
          className={`mx-auto flex size-12 items-center justify-center rounded-full ${
            tone === "error"
              ? "bg-rose-500/15 text-rose-300"
              : "bg-white/10 text-white"
          }`}
        >
          {tone === "busy" ? (
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
            />
          ) : (
            <HugeiconsIcon icon={Alert02Icon} size={22} strokeWidth={1.8} />
          )}
        </span>
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        {detail && <p className="mt-2 text-sm text-white/60">{detail}</p>}
        {(action || secondaryAction) && (
          <div className="mt-5 flex justify-center gap-2">
            {secondaryAction && (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {secondaryAction.label}
              </button>
            )}
            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/25"
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
