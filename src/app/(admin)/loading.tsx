import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI for the WHOLE /admin section. Next streams this
 * while a page's server components resolve (auth + Postgres over the
 * internet), so sidebar navigation always shows visible progress instead
 * of a frozen screen — and the shell stays mounted during navigation.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
