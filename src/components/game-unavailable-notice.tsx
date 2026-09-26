import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Server-rendered gate for games whose registry status is not "live":
 * shown instead of the play/join flows so a game in development cannot
 * be reached, even by typing the URL directly.
 */
export function GameUnavailableNotice({
  gameTitle,
  backHref,
  backLabel = "Retour au catalogue",
}: {
  gameTitle: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <section
      aria-label="Jeu indisponible"
      className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-6 py-10 text-center"
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15">
        <HugeiconsIcon
          icon={Clock01Icon}
          size={28}
          strokeWidth={1.6}
          className="text-amber-500"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-300">
          En développement
        </p>
        <h1 className="mt-2 text-xl font-semibold">{gameTitle}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/50">
          Ce jeu n&apos;est pas encore ouvert au public. Reviens bientôt —
          il apparaîtra dans le catalogue dès qu&apos;il sera prêt.
        </p>
      </div>

      <Link
        href={backHref}
        className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} strokeWidth={1.8} />
        {backLabel}
      </Link>
    </section>
  );
}
