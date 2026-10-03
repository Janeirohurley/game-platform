import {
  CardGridSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
} from "@/components/loading/skeletons";

/**
 * /admin/livekit fallback — one card per active room, each holding a
 * participant table. LiveKit rooms are fetched from the server over the
 * network, so the wait can be long enough to need a real placeholder.
 */
export default function AdminLivekitLoading() {
  return (
    <LoadingRegion label="Chargement des rooms LiveKit…">
      <PageHeaderSkeleton titleWidth="w-40" />
      <CardGridSkeleton count={2} className="xl:grid-cols-1" />
    </LoadingRegion>
  );
}