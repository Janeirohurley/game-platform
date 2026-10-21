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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshOverlay } from "@/components/loading/refresh-overlay";
import {
  walletApi,
  type OverviewResponse,
  type TransactionListResponse,
  type WalletSettingsDto,
  type WithdrawalRequestDto,
} from "@/lib/wallet/api-client";
import { BuyPointsPanel } from "@/components/wallet/buy-points-panel";
import { TransactionDetailDialog } from "@/components/wallet/transaction-detail-dialog";
import { TransactionsTable } from "@/components/wallet/transactions-table";
import { WithdrawPointsPanel } from "@/components/wallet/withdraw-points-panel";
import { money, showWalletError } from "@/components/wallet/wallet-shared";

type Props = {
  initialOverview: OverviewResponse;
  initialSettings: WalletSettingsDto;
  initialWithdrawals: WithdrawalRequestDto[];
  initialTransactions: TransactionListResponse;
};

type Tab = "overview" | "buy" | "withdraw" | "history";

/**
 * Points shell: live balance, the manual purchase instructions, the
 * withdrawal request form + history, and the append-only ledger. Every
 * mutation refreshes the balance and the request queue together.
 */
export default function WalletPageClient({
  initialOverview,
  initialSettings,
  initialWithdrawals,
  initialTransactions,
}: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [settings, setSettings] = useState(initialSettings);
  const [withdrawals, setWithdrawals] =
    useState<WithdrawalRequestDto[]>(initialWithdrawals);
  const [tab, setTab] = useState<Tab>("overview");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const currency = overview.wallet.currency;

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [nextOverview, nextSettings, nextWithdrawals] = await Promise.all([
        walletApi.overview(),
        walletApi.settings(),
        walletApi.withdrawalRequests(),
      ]);
      setOverview(nextOverview);
      setSettings(nextSettings.settings);
      setWithdrawals(nextWithdrawals.requests);
      setRefreshToken((value) => value + 1);
    } catch (error) {
      showWalletError(error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const openDetail = useCallback((id: string) => setDetailId(id), []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Points</h1>
        <p className="text-sm text-muted-foreground">
          Solde, achats manuels, demandes de retrait et historique complet.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">Solde</TabsTrigger>
          <TabsTrigger value="buy">Acheter</TabsTrigger>
          <TabsTrigger value="withdraw">Retirer</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <RefreshOverlay busy={refreshing} label="Mise à jour des points…">
          <TabsContent value="overview" className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Solde disponible</CardDescription>
                <CardTitle
                  className="text-3xl tabular-nums transition-opacity"
                  aria-busy={refreshing}
                >
                  {money(overview.balanceMinor, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => setTab("buy")}>Acheter des points</Button>
                <Button variant="outline" onClick={() => setTab("withdraw")}>
                  Demander un retrait
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => void refreshAll()}
                  disabled={refreshing}
                >
                  {refreshing ? "Actualisation…" : "Actualiser"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tarifs en vigueur</CardTitle>
                <CardDescription>
                  Fixés par l&apos;administrateur, ils s&apos;appliquent aux
                  nouvelles demandes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Achat : </span>1{" "}
                  {settings.currency} ={" "}
                  {settings.buyPointsPerUnit.toLocaleString("fr-FR")} points
                </p>
                <p>
                  <span className="text-muted-foreground">Retrait : </span>1
                  point = {money(settings.sellMinorPerPoint, settings.currency)}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Retrait minimum :{" "}
                  </span>
                  {settings.minWithdrawalPoints.toLocaleString("fr-FR")} points
                </p>
                <p>
                  <span className="text-muted-foreground">Mise : </span>
                  {settings.minStakePoints.toLocaleString("fr-FR")} –{" "}
                  {settings.maxStakePoints.toLocaleString("fr-FR")} points
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="buy">
            <BuyPointsPanel settings={settings} />
          </TabsContent>

          <TabsContent value="withdraw">
            <WithdrawPointsPanel
              settings={settings}
              balanceMinor={overview.balanceMinor}
              requests={withdrawals}
              onChanged={() => void refreshAll()}
            />
          </TabsContent>

          <TabsContent value="history">
            <TransactionsTable
              refreshToken={refreshToken}
              onOpenDetail={openDetail}
              initial={tab === "history" ? initialTransactions : undefined}
            />
          </TabsContent>
        </RefreshOverlay>
      </Tabs>

      <TransactionDetailDialog
        transactionId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={() => void refreshAll()}
      />
    </div>
  );
}
