"use client";
import { Card, CardContent } from "@/components/ui/card";

import { Activity } from "lucide-react";

/**
 * Registry block, content-adapted: distinct gamers who actually played
 * this week (server-computed, no baseline percentage invented).
 */
export default function AdvertisementCost({
  label,
  value,
}: {
  label: string;
  value: number;
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
              </div>
            </div>
            <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
              <Activity size={16} />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
