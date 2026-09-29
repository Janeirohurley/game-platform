import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldAlertIcon } from "lucide-react";

import { AdminShell } from "@/components/admin/admin-shell";
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
        <div className="flex w-full max-w-md flex-col items-center rounded-xl bg-card p-8 text-center text-card-foreground ring-1 ring-foreground/10">
          <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldAlertIcon className="size-5" />
          </div>
          <h1 className="mt-4 font-heading text-lg font-medium">
            Espace administration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette section est réservée aux administrateurs de la plateforme.
            Ton compte ne dispose pas du rôle requis.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Retour au site
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AdminShell
      userName={session.user.name}
      userEmail={session.user.email}
    >
      {children}
    </AdminShell>
  );
}
