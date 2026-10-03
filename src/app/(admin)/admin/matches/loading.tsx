import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/matches fallback — filters (search + game + outcome) then rows. */
export default function AdminMatchesLoading() {
  return (
    <LoadingRegion label="Chargement des matchs…">
      <PageHeaderSkeleton titleWidth="w-40" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={6}
        rows={10}
        cellWidths={["w-36", "w-24", "w-16", "w-20", "w-24", "w-16"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}