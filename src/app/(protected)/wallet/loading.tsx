import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionBarSkeleton,
  CardGridSkeleton,
  HeadlineSkeleton,
  LoadingRegion,
  PanelSkeleton,
  TabBarSkeleton,
} from "@/components/loading/skeletons";

/**
 * /wallet route fallback. Next streams it while the page's queries run
 * (session → overview → providers → accounts → history) plus every
 * adapter's availability check. Without it the protected layout stays
 * blank for the whole round-trip; with it the user sees the exact shape
 * of the page they are about to land on — title, tabs, balance card,
 * connected accounts — so nothing jumps when the data arrives.
 */
export default function WalletLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <LoadingRegion label="Chargement du portefeuille…">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <TabBarSkeleton count={4} />

        {/* Balance card — the "Overview" tab is what lands first. */}
        <div className="rounded-xl border p-6">
          <HeadlineSkeleton labelWidth="w-32" valueWidth="w-44" />
          <ActionBarSkeleton count={3} className="mt-6" />
        </div>

        {/* Connected accounts panel. */}
        <PanelSkeleton>
          <CardGridSkeleton count={2} className="xl:grid-cols-1" />
        </PanelSkeleton>
      </LoadingRegion>
    </div>
  );
}