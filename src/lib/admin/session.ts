import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

/**
 * Page-level admin guard. The (admin) layout already shows the
 * forbidden screen and redirects anonymous visitors, but Next can
 * still embed a pre-rendered RSC payload in that redirect response —
 * so EVERY admin page must call this FIRST, before touching any data.
 * A redirect emitted by the page itself carries no page content, which
 * is what actually keeps the metrics out of unauthorized responses.
 *
 * Returns the (typed) session for the page to use.
 */
export async function requireAdminSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.role !== "admin") {
    // The layout renders the forbidden screen; the page adds nothing.
    redirect("/admin");
  }

  return session;
}
