"use client";
import OverviewTab from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/OverviewTabCode";
import UpdateBanner from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/UpdateBannerCode";
import TotalSales, {
  type PlatformTrendData,
} from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/TotalSalesCode";
import TotalOrders from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/TotalOrdersCode";
import TotalProfit from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/TotalProfitCode";
import AdvertisementCost from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/AdvertisementCostCode";
import TotalAssets from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/AssetsBlockCode";
import ProjectsOrders from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/ProjectsOrdersCode";
import type { AdminRecentMatch } from "@/lib/admin/queries";

/**
 * Registry block, content-adapted: the block's ORIGINAL grid layout is
 * untouched — only the data feeding each tile is injected by the admin
 * server page.
 */
const DashboardShell01 = ({
  userName,
  overview,
  weekly,
  weeklyAccounts,
  activeGamers,
  trend,
  recentMatches,
}: {
  userName: string;
  overview: {
    totalUsers: number;
    totalGamers: number;
    totalGames: number;
    totalMatches: number;
  };
  weekly: { matches: number; matchesLastWeek: number; changePercent: number | null };
  weeklyAccounts: { accounts: number; changePercent: number | null };
  activeGamers: number;
  trend: PlatformTrendData;
  recentMatches: AdminRecentMatch[];
}) => {
  return (
    <div className="w-full contain-layout max-w-7xl mx-auto py-6" id="dashboard-shell-01">
        <div className="grid grid-cols-12 gap-4 p-0 bg-transparent">
          <div className="col-span-12">
            <OverviewTab userName={userName} />
          </div>
          {/* Self-hides when there is no week-over-week movement. */}
          <div className="col-span-12">
            <UpdateBanner
              matchesThisWeek={weekly.matches}
              matchesLastWeek={weekly.matchesLastWeek}
            />
          </div>
          <div className="lg:col-span-7 col-span-12">
            <TotalSales data={trend} />
          </div>
          <div className="lg:col-span-5 col-span-12">
            <TotalAssets
              totalUsers={overview.totalUsers}
              totalGamers={overview.totalGamers}
              totalGames={overview.totalGames}
              totalMatches={overview.totalMatches}
            />
          </div>
          <div className="lg:col-span-4 col-span-12">
            <TotalOrders
              label="Matchs cette semaine"
              value={weekly.matches}
              changePercent={weekly.changePercent}
            />
          </div>
          <div className="lg:col-span-4 col-span-12">
            <TotalProfit
              label="Nouveaux comptes"
              value={weeklyAccounts.accounts}
              changePercent={weeklyAccounts.changePercent}
            />
          </div>
          <div className="lg:col-span-4 col-span-12">
            <AdvertisementCost label="Joueurs actifs (7 j)" value={activeGamers} />
          </div>
          <div className="col-span-12">
            <ProjectsOrders matches={recentMatches} />
          </div>
        </div>
    </div>
  );
}

export default DashboardShell01
