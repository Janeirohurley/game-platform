/**
 * Server-startup environment report.
 *
 * `register` runs once per server instance — on serverless, once per cold
 * start — so a misconfigured variable shows up in the deploy logs before
 * anyone clicks the microphone. The alternative is learning about it from
 * an unexplained `503` on `/api/livekit/token` minutes later, which is
 * exactly how the trailing-slash outage reached production.
 *
 * Advisory, never fatal. The runtime already normalizes what it can
 * repair, so a value like `https://host/` keeps the app working; killing
 * the process over it would turn a warning into an outage. Failing the
 * boot belongs to a deploy-time check scoped to production, where the
 * blast radius is one rejected deploy instead of every request.
 */
export async function register(): Promise<void> {
  // `register` runs in every runtime, and `process.env` does not exist in
  // the edge one.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { inspectRealtimeServerUrl } = await import(
    "./lib/realtime/server-url"
  );

  for (const issue of inspectRealtimeServerUrl(
    process.env.REALTIME_SERVER_URL,
  )) {
    console.error(
      `[env] REALTIME_SERVER_URL ${issue.detail} (${issue.code})`,
    );
  }
}
