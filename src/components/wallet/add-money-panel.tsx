"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import {
  walletApi,
  WalletApiError,
  type AccountRow,
  type QuoteResponse,
} from "@/lib/wallet/api-client";
import type { PublicProvider } from "@/lib/wallet/provider-config";
import { parseMajorToMinor } from "@/lib/wallet/money";
import { QuoteSummary } from "./quote-summary";
import { money, showWalletError } from "./wallet-shared";

type Props = {
  providers: PublicProvider[];
  accounts: AccountRow[];
  currency: string;
  /** Parent opens the detail dialog + refreshes balance. */
  onCreated: (transactionId: string) => void;
  onChanged: () => void;
};

/**
 * Add money — the provider-agnostic deposit flow. The provider list
 * is FETCHED (never hardcoded); the user picks a rail, types an
 * amount in major units (converted to integer minor units before it
 * ever leaves the browser), sees the exact fee quote, and confirms
 * once. A stable idempotency key per attempt means a retry after a
 * timeout can never open a second deposit.
 *
 * Selection state is DERIVED (fallback to the first usable provider)
 * and quote state only changes inside async callbacks — no
 * synchronous setState in effects.
 */
export function AddMoneyPanel({
  providers,
  accounts,
  currency,
  onCreated,
  onChanged,
}: Props) {
  const available = useMemo(
    () =>
      providers.filter(
        (p) =>
          p.supportsDeposit &&
          p.enabled &&
          p.available &&
          p.supportedCurrencies.includes(currency),
      ),
    [providers, currency],
  );

  const [providerId, setProviderId] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [accountId, setAccountId] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: QuoteResponse | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const quoteSeq = useRef(0);

  // Derived selection — never written by an effect.
  const activeProviderId = available.some((p) => p.id === providerId)
    ? providerId
    : (available[0]?.id ?? "");
  const provider = available.find((p) => p.id === activeProviderId) ?? null;

  let amountMinor: number | null = null;
  let amountError: string | null = null;
  if (amountStr.trim()) {
    try {
      amountMinor = parseMajorToMinor(amountStr, currency);
      if (provider?.minimumAmount != null && amountMinor < provider.minimumAmount) {
        amountError = `Minimum is ${money(provider.minimumAmount, currency)}.`;
        amountMinor = null;
      } else if (provider?.maximumAmount != null && amountMinor > provider.maximumAmount) {
        amountError = `Maximum is ${money(provider.maximumAmount, currency)}.`;
        amountMinor = null;
      }
    } catch (error) {
      amountError = error instanceof Error ? error.message : "Invalid amount.";
    }
  }

  const providerAccounts = accounts.filter(
    (a) => a.provider === activeProviderId && a.status === "active",
  );
  const activeAccountId = providerAccounts.some((a) => a.id === accountId)
    ? accountId
    : "";

  // Debounced quote, keyed by its inputs: a result for old inputs can
  // never surface as the quote for the current inputs.
  const quoteKey =
    activeProviderId && amountMinor !== null
      ? `deposit:${activeProviderId}:${amountMinor}:${currency}`
      : "";

  useEffect(() => {
    if (!quoteKey || !activeProviderId || amountMinor === null) {
      quoteSeq.current += 1; // invalidate anything in flight
      return;
    }
    const seq = ++quoteSeq.current;
    const timer = setTimeout(() => {
      walletApi
        .quote({
          provider: activeProviderId,
          type: "deposit",
          amount: amountMinor,
          currency,
        })
        .then((value) => {
          if (quoteSeq.current === seq) setQuote({ key: quoteKey, value });
        })
        .catch(() => {
          if (quoteSeq.current === seq) setQuote({ key: quoteKey, value: null });
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [quoteKey, activeProviderId, amountMinor, currency]);

  const quotePending = !!quoteKey && quote?.key !== quoteKey;
  const quoteValue = quote && quote.key === quoteKey ? quote.value : null;

  async function submit() {
    setFormError(null);
    if (!activeProviderId || amountMinor === null) {
      setFormError("Enter an amount and pick a provider.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await walletApi.deposit({
        provider: activeProviderId,
        amount: amountMinor,
        currency,
        providerAccountId: activeAccountId || undefined,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = crypto.randomUUID();
      setAmountStr("");
      toast.success(
        result.duplicate
          ? "This deposit was already submitted — showing its status."
          : "Deposit started.",
      );
      onChanged();
      onCreated(result.transaction.id);
    } catch (error) {
      showWalletError(error);
      if (error instanceof WalletApiError && error.code !== "rate_limited") {
        setFormError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (available.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add money</CardTitle>
          <CardDescription>
            No deposit provider is currently available for {currency}. Try
            again later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add money</CardTitle>
        <CardDescription>
          Pick a provider, enter an amount, review the exact fees, confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deposit-provider">Provider</Label>
          <NativeSelect
            id="deposit-provider"
            value={activeProviderId}
            onChange={(e) => {
              setProviderId(e.currentTarget.value);
              setAccountId("");
            }}
            className="w-full"
          >
            {available.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.name}
                {p.environment === "sandbox" ? " (sandbox)" : ""}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deposit-amount">Amount ({currency})</Label>
          <Input
            id="deposit-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder={currency === "USD" ? "10.00" : "5000"}
            value={amountStr}
            onChange={(e) => setAmountStr(e.currentTarget.value)}
          />
          {amountError && (
            <p className="text-xs text-destructive">{amountError}</p>
          )}
        </div>

        {providerAccounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deposit-account">Collect from (optional)</Label>
            <NativeSelect
              id="deposit-account"
              value={activeAccountId}
              onChange={(e) => setAccountId(e.currentTarget.value)}
              className="w-full"
            >
              <NativeSelectOption value="">Select an account…</NativeSelectOption>
              {providerAccounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.displayName ?? a.providerAccountId}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}

        {amountMinor !== null && quotePending && (
          // The fee breakdown is the whole point of this screen, so it
          // gets a placeholder with the same height as QuoteSummary —
          // otherwise the Continue button jumps as the quote lands.
          <div
            className="flex flex-col gap-2 rounded-xl border p-4"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="sr-only">Calculating fees…</span>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton
                key={index}
                className={cn("h-4", index === 3 ? "w-2/3" : "w-full")}
              />
            ))}
          </div>
        )}
        {quoteValue && <QuoteSummary quote={quoteValue} />}

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button
          onClick={() => void submit()}
          disabled={
            submitting || !activeProviderId || amountMinor === null || quotePending
          }
        >
          {submitting ? "Starting…" : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}
