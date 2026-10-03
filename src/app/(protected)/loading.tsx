import { Skeleton } from "@/components/ui/skeleton";
import { LoadingRegion } from "@/components/loading/skeletons";

/**
 * Generic fallback for the whole /protected group (session already
 * resolved at the layout level). Route-specific skeletons
 * (`wallet/loading.tsx`, `profile/loading.tsx`) take precedence — this
 * one is the safety net so an authenticated user NEVER stares at a
 * blank screen while a page resolves.
 */
export default function ProtectedLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <LoadingRegion label="Chargement…">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </LoadingRegion>
    </div>
  );
}