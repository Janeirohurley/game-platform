import { cn } from "cn";

/**
 * A skeleton that reads as "loading" instead of "broken": the base
 * `animate-pulse` from the shadcn Skeleton, plus a highlight that sweeps
 * left-to-right. Use it for placeholders (unknown content) and for
 * REFRESHING content (known content, new numbers on the way) — in the
 * second case the sweep tells the user the values they see are stale
 * without blanking the screen.
 */
function Shimmer({
  className,
  sweep = true,
  ...props
}: React.ComponentProps<"div"> & { sweep?: boolean }) {
  return (
    <div
      data-slot="shimmer-sweep"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {sweep && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
        />
      )}
      {props.children}
    </div>
  );
}

export { Shimmer };