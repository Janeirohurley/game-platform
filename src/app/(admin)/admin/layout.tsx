import type { ReactNode } from "react";
import { headers } from "next/headers";

import AdminHeader from "@/components/admin/admin-header";
import { auth } from "@/lib/auth";

/**
 * Shell INSIDE the authorized area: renders the admin chrome around
 * whatever page the section shows. The authorization itself lives in
 * the (admin) group layout — this layout only runs for admins.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div className="min-h-screen">
      <AdminHeader userName={session?.user.name ?? ""} isAdmin />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
