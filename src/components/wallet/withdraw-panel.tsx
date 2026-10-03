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
  balanceMinor: number;
  onCreated: (transactionId: string) => void;
  onChanged: () => void;
};

/**
 * Withdraw — funds are RESERVED the moment you confirm (the debit is
 * posted under a wallet row lock), so a balance you can see is a
 * balance you can spend; a provider failure un-reserves with a
 * compensating entry. Destination: a connected account, or a free-form
 * reference for rails that just need a number.
 *
 * Selection state is DERIVED and quote state only changes inside
 * async callbacks — no synchronous setState in effects.
 */
export function WithdrawPanel({
  providers,
  accounts,
  currency,
  balanceMinor,
  onCreated,
  onChanged,
}: Props) {
  const available = useMemo(
    () =>
      providers.filter(
        (p) =>
          p.supportsWithdrawal &&
          p.enabled &&
          p.available &&
          p.supportedCurrencies.includes(currency),
      ),
    [providers, currency],
  );

  const [providerId, setProviderId] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [accountId, setAccountId] = useState("");
  const [destinationRef, setDestinationRef] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: QuoteResponse | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const quoteSeq = useRef(0);

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
  const isOther = accountId === "__other";
  const activeAccountId =
    !isOther && providerAccounts.some((a) => a.id === accountId)
      ? accountId
      : "";
  const showDestinationInput = providerAccounts.length === 0 || isOther;

  const quoteKey =
    activeProviderId && amountMinor !== null
      ? `withdrawal:${activeProviderId}:${amountMinor}:${currency}`
      : "";

  useEffect(() => {
    if (!quoteKey || !activeProviderId || amountMinor === null) {
      quoteSeq.current += 1;
      return;
    }
    const seq = ++quoteSeq.current;
    const timer = setTimeout(() => {
      walletApi
        .quote({
          provider: activeProviderId,
          type: "withdrawal",
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

  const debitMinor = quoteValue?.netAmount ?? null;
  const overBalance = debitMinor !== null && debitMinor > balanceMinor;

  async function submit() {
    setFormError(null);
    if (!activeProviderId || amountMinor === null) {
      setFormError("Enter an amount and pick a provider.");
      return;
    }
    const useAccount = !!activeAccountId;
    if (!useAccount && !destinationRef.trim()) {
      setFormError("Pick a connected account or enter a destination reference.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await walletApi.withdrawal({
        provider: activeProviderId,
        amount: amountMinor,
        currency,
        providerAccountId: useAccount ? activeAccountId : undefined,
        destinationRef: useAccount ? undefined : destinationRef.trim(),
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = crypto.randomUUID();
      setAmountStr("");
      setDestinationRef("");
      toast.success(
        result.duplicate
          ? "This withdrawal was already submitted — showing its status."
          : "Withdrawal started — funds reserved.",
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
          <CardTitle>Withdraw</CardTitle>
          <CardDescription>
            No withdrawal provider is currently available for {currency}. Try
            again later.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw</CardTitle>
        <CardDescription>
          Balance {money(balanceMinor, currency)} — fees are shown before you
          confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="withdraw-provider">Provider</Label>
          <NativeSelect
            id="withdraw-provider"
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
          <Label htmlFor="withdraw-amount">Amount ({currency})</Label>
          <Input
            id="withdraw-amount"
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
            <Label htmlFor="withdraw-account">Destination account</Label>
            <NativeSelect
              id="withdraw-account"
              value={isOther ? "__other" : activeAccountId}
              onChange={(e) => setAccountId(e.currentTarget.value)}
              className="w-full"
            >
              <NativeSelectOption value="">Connected accounts…</NativeSelectOption>
              {providerAccounts.map((a) => (
                <NativeSelectOption key={a.id} value={a.id}>
                  {a.displayName ?? a.providerAccountId}
                </NativeSelectOption>
              ))}
              <NativeSelectOption value="__other">Other destination…</NativeSelectOption>
            </NativeSelect>
          </div>
        )}

        {showDestinationInput && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-dest">Destination reference</Label>
            <Input
              id="withdraw-dest"
              autoComplete="off"
              placeholder="e.g. +25771234567"
              value={destinationRef}
              onChange={(e) => setDestinationRef(e.currentTarget.value)}
              maxLength={64}
            />
          </div>
        )}

        {amountMinor !== null && quotePending && (
          // Same reasoning as the add-money panel: the fee breakdown is
          // what the user is about to confirm, so it gets a same-height
          // placeholder instead of a bare grey box.
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

        {overBalance && (
          <p className="text-xs text-destructive">
            This withdrawal (including fees) exceeds your current balance.
          </p>
        )}
        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button
          onClick={() => void submit()}
          disabled={
            submitting || !activeProviderId || amountMinor === null || quotePending
          }
        >
          {submitting ? "Reserving…" : "Confirm withdrawal"}
        </Button>
      </CardContent>
    </Card>
  );
}
