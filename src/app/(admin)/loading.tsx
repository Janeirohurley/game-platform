import {
  ChartSkeleton,
  LoadingRegion,
  PageHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/loading/skeletons";

/**
 * /admin route fallback — the safety net for the section. Every admin
 * page that ships its own `loading.tsx` overrides this with the exact
 * shape of that screen; this generic one covers anything added later.
 *
 * It matters because the admin queries are 0.5–2 s each over the WAN
 * (Supabase transaction pooler) and the dashboard runs seven SEQUENTIALLY
 * — see the note in admin/page.tsx. Without a streamed fallback the user
 * gets a frozen shell; with it, a page-shaped pulse.
 *
 * No padding wrapper: AdminShell's <main> already provides it, and a
 * double padding would offset the fallback from the real page.
 */
export default function AdminLoading() {
  return (
    <LoadingRegion label="Chargement de l'administration…">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <ChartSkeleton />
      <TableSkeleton columns={5} rows={8} />
    </LoadingRegion>
  );
}