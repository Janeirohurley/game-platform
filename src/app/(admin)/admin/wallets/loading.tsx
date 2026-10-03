import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/wallets fallback — heading, filter bar, 6-column table, pager. */
export default function AdminWalletsLoading() {
  return (
    <LoadingRegion label="Chargement des portefeuilles…">
      <PageHeaderSkeleton titleWidth="w-48" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={6}
        rows={10}
        cellWidths={["w-40", "w-24", "w-12", "w-24", "w-16", "w-24"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}