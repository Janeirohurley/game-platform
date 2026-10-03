"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  walletApi,
  type OverviewResponse,
  type AccountRow,
  type TransactionListResponse,
} from "@/lib/wallet/api-client";
import type { PublicProvider } from "@/lib/wallet/provider-config";
import { AccountsPanel } from "@/components/wallet/accounts-panel";
import { AddMoneyPanel } from "@/components/wallet/add-money-panel";
import { TransactionDetailDialog } from "@/components/wallet/transaction-detail-dialog";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { WithdrawPanel } from "@/components/wallet/withdraw-panel";
import { money, showWalletError } from "@/components/wallet/wallet-shared";

type Props = {
  initialOverview: OverviewResponse;
  initialProviders: PublicProvider[];
  initialAccounts: AccountRow[];
  initialTransactions: TransactionListResponse;
};

type Tab = "overview" | "add" | "withdraw" | "history";

/**
 * Wallet shell: balance card + quick actions, add-money / withdraw
 * flows fed by the DYNAMIC provider list, connected accounts and the
 * transaction history. Every mutation refreshes balance, accounts and
 * providers together, and any opened transaction stays live (polled)
 * in the detail dialog until it settles.
 */
export default function WalletPageClient({
  initialOverview,
  initialProviders,
  initialAccounts,
  initialTransactions,
}: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [providers, setProviders] = useState(initialProviders);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [tab, setTab] = useState<Tab>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const currency = overview.wallet.currency;

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextOverview, nextProviders, nextAccounts] = await Promise.all([
        walletApi.overview(),
        walletApi.providers(),
        walletApi.accounts(),
      ]);
      setOverview(nextOverview);
      setProviders(nextProviders.providers);
      setAccounts(nextAccounts.accounts);
      setRefreshToken((v) => v + 1);
    } catch (error) {
      showWalletError(error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleChanged = useCallback(() => {
    void refreshAll();
  }, [refreshAll]);

  const openDetail = useCallback((id: string) => setDetailId(id), []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Add money, withdraw and audit every movement — fees always shown
          before you confirm.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="add">Add money</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ---- Overview ------------------------------------------------ */}
        <TabsContent value="overview" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardDescription>Available balance</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {refreshing && !overview ? (
                  <Skeleton className="h-8 w-40" />
                ) : (
                  money(overview.balanceMinor, currency)
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => setTab("add")}>Add money</Button>
              <Button variant="outline" onClick={() => setTab("withdraw")}>
                Withdraw
              </Button>
              <Button
                variant="ghost"
                onClick={() => void refreshAll()}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </CardContent>
          </Card>

          <AccountsPanel
            providers={providers}
            accounts={accounts}
            currency={currency}
            onChanged={handleChanged}
          />
        </TabsContent>

        {/* ---- Add money ---------------------------------------------- */}
        <TabsContent value="add" className="flex flex-col gap-4">
          <AddMoneyPanel
            providers={providers}
            accounts={accounts}
            currency={currency}
            onCreated={openDetail}
            onChanged={handleChanged}
          />
        </TabsContent>

        {/* ---- Withdraw ------------------------------------------------ */}
        <TabsContent value="withdraw" className="flex flex-col gap-4">
          <WithdrawPanel
            providers={providers}
            accounts={accounts}
            currency={currency}
            balanceMinor={overview.balanceMinor}
            onCreated={openDetail}
            onChanged={handleChanged}
          />
        </TabsContent>

        {/* ---- History ------------------------------------------------- */}
        <TabsContent value="history" className="flex flex-col gap-4">
          <TransactionsTable
            refreshToken={refreshToken}
            onOpenDetail={openDetail}
            initial={tab === "history" ? initialTransactions : undefined}
          />
        </TabsContent>
      </Tabs>

      <TransactionDetailDialog
        transactionId={detailId}
        providers={providers}
        onClose={() => setDetailId(null)}
        onChanged={handleChanged}
      />
    </div>
  );
}
