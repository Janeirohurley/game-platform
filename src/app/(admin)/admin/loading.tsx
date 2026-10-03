import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/**
 * Admin dashboard fallback. Mirrors DashboardShell01's real layout:
 * KPI tiles, then the trend chart, then the recent-matches table.
 * This page runs seven queries sequentially over the WAN, so this
 * skeleton is on screen for several seconds — it has to look like the
 * dashboard, not like a generic grey box.
 */
export default function AdminDashboardLoading() {
  return (
    <LoadingRegion label="Chargement du tableau de bord…">
      <PageHeaderSkeleton titleWidth="w-72" />
      <StatGridSkeleton count={4} />
      <ChartSkeleton />
      <TableSkeleton
        columns={5}
        rows={8}
        cellWidths={["w-32", "w-24", "w-16", "w-24", "w-20"]}
      />
    </LoadingRegion>
  );
}