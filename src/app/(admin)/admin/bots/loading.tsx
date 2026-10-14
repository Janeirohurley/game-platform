import {
  LoadingRegion,
  PageHeaderSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/bots fallback — filters then the paginated bot table. */
export default function AdminBotsLoading() {
  return (
    <LoadingRegion label="Chargement des bots…">
      <PageHeaderSkeleton titleWidth="w-40" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={7}
        rows={8}
        cellWidths={["w-40", "w-16", "w-20", "w-20", "w-28", "w-20", "w-10"]}
      />
    </LoadingRegion>
  );
}
