import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

/**
 * Loading primitives shaped like the REAL wallet/admin layouts.
 *
 * The rule this kit follows: a skeleton must occupy the same box as the
 * content it stands in for. A placeholder that is a different height
 * than the final row turns every navigation into a visible jump, which
 * feels slower than no loading UI at all. So each primitive here mirrors
 * one concrete screen section (page header, stat grid, table, card grid,
 * chart, form) and only that — pages compose them by hand in their
 * `loading.tsx` instead of sharing one vague grey box.
 */

/**
 * Wrapper for any loading surface. Announces the wait to screen readers
 * (the skeleton itself is aria-hidden decoration) and gives tests /
 * components a single `data-loading` hook to assert on.
 */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-loading="true"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      className={cn("space-y-6", className)}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** One line of body text. `width` keeps paragraphs from all looking equal. */
export function SkeletonLine({
  width = "w-full",
  className,
}: {
  width?: string;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn("h-4 rounded-md", width, className)}
      aria-hidden
    />
  );
}

/** `<h1>` + the sentence under it — the head of every admin page. */
export function PageHeaderSkeleton({
  titleWidth = "w-56",
  descriptionLines = 2,
}: {
  titleWidth?: string;
  descriptionLines?: number;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-7 font-heading", titleWidth)} aria-hidden />
      {Array.from({ length: descriptionLines }, (_, index) => (
        <SkeletonLine
          key={index}
          width={index === descriptionLines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

/** Segmented control (the wallet's 4 tabs, filter pills). */
export function TabBarSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex w-full gap-2 sm:w-auto", className)}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-9 flex-1 rounded-lg sm:w-28 sm:flex-none")}
        />
      ))}
    </div>
  );
}

/** One KPI/stat tile. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-xl border p-5", className)}
      aria-hidden
    >
      <SkeletonLine width="w-24" />
      <Skeleton className="h-8 w-32" />
      <SkeletonLine width="w-20" />
    </div>
  );
}

/** Row of KPI tiles — `columns` mirrors the real responsive grid. */
export function StatGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <StatCardSkeleton key={index} />
      ))}
    </div>
  );
}

/** The big hero number (wallet balance, single headline metric). */
export function HeadlineSkeleton({
  labelWidth = "w-32",
  valueWidth = "w-44",
  className,
}: {
  labelWidth?: string;
  valueWidth?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-hidden>
      <SkeletonLine width={labelWidth} />
      <Skeleton className={cn("h-9", valueWidth)} />
    </div>
  );
}

/** A labelled input/select row (deposit form, admin filters). */
export function FieldSkeleton({
  labelWidth = "w-24",
  fieldWidth = "w-full",
}: {
  labelWidth?: string;
  fieldWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      <SkeletonLine width={labelWidth} className="h-3" />
      <Skeleton className={cn("h-9 rounded-lg", fieldWidth)} />
    </div>
  );
}

/** Vertical stack of form fields + a submit button. */
export function FormSkeleton({
  fields = 3,
  className,
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)} aria-hidden>
      {Array.from({ length: fields }, (_, index) => (
        <FieldSkeleton key={index} />
      ))}
      <Skeleton className="h-9 w-40 rounded-lg" />
    </div>
  );
}

/** Primary action button pair (Add money / Withdraw / Refresh). */
export function ActionBarSkeleton({
  count = 2,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className="h-9 w-28 rounded-lg" />
      ))}
    </div>
  );
}

/**
 * Table with a header row and `rows` body rows. Cells vary in width on
 * purpose (see the real tables: name column wide, status narrow) so the
 * skeleton reads as the same table once data lands.
 */
export function TableSkeleton({
  columns = 5,
  rows = 8,
  cellWidths,
  className,
}: {
  columns?: number;
  rows?: number;
  /** Per-column widths, cycled down the rows. Defaults to a text-like mix. */
  cellWidths?: readonly string[];
  className?: string;
}) {
  const defaults = [
    "w-32",
    "w-20",
    "w-16",
    "w-24",
    "w-12",
    "w-20",
    "w-16",
  ];
  const widths = cellWidths ?? defaults;

  return (
    <div className={cn("overflow-hidden rounded-lg border", className)} aria-hidden>
      <div className="flex items-center gap-4 border-b bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }, (_, column) => (
          <Skeleton
            key={column}
            className={cn("h-3", widths[column % widths.length])}
          />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={cn(
                  "h-4",
                  // Stagger the last column so rows don't look like a barcode.
                  widths[(column + row) % widths.length],
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A bordered card (one provider, one room, one LiveKit room). */
export function CardSkeleton({
  className,
  lines = 3,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-xl border p-6", className)} aria-hidden>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <SkeletonLine width="w-28" className="h-3" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine
          key={index}
          width={index === lines - 1 ? "w-2/3" : "w-full"}
        />
      ))}
    </div>
  );
}

/** Responsive card grid (providers, rooms). */
export function CardGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 xl:grid-cols-2", className)} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Chart / plot area (admin dashboard trend chart). */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-72 w-full flex-col justify-end gap-3 rounded-xl border p-5",
        className,
      )}
      aria-hidden
    >
      <div className="flex h-40 items-end gap-2">
        {[45, 70, 35, 85, 55, 75, 40, 65, 50, 80].map((height, index) => (
          <Skeleton
            key={index}
            className="flex-1 rounded-t-md"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex gap-3">
        <SkeletonLine width="w-24" className="h-3" />
        <SkeletonLine width="w-16" className="h-3" />
      </div>
    </div>
  );
}

/** Definition list of label/value pairs (transaction detail, gamer profile). */
export function DetailListSkeleton({
  items = 6,
  columns = 3,
  className,
}: {
  items?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <SkeletonLine width="w-20" className="h-3" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}

/**
 * Card wrapper for a detail section. Give it either `lines` (generic
 * body) or `children` (compose exact sub-skeletons).
 */
export function PanelSkeleton({
  lines,
  children,
  className,
}: {
  lines?: number;
  children?: ReactNode;
  className?: string;
}) {
  const body =
    children ??
    Array.from({ length: lines ?? 3 }, (_, index) => (
      <SkeletonLine
        key={index}
        width={index === (lines ?? 3) - 1 ? "w-2/3" : "w-full"}
      />
    ));

  return (
    <section
      className={cn("flex flex-col gap-4 rounded-xl border p-6", className)}
      aria-hidden
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-44" />
        <SkeletonLine width="w-64" className="h-3" />
      </div>
      {body}
    </section>
  );
}

/** Pagination row under a table/list. */
export function PaginationSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center justify-between gap-3", className)}
      aria-hidden
    >
      <SkeletonLine width="w-40" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-20 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Search box + submit button (admin list toolbars). */
export function SearchBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} aria-hidden>
      <Skeleton className="h-9 w-full rounded-lg sm:w-72" />
      <Skeleton className="h-9 w-24 rounded-lg" />
    </div>
  );
}