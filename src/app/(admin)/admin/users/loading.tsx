import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/users fallback — toolbar (search + CSV) then the paginated table. */
export default function AdminUsersLoading() {
  return (
    <LoadingRegion label="Chargement des utilisateurs…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={5}
        rows={10}
        cellWidths={["w-40", "w-48", "w-20", "w-16", "w-28"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}