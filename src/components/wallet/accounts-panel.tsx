"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { walletApi, type AccountRow } from "@/lib/wallet/api-client";
import type { PublicProvider } from "@/lib/wallet/provider-config";
import { showWalletError } from "./wallet-shared";

type Props = {
  providers: PublicProvider[];
  accounts: AccountRow[];
  currency: string;
  onChanged: () => void;
};

/**
 * Connected provider accounts: connect (rate-limited server-side),
 * list (references always MASKED — the full ref never leaves the
 * server) and disconnect (a status flip, never a delete, so history
 * stays readable).
 */
export function AccountsPanel({ providers, accounts, currency, onChanged }: Props) {
  const usable = providers.filter((p) => p.enabled && p.available);
  const [providerId, setProviderId] = useState("");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derived — no effect: the selection always falls back to the first
  // usable provider instead of being written into state by an effect.
  const activeProviderId = usable.some((p) => p.id === providerId)
    ? providerId
    : (usable[0]?.id ?? "");

  async function connect() {
    setError(null);
    if (!activeProviderId || reference.trim().length < 4) {
      setError("Enter the provider and a valid account reference.");
      return;
    }
    setBusy("connect");
    try {
      await walletApi.connectAccount({
        provider: activeProviderId,
        providerAccountId: reference.trim(),
        displayName: label.trim() || undefined,
        currency,
      });
      setReference("");
      setLabel("");
      toast.success("Account connected.");
      onChanged();
    } catch (err) {
      showWalletError(err);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    setBusy(id);
    try {
      await walletApi.disconnectAccount(id);
      toast.success("Account disconnected.");
      onChanged();
    } catch (err) {
      showWalletError(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          Saved references speed up deposits and withdrawals. Numbers are
          masked everywhere they appear.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {accounts.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {account.displayName ?? account.providerAccountId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.providerAccountId} · {account.provider}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={account.status === "active" ? "secondary" : "outline"}>
                    {account.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void disconnect(account.id)}
                  >
                    {busy === account.id ? "…" : "Disconnect"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {usable.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="connect-provider">Provider</Label>                <NativeSelect
                  id="connect-provider"
                  value={activeProviderId}
                  onChange={(e) => setProviderId(e.currentTarget.value)}
                  className="w-full"
              >
                {usable.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="connect-ref">Account reference</Label>
              <Input
                id="connect-ref"
                autoComplete="off"
                placeholder="e.g. +25771234567"
                value={reference}
                onChange={(e) => setReference(e.currentTarget.value)}
                maxLength={64}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="connect-label">Label (optional)</Label>
              <Input
                id="connect-label"
                autoComplete="off"
                placeholder="e.g. My number"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
                maxLength={48}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="outline"
              onClick={() => void connect()}
              disabled={busy !== null}
            >
              {busy === "connect" ? "Connecting…" : "Connect account"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
