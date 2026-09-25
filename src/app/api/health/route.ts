import { NextResponse } from "next/server";

/**
 * Liveness probe for the container orchestrator.
 *
 * Deliberately cheap: it answers as soon as the Next.js server is accepting
 * requests and never touches the database, so a slow Postgres cannot make the
 * whole container look dead.
 *
 * GET /api/health → { status: "ok" }
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
