"use client";

import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";

export interface AuthRequiredDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where to come back to after signing in (defaults to the current path). */
  returnTo?: string;
  /** What the visitor was trying to do — shapes the message. */
  intent?: "create" | "join";
}

/**
 * Popup shown when an anonymous visitor tries to CREATE a table or ASK
 * to play. Watching stays free, so this only fires on seat actions.
 * Points straight at /sign-in and comes back to this page afterwards.
 */
export function AuthRequiredDialog({
  open,
  onClose,
  returnTo,
  intent = "join",
}: AuthRequiredDialogProps) {
  const router = useRouter();

  if (!open) return null;

  // Read the return path at interaction time, not in an effect — the
  // page can navigate between renders and the handler always sees the
  // current location.
  const returnPath =
    returnTo ??
    (typeof window === "undefined"
      ? "/games/ludo/play"
      : window.location.pathname + window.location.search);
  const loginHref = `/sign-in?redirect=${encodeURIComponent(returnPath)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-required-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-neutral-900 dark:text-white">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
          <HugeiconsIcon icon={Alert02Icon} size={22} strokeWidth={1.8} />
        </span>

        <h2
          id="auth-required-title"
          className="mt-4 text-lg font-semibold text-slate-950 dark:text-white"
        >
          Vous n&apos;êtes pas connecté
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/60">
          {intent === "create"
            ? "Créer une partie demande un compte : c'est votre nom qui sera affiché aux autres joueurs et au créateur."
            : "Demander à rejoindre une partie demande un compte : c'est votre nom que le créateur verra sur la demande."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => router.push(loginHref)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
          >
            Procéder à la connexion
            <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          >
            Plus tard — regarder plutôt
          </button>
        </div>
      </div>
    </div>
  );
}
