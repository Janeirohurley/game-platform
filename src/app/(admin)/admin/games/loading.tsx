import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/games fallback — the 11-column game leaderboard. */
export default function AdminGamesLoading() {
  return (
    <LoadingRegion label="Chargement des jeux…">
      <PageHeaderSkeleton titleWidth="w-32" />
      <TableSkeleton
        columns={8}
        rows={10}
        cellWidths={["w-32", "w-24", "w-16", "w-16", "w-16", "w-20", "w-24", "w-16"]}
      />
    </LoadingRegion>
  );
}