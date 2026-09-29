"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { signOut } from "@/lib/auth-client";

const adminNavigation = [
  { label: "Tableau de bord", href: "/admin" },
];

/**
 * The admin shell header. Deliberately plain: a control plane, not a
 * landing page — same slate palette and dark-mode treatment as the
 * public navbar, without the 3D dice.
 */
export default function AdminHeader({
  userName,
  isAdmin,
}: {
  userName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();

  return (
    <header className="border-b border-slate-200 dark:border-white/10">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="text-sm font-semibold tracking-wide text-slate-950 dark:text-white"
          >
            Game Arena <span className="text-slate-400">/ Admin</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex" aria-label="Admin">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-slate-500 transition-colors hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-slate-500 dark:text-white/60 sm:inline">
            {userName}
            {isAdmin ? (
              <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5 text-xs dark:border-white/15">
                admin
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              void signOut().then(() => router.push("/"));
            }}
            className="text-slate-500 transition-colors hover:text-slate-950 dark:text-white/60 dark:hover:text-white"
          >
            Déconnexion
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/15 dark:text-white/80 dark:hover:bg-white/5"
          >
            Voir le site
          </Link>
        </div>
      </div>
    </header>
  );
}
