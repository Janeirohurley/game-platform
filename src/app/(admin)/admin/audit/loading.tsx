import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/audit fallback — action filter + the 7-column append-only log. */
export default function AdminAuditLoading() {
  return (
    <LoadingRegion label="Chargement du journal d'audit…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={7}
        rows={10}
        cellWidths={["w-32", "w-28", "w-32", "w-24", "w-40", "w-16", "w-32"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}