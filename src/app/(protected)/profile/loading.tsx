import { Skeleton } from "@/components/ui/skeleton";
import {
  CardGridSkeleton,
  LoadingRegion,
  PanelSkeleton,
  StatGridSkeleton,
  TabBarSkeleton,
} from "@/components/loading/skeletons";

/**
 * /profile route fallback. The profile page resolves the gamer profile,
 * its stats and the account owner before the client component mounts, so
 * this mirrors the header + stats strip + tabbed panels it will render.
 */
export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <LoadingRegion label="Chargement du profil…">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        <StatGridSkeleton count={4} className="mt-6 xl:grid-cols-4" />
        <TabBarSkeleton count={3} className="mt-6 sm:w-auto" />

        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col gap-6">
            <PanelSkeleton lines={4} />
            <PanelSkeleton lines={4} />
          </div>
          <CardGridSkeleton count={2} className="content-start xl:grid-cols-1" />
        </div>
      </LoadingRegion>
    </div>
  );
}