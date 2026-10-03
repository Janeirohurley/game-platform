import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/transactions fallback — filter bar + the 7-column ledger view. */
export default function AdminTransactionsLoading() {
  return (
    <LoadingRegion label="Chargement des transactions…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={7}
        rows={10}
        cellWidths={["w-32", "w-36", "w-20", "w-24", "w-28", "w-16", "w-12"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}
