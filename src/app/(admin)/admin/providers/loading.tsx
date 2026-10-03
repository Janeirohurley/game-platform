import {
  CardGridSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/loading/skeletons";

/**
 * /admin/providers fallback — the effective-config card grid. Cards (not a
 * table) because each provider renders a header, capability chips, a
 * fact grid and an action footer.
 */
export default function AdminProvidersLoading() {
  return (
    <LoadingRegion label="Chargement des fournisseurs de paiement…">
      <PageHeaderSkeleton titleWidth="w-80" />
      <CardGridSkeleton count={4} />
    </LoadingRegion>
  );
}