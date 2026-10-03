import {
  DetailListSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/**
 * /admin/transactions/[id] fallback — three stacked panels: the
 * operation facts, its double-entry ledger lines, then the provider
 * webhook events.
 */
export default function AdminTransactionDetailLoading() {
  return (
    <LoadingRegion label="Chargement de la transaction…">
      <PageHeaderSkeleton titleWidth="w-64" />
      <PanelSkeleton>
        <DetailListSkeleton items={9} columns={3} />
      </PanelSkeleton>
      <PanelSkeleton>
        <TableSkeleton columns={3} rows={6} cellWidths={["w-40", "w-28", "w-32"]} />
      </PanelSkeleton>
      <PanelSkeleton lines={4} />
    </LoadingRegion>
  );
}
