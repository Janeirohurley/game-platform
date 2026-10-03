import {
  LoadingRegion,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/rooms fallback — live Colyseus room list (5 columns). */
export default function AdminRoomsLoading() {
  return (
    <LoadingRegion label="Chargement des rooms…">
      <PageHeaderSkeleton titleWidth="w-56" />
      <TableSkeleton
        columns={5}
        rows={8}
        cellWidths={["w-40", "w-28", "w-20", "w-24", "w-32"]}
      />
    </LoadingRegion>
  );
}