import {
  FormSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/reconciliation fallback — "run a check" form, filters, findings. */
export default function AdminReconciliationLoading() {
  return (
    <LoadingRegion label="Chargement de la réconciliation…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <FormSkeleton fields={3} />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={7}
        rows={10}
        cellWidths={["w-32", "w-36", "w-24", "w-16", "w-16", "w-28", "w-12"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}