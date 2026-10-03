import {
  LoadingRegion,
  PageHeaderSkeleton,
  PaginationSkeleton,
  SearchBarSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/** /admin/gamers fallback — server-side search + paginated gamer rows. */
export default function AdminGamersLoading() {
  return (
    <LoadingRegion label="Chargement des gamers…">
      <PageHeaderSkeleton titleWidth="w-40" />
      <SearchBarSkeleton />
      <TableSkeleton
        columns={6}
        rows={10}
        cellWidths={["w-36", "w-24", "w-16", "w-20", "w-20", "w-24"]}
      />
      <PaginationSkeleton />
    </LoadingRegion>
  );
}