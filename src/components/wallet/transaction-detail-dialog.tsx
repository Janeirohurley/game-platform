"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isPendingStatus,
  walletApi,
  WalletApiError,
  type TransactionDetailResponse,
} from "@/lib/wallet/api-client";
import type { PublicProvider } from "@/lib/wallet/provider-config";
import {
  formatDateTime,
  money,
  shortId,
  showWalletError,
  signedMoney,
  StatusBadge,
  typeLabel,
} from "./wallet-shared";

type Props = {
  transactionId: string | null;
  providers: PublicProvider[];
  onClose: () => void;
  /** Fired after ANY successful mutation (balance/table refresh). */
  onChanged: () => void;
};

type MetadataShape = {
  instructions?: string | null;
  paymentUrl?: string | null;
};

/**
 * Full audit view of one transaction: amounts + explicit fees, the
 * double-entry ledger legs, the provider webhook events, and every
 * action the current state allows (cancel / confirm / refund /
 * sandbox simulate). While the transaction is still awaiting an
 * outcome it polls every few seconds, so a webhook settlement
 * appears without a page refresh.
 *
 * All fetched state is KEYED by transaction id and only written from
 * async callbacks — switching transactions can never show a previous
 * transaction's data, and no effect sets state synchronously.
 */
export function TransactionDetailDialog({
  transactionId,
  providers,
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
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    value: string;
  } | null>(null);

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

  // Poll while awaiting an external outcome.
  const status = tx?.status;
  const polling = !!transactionId && !!status && isPendingStatus(status);
  useEffect(() => {
    if (!transactionId || !status || !isPendingStatus(status)) return;
    const timer = setInterval(() => load(transactionId), 3500);
    return () => clearInterval(timer);
  }, [transactionId, status, load]);

  const provider = tx?.provider
    ? providers.find((p) => p.id === tx.provider)
    : undefined;
  const sandbox = provider?.environment === "sandbox";

  async function runAction(name: string, success: string, call: () => Promise<unknown>) {
    if (!transactionId) return;
    setBusy(name);
    try {
      await call();
      toast.success(success);
      load(transactionId);
      onChanged();
    } catch (error) {
      showWalletError(error);
    } finally {
      setBusy(null);
    }
  }

  const metadata = (tx?.metadata ?? null) as MetadataShape | null;
  const pending = !!tx && isPendingStatus(tx.status);
  const confirmValue =
    confirmation && confirmation.id === transactionId ? confirmation.value : "";

  return (
    <Dialog open={!!transactionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transaction details</DialogTitle>
          <DialogDescription>
            The full audit trail — status, fees, ledger entries and provider
            events.
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
          <div
            className="flex flex-col gap-4"
            // Polling is a background fetch of data the user is already
            // reading — mark the region busy so assistive tech knows the
            // figures can still change.
            aria-busy={polling}
          >
            {/* Headline */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold tabular-nums">
                  {signedMoney(tx, tx.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(tx.type)} · {tx.provider ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {polling && (
                  <span
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <span className="relative flex size-1.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                      <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                    </span>
                    Live
                  </span>
                )}
                <StatusBadge status={tx.status} />
              </div>
            </div>

            {tx.failureReason && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tx.failureReason}
              </p>
            )}

            {metadata?.instructions && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Provider instructions
                </p>
                <p className="whitespace-pre-wrap">{metadata.instructions}</p>
              </div>
            )}
            {metadata?.paymentUrl && (
              <a
                href={metadata.paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline underline-offset-4"
              >
                Open payment page
              </a>
            )}

            {/* Facts */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Fact label="Amount" value={money(tx.grossAmount, tx.currency)} />
              <Fact
                label="Fee (total)"
                value={money(tx.providerFee + tx.platformFee, tx.currency)}
              />
              <Fact label="Provider fee" value={money(tx.providerFee, tx.currency)} />
              <Fact label="Platform fee" value={money(tx.platformFee, tx.currency)} />
              <Fact label="Created" value={formatDateTime(tx.createdAt)} />
              <Fact label="Completed" value={formatDateTime(tx.completedAt)} />
              <Fact label="Expires" value={formatDateTime(tx.expiresAt)} />
              <Fact label="Transaction id" value={shortId(tx.id)} />
              {tx.providerTransactionId && (
                <Fact label="Provider ref" value={shortId(tx.providerTransactionId)} />
              )}
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

            {/* Provider webhook trail */}
            {current.events.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Provider events
                </p>
                <ul className="divide-y rounded-lg border text-sm">
                  {current.events.map((event) => (
                    <li
                      key={event.id}
                      className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs"
                    >
                      <span className="truncate">
                        {event.type} → {event.status}
                        {event.signatureValid ? "" : " (bad signature)"}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatDateTime(event.receivedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions allowed by the current state */}
            <div className="flex flex-col gap-3">
              {tx.type === "deposit" &&
                tx.providerTransactionId &&
                tx.status !== "succeeded" && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor="confirm-code">
                        Confirmation code (optional)
                      </Label>
                      <Input
                        id="confirm-code"
                        value={confirmValue}
                        onChange={(e) =>
                          setConfirmation({
                            id: tx.id,
                            value: e.currentTarget.value,
                          })
                        }
                        placeholder="e.g. 123456"
                        maxLength={64}
                      />
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        runAction("confirm", "Status checked with the provider.", () =>
                          walletApi.confirm(tx.id, confirmValue || undefined),
                        )
                      }
                    >
                      {busy === "confirm" ? "Checking…" : "Check status"}
                    </Button>
                  </div>
                )}

              <div className="flex flex-wrap gap-2">
                {pending && (
                  <Button
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() =>
                      runAction("cancel", "Transaction cancelled.", () =>
                        walletApi.cancel(tx.id),
                      )
                    }
                  >
                    {busy === "cancel" ? "Cancelling…" : "Cancel"}
                  </Button>
                )}

                {tx.type === "deposit" && tx.status === "succeeded" && (
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      runAction(
                        "refund",
                        "Refund requested — it settles once the provider confirms.",
                        () => walletApi.refund(tx.id, crypto.randomUUID()),
                      )
                    }
                  >
                    {busy === "refund" ? "Requesting…" : "Refund"}
                  </Button>
                )}

                {sandbox && pending && tx.providerTransactionId && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        runAction(
                          "sim-ok",
                          "Signed sandbox webhook delivered (success).",
                          () => walletApi.simulate(tx.id, "succeeded"),
                        )
                      }
                    >
                      Simulate success
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() =>
                        runAction(
                          "sim-fail",
                          "Signed sandbox webhook delivered (failure).",
                          () => walletApi.simulate(tx.id, "failed"),
                        )
                      }
                    >
                      Simulate failure
                    </Button>
                  </>
                )}
              </div>
            </div>
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
