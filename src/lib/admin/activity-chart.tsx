import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityDay {
  date: string;
  label: string;
  count: number;
}

/**
 * Matches per day over the last 7 days — plain flexbox bars, no chart
 * library. Bars scale against the week's peak; empty days stay visible
 * (2px stub) so quiet periods read as quiet instead of missing. The
 * value above each bar is the only label that matters to an operator.
 */
export function WeeklyMatchActivityChart({ data }: { data: ActivityDay[] }) {
  const peak = Math.max(...data.map((day) => day.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matchs — 7 derniers jours</CardTitle>
        <CardDescription>
          Résultats ingérés par jour (heure locale du serveur).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {data.map((day) => {
            const height = Math.max(2, Math.round((day.count / peak) * 100));
            return (
              <div
                key={day.date}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {day.count}
                </span>
                <div
                  className={
                    day.count > 0
                      ? "w-full rounded-t-md bg-primary/80"
                      : "w-full rounded-t-md bg-muted"
                  }
                  style={{ height: `${height}%` }}
                  role="img"
                  aria-label={`${day.label} : ${day.count} match${day.count > 1 ? "s" : ""}`}
                />
                <span className="truncate text-[0.7rem] text-muted-foreground">
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
