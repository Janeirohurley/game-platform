/**
 * Admin presentation helpers — pure functions, no dependencies. Kept
 * out of the queries module so data access stays free of formatting.
 */

/** `125 → « 2:05 »`, zero renders as « — » (duration unknown). */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—";
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const relativeFormat = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** Relative French time — « à l'instant », « il y a 5 minutes », « hier »… */
export function formatRelativeTime(date: Date, now = new Date()): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
  ];

  let value = diffSeconds;
  for (const [unit, span] of divisions) {
    if (Math.abs(value) < span) {
      return relativeFormat.format(value, unit);
    }
    value = Math.round(value / span);
  }
  return relativeFormat.format(value, "week");
}
