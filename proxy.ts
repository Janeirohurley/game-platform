import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  /*
   * A proxy/middleware runs in the Edge-ish runtime BEFORE any request
   * context exists, so `headers()` from `next/headers` is illegal here
   * (it crashed the module and would take down the whole section).
   * The incoming request's own headers carry the session cookie.
   */
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    const signInUrl = new URL("/sign-in", request.url);

    signInUrl.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname,
    );

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/settings/:path*",
    "/account/:path*",
    "/play/:path*",
    "/admin/:path*"
  ],
};