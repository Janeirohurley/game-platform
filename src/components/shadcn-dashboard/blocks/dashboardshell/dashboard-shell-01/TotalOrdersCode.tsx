"use client";

import { CardContent, Card } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Swords } from "lucide-react";

/**
 * Registry block, content-adapted: the tile shows a REAL weekly metric.
 * The trend badge renders the computed week-over-week change (nothing
 * displayed when there is no previous-week baseline).
 */
export default function TotalOrders({
  label,
  value,
  changePercent,
}: {
  label: string;
  value: number;
  changePercent: number | null;
}) {
  return (
    <Card className="py-6 h-full gap-0">
      <CardContent className="flex justify-between flex-row px-6">
        <div className="flex flex-col items-start gap-4 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-normal text-foreground">{label}</p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-semibold tabular-nums">
                  {value.toLocaleString("fr-FR")}
                </h3>
                {changePercent !== null && (
                  <Badge
                    className={
                      changePercent >= 0
                        ? "bg-chart-2/10! text-chart-2!"
                        : "bg-destructive/10! text-destructive!"
                    }
                  >
                    {changePercent >= 0 ? "+" : ""}
                    {changePercent}%
                  </Badge>
                )}
              </div>
            </div>
            <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <Swords size={16} />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
