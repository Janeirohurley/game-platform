import {
  DetailListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/**
 * /admin/gamers/[username] fallback — identity card + 4-stat strip, then
 * the per-game leaderboard. The detail page fans out over the gamer's
 * whole history, so it is one of the slower admin screens.
 */
export default function AdminGamerDetailLoading() {
  return (
    <LoadingRegion label="Chargement du profil gamer…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <PanelSkeleton>
        <DetailListSkeleton items={4} columns={4} />
      </PanelSkeleton>
      <PanelSkeleton>
        <TableSkeleton
          columns={7}
          rows={8}
          cellWidths={["w-32", "w-16", "w-20", "w-16", "w-16", "w-20", "w-24"]}
        />
      </PanelSkeleton>
      <PanelSkeleton lines={4} />
    </LoadingRegion>
  );
}