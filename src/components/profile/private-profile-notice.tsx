"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon, UserQuestion01Icon } from "@hugeicons/core-free-icons";

import { visitPrivateProfile } from "@/lib/profile/actions";

/**
 * What a visitor sees when the profile is private or does not exist.
 * For a private profile, the visit is logged once (server action) so
 * the owner's "visites privées" counter reflects real interest.
 */
export function PrivateProfileNotice({
  variant,
  gamerTag,
  targetUserId,
}: {
  variant: "private" | "not-found";
  gamerTag: string;
  /** Present only for the private variant. */
  targetUserId?: string;
}) {
  // Fire-once per mount (a ref, not state: no re-render needed).
  const loggedRef = useRef(false);

  useEffect(() => {
    if (variant !== "private" || !targetUserId || loggedRef.current) return;
    loggedRef.current = true;
    void visitPrivateProfile(targetUserId);
  }, [variant, targetUserId]);

  const Icon = variant === "private" ? LockIcon : UserQuestion01Icon;

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <HugeiconsIcon
            icon={Icon}
            size={24}
            strokeWidth={1.6}
            className="text-slate-400 dark:text-white/40"
          />
        </span>

        <h1 className="mt-5 text-lg font-semibold">
          {variant === "private"
            ? `@${gamerTag} joue en privé`
            : `@${gamerTag} n'existe pas (encore)`}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/45">
          {variant === "private"
            ? "Ce joueur a choisi de limiter son profil. Seules ses apparitions en partie restent publiques."
            : "Aucun profil de gameur ne porte ce tag pour le moment."}
        </p>

        <Link
          href="/games"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          Voir les jeux
        </Link>
      </div>
    </main>
  );
}
