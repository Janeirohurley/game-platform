"use client";

import type { ComponentProps } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { WalletApiError } from "@/lib/wallet/api-client";
import { formatMoney } from "@/lib/wallet/money";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

/**
 * One toast path for every wallet failure: the server's user-facing
 * message (never an internal one — errors.ts guarantees that) with a
 * special case for rate limits so the wording stays honest.
 */
export function showWalletError(error: unknown): void {
  if (error instanceof WalletApiError) {
    if (error.code === "rate_limited") {
      toast.error("Too many requests — wait a moment and try again.");
      return;
    }
    toast.error(error.message);
    return;
  }
  toast.error("Something went wrong. Please try again.");
}

/** Exact integer formatting with locale grouping + currency code. */
export function money(minor: number, currency: string): string {
  try {
    return formatMoney(minor, currency);
  } catch {
    return `${minor} ${currency}`;
  }
}

/**
 * Signed display amount. Direction is read from the wallet's own
 * ledger delta when the row carries one (a `payout` or a stake
 * `refund` credit the wallet; a deposit `refund` debits it), so the
 * sign never has to be guessed from the type. Legacy rows without a
 * delta fall back to the old type rule.
 */
export function signedMoney(
  tx: { type: string; grossAmount: number; walletDeltaMinor?: number },
  currency: string,
): string {
  const delta =
    typeof tx.walletDeltaMinor === "number"
      ? tx.walletDeltaMinor
      : tx.type === "deposit"
        ? tx.grossAmount
        : -tx.grossAmount;
  if (delta === 0) return money(tx.grossAmount, currency);
  return `${delta > 0 ? "+" : "−"}${money(Math.abs(delta), currency)}`;
}

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  created: { label: "Created", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  processing: { label: "Processing", variant: "secondary" },
  succeeded: { label: "Succeeded", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
  refunded: { label: "Refunded", variant: "outline" },
  reversed: { label: "Reversed", variant: "outline" },
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const meta = STATUS_META[status] ?? {
    label: status,
    variant: "outline" as BadgeVariant,
  };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const TYPE_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  payment: "Payment",
  refund: "Refund",
  reversal: "Reversal",
  stake: "Stake",
  payout: "Payout",
  adjustment: "Adjustment",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function formatDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
