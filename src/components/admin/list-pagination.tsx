import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Server-side list pagination for admin pages: every page is a link
 * (URL-driven, linkable, back-button friendly) and the totals come
 * from the SQL count, never from the array length.
 */
export function ListPagination({
  page,
  totalPages,
  total,
  buildHref,
  noun = "élément",
}: {
  page: number;
  totalPages: number;
  total: number;
  buildHref: (page: number) => string;
  noun?: string;
}) {
  if (totalPages <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        {total.toLocaleString("fr-FR")} {noun}
        {total > 1 ? "s" : ""} au total.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {total.toLocaleString("fr-FR")} {noun}
        {total > 1 ? "s" : ""} au total
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button size="sm" variant="outline" render={<Link href={buildHref(page - 1)} />}>
            Précédent
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Précédent
          </Button>
        )}
        <span className="tabular-nums">
          Page {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Button size="sm" variant="outline" render={<Link href={buildHref(page + 1)} />}>
            Suivant
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            Suivant
          </Button>
        )}
      </div>
    </div>
  );
}
