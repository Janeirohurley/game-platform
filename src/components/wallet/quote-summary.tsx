"use client";

import type { QuoteResponse } from "@/lib/wallet/api-client";
import { money } from "./wallet-shared";

/**
 * The "see fees before you confirm" card. Every number comes from the
 * server-side quote computed with the SAME schedule the operation
 * will use — what you see is exactly what is charged.
 */
export function QuoteSummary({ quote }: { quote: QuoteResponse }) {
  const isDeposit = quote.type === "deposit";
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground">Fee preview</span>
        <span className="text-xs text-muted-foreground">
          via {quote.providerName}
        </span>
      </div>
      <dl className="flex flex-col gap-1">
        <Row
          label={isDeposit ? "Credited to wallet" : "Delivered to recipient"}
          value={money(isDeposit ? quote.netAmount : quote.totalAmount, quote.currency)}
          strong
        />
        <Row label="Provider fee" value={money(quote.providerFee, quote.currency)} />
        <Row label="Platform fee" value={money(quote.platformFee, quote.currency)} />
        <Row label="Total fees" value={money(quote.totalFee, quote.currency)} />
        <Row
          label={isDeposit ? "Total you pay" : "Debited from wallet"}
          value={money(isDeposit ? quote.totalAmount : quote.netAmount, quote.currency)}
          strong
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between ${
        strong ? "font-medium" : "text-muted-foreground"
      }`}
    >
      <dt className={strong ? "" : ""}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
