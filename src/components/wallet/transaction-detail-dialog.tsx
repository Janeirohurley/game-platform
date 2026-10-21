"use client";

import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  walletApi,
  WalletApiError,
  type TransactionDetailResponse,
} from "@/lib/wallet/api-client";
import {
  formatDateTime,
  money,
  shortId,
  signedMoney,
  StatusBadge,
  typeLabel,
} from "./wallet-shared";

type Props = {
  transactionId: string | null;
  onClose: () => void;
  /** Fired after a successful refresh (table reload). */
  onChanged: () => void;
};

/**
 * Full audit view of one transaction: amounts + explicit fees and the
 * double-entry ledger legs. Internal movements are final the instant
 * they post, so this view is read-only.
 *
 * Fetched state is KEYED by transaction id and only written from async
 * callbacks — switching transactions can never show a previous
 * transaction's data, and no effect sets state synchronously.
 */
export function TransactionDetailDialog({
  transactionId,
  onClose,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<{
    id: string;
    data: TransactionDetailResponse;
  } | null>(null);
  const [loadError, setLoadError] = useState<{ id: string; message: string } | null>(
    null,
  );

  const load = useCallback((id: string) => {
    walletApi
      .detail(id)
      .then((data) => {
        setDetail({ id, data });
        setLoadError(null);
      })
      .catch((error) => {
        if (error instanceof WalletApiError) {
          setLoadError({ id, message: error.message });
        }
        });
  }, []);

  // Fetch on open.
  useEffect(() => {
    if (transactionId) load(transactionId);
  }, [transactionId, load]);

  const current =
    detail && transactionId && detail.id === transactionId ? detail.data : null;
  const errorMessage =
    loadError && loadError.id === transactionId ? loadError.message : null;
  const loading = !!transactionId && !current && !errorMessage;
  const tx = current?.transaction ?? null;

  // The wallet's own ledger delta is the only reliable direction for
  // the headline amount (a payout or stake refund credits the wallet;
  // a withdrawal debits it).
  const walletDeltaMinor = current
    ? current.ledger
        .filter((entry) => entry.walletId === tx?.walletId)
        .reduce((sum, entry) => sum + entry.amountMinor, 0)
    : 0;

  return (
    <Dialog open={!!transactionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaction details</DialogTitle>
          <DialogDescription>
            The full audit trail — status, amounts and ledger entries.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            className="flex flex-col gap-2"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="sr-only">Loading transaction details…</span>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}

        {tx && current && (
          <div className="flex flex-col gap-4">
            {/* Headline */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {signedMoney({ ...tx, walletDeltaMinor }, tx.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(tx.type)}
                </p>
              </div>
              <StatusBadge status={tx.status} />
            </div>

            {tx.failureReason && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tx.failureReason}
              </p>
            )}

            {/* Facts */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Fact label="Amount" value={money(tx.grossAmount, tx.currency)} />
              <Fact
                label="Fee (total)"
                value={money(tx.providerFee + tx.platformFee, tx.currency)}
              />
              <Fact label="Created" value={formatDateTime(tx.createdAt)} />
              <Fact label="Completed" value={formatDateTime(tx.completedAt)} />
              <Fact label="Transaction id" value={shortId(tx.id)} />
            </dl>

            {/* Ledger legs — the double-entry audit trail */}
            {current.ledger.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Ledger entries
                </p>
                <ul className="divide-y rounded-lg border text-sm">
                  {current.ledger.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 px-3 py-1.5"
                    >
                      <span className="truncate font-mono text-xs">
                        {entry.account}
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${
                          entry.amountMinor < 0
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {money(entry.amountMinor, entry.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  );
}
