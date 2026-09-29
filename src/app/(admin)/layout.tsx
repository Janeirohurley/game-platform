import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Server-side gate for the ENTIRE /admin section (this layout wraps
 * every admin route). Two layers, both here, both server-side:
 *
 *   1. no session at all        → /sign-in (same as (protected));
 *   2. session without the
 *      platform `admin` role    → an explicit forbidden screen, never a
 *                                 silent redirect: an authenticated user
 *                                 poking at /admin must SEE the refusal.
 *
 * The role is read from the Better Auth admin plugin (`user.role`) —
 * there is no client-side or env-based escape hatch.
 */
export default async function AdminSectionLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "admin") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
            Accès refusé
          </p>
          <h1 className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
            Espace administration
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-white/60">
            Cette section est réservée aux administrateurs de la plateforme.
            Ton compte ne dispose pas du rôle requis.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-black"
          >
            Retour au site
          </Link>
        </div>
      </main>
    );
  }

  return children;
}
