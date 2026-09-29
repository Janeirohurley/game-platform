'use client'
import { CardContent, Card } from '@/components/ui/card';

/**
 * Registry block, content-adapted: a REAL status line. Shown only when
 * there is a meaningful weekly movement to report — otherwise the
 * banner disappears entirely instead of announcing fake growth.
 */
export default function UpdateBanner({
  matchesThisWeek,
  matchesLastWeek,
}: {
  matchesThisWeek: number;
  matchesLastWeek: number;
}) {
  const diff = matchesThisWeek - matchesLastWeek;
  if (diff === 0) return null;

  const up = diff > 0;
  return (
    <Card className="py-3 h-full gap-0">
      <CardContent className="flex items-center flex-wrap justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-chart-1 animate-ping absolute inline-flex" />
            <span className="h-2 w-2 rounded-full bg-chart-1 absolute inline-flex" />
            <p className="text-sm font-medium ps-4">Activité</p>
            <span className="w-1 h-1 rounded-full bg-border" />
            <p className="text-sm font-normal text-muted-foreground">
              7 derniers jours vs 7 précédents
            </p>
          </div>
          <p className="text-sm font-normal">
            {up ? '+' : ''}
            {diff} match{Math.abs(diff) > 1 ? 's' : ''} sur la semaine
            {up ? (
              <span className="text-emerald-600"> en hausse</span>
            ) : (
              <span className="text-destructive"> en baisse</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
