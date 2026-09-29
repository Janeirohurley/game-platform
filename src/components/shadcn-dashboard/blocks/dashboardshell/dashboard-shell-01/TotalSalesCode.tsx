"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Line, LineChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { CardHeader, CardContent,Card, CardTitle } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Dashboard data, injected by the server page. Same metric-shape as the
 * block's original e-commerce demo, but every value comes from our
 * admin queries — matches and accounts per day, with the span total and
 * its real change vs the previous span.
 */
export interface PlatformTrendPeriod {
  rows: { date: string; label: string; matches: number; accounts: number }[];
  total: number;
  changePercent: number | null;
}

export interface PlatformTrendData {
  periods: Record<
    "Last 7 Days" | "Last 30 Days" | "Last 90 Days",
    PlatformTrendPeriod
  >;
}

const chartConfig = {
  newUser: { label: "Matchs", color: "var(--color-primary)" },
  existingUser: { label: "Nouveaux comptes", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

const periodOptions = ["Last 7 Days", "Last 30 Days", "Last 90 Days"];
const periodLabels: Record<string, string> = {
  "Last 7 Days": "7 derniers jours",
  "Last 30 Days": "30 derniers jours",
  "Last 90 Days": "90 derniers jours",
};

function useAnimatedNumber(target: number, duration = 450) {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const from = currentRef.current;
    const diff = target - from;
    if (diff === 0) return;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + diff * eased);
      currentRef.current = next;
      setDisplay(next);
      if (progress < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { currentRef.current = target; setDisplay(target); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return display;
}

function AnimatedValue({ value }: { value: number }) {
  const animated = useAnimatedNumber(value);
  return <>{animated.toLocaleString()}</>;
}

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string; type?: string };
type ConfigEntry = { label?: string; color?: string };

function AnimatedTooltipContent({ active, payload, label, hideLabel = false, config }: {
  active?: boolean; payload?: TooltipItem[]; label?: string;
  hideLabel?: boolean; config?: Record<string, ConfigEntry>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((item) => item.type !== "none" && item.value !== undefined);
  if (!items.length) return null;
  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {!hideLabel && label && <div className="font-medium">{label}</div>}
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <div key={index} className="flex w-full items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            <span className="text-muted-foreground">{config?.[item.dataKey ?? ""]?.label ?? item.name}</span>
            <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
              <AnimatedValue value={item.value as number} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type TrendPeriodKey = keyof PlatformTrendData["periods"];

export default function TotalSales({
  data,
}: {
  data: PlatformTrendData;
}) {
  const [period, setPeriod] = useState<TrendPeriodKey>(periodOptions[0] as TrendPeriodKey);

  // Real platform series for the selected span — the per-day rows keep
  // the block's original field names so its chart logic is untouched.
  const periodData = data.periods[period];
  const chartData = periodData.rows.map((day) => ({
    date: day.label,
    newUser: day.matches,
    existingUser: day.accounts,
  }));
  const visibleLabels = new Set(chartData.map((row) => row.date));
  const peak = Math.max(...chartData.map((row) => Math.max(row.newUser, row.existingUser)), 1);
  const yTicks = [0, Math.round(peak / 3), Math.round((2 * peak) / 3), peak];
  const lastLabel = chartData.at(-1)?.date;
  const change = periodData.changePercent;

  return (
    <Card className="flex flex-col h-full">
      {/* Header */}
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-muted-foreground" />
          <CardTitle className="text-sm font-medium text-foreground">Activité de la plateforme</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Stats row + period selector */}
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-base font-normal text-foreground leading-6">Matchs sur la période</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xl font-semibold tracking-[-0.3px] text-foreground leading-8">
                {periodData.total.toLocaleString("fr-FR")}
              </span>
              {change === null ? (
                <span className="text-sm font-normal text-muted-foreground">pas de base de comparaison</span>
              ) : (
                <span className={change >= 0 ? "text-sm font-medium text-chart-2" : "text-sm font-medium text-destructive"}>
                  {change >= 0 ? "+" : ""}{change}%
                </span>
              )}
              <span className="text-sm font-normal text-muted-foreground">vs période précédente</span>
            </div>
          </div>

          <Select
            value={period}
            onValueChange={(v) => {
              if (v === "Last 7 Days" || v === "Last 30 Days" || v === "Last 90 Days") {
                setPeriod(v);
              }
            }}
          >
            <SelectTrigger className="h-auto! w-fit text-sm font-medium text-foreground border-border shadow-[0px_1px_2px_rgba(0,0,0,0.05)] cursor-pointer gap-1.5 px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((opt) => (
                <SelectItem key={opt} value={opt} className="cursor-pointer">
                  {periodLabels[opt] ?? opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[215px]! w-full">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 20, bottom: 0, left: -20 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(v) => (visibleLabels.has(v) ? v : "")}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              ticks={yTicks}
              domain={[0, peak]}
              tickFormatter={(v) => (v === 0 ? "0" : `${v}k`)}
            />
            <ChartTooltip
              cursor={{
                stroke: "var(--border)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
              content={<AnimatedTooltipContent config={chartConfig} />}
            />
            <ReferenceLine
              x={lastLabel ?? ""}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* New User — solid primary */}
            <Line
              dataKey="newUser"
              type="linear"
              stroke="var(--color-primary)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 0 }}
              isAnimationActive
              animationBegin={0}
              animationDuration={700}
              animationEasing="ease-out"
            />
            {/* Existing User — dashed muted */}
            <Line
              dataKey="existingUser"
              type="linear"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, fill: "var(--muted-foreground)", strokeWidth: 0 }}
              isAnimationActive
              animationBegin={120}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
