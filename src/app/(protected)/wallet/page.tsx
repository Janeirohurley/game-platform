import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrency } from "@/lib/wallet/currencies";
import { POINTS_CURRENCY, isWithdrawalRequestStatus } from "@/lib/wallet/points-types";
import {
  getWalletOverview,
  listTransactionsForUser,
} from "@/lib/wallet/queries";
import { getWalletSettings } from "@/lib/wallet/settings";
import { listWithdrawalRequestsForUser } from "@/lib/wallet/withdrawal-requests";
import WalletPageClient from "./wallet-page-client";

/**
 * Points page — server shell: session check (belt-and-braces on top of
 * the (protected) layout) + initial data so the first paint shows the
 * real balance, tariff, request queue and history with no loading flash.
 */
export default async function WalletPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const [overview, settings, withdrawals, transactions] = await Promise.all([
    getWalletOverview(session.user.id),
    getWalletSettings(),
    listWithdrawalRequestsForUser(session.user.id),
    listTransactionsForUser(session.user.id, { page: 1, pageSize: 20 }),
  ]);

  return (
    <WalletPageClient
      initialOverview={{
        wallet: overview.wallet,
        balanceMinor: overview.balanceMinor,
        currency: getCurrency(overview.wallet.currency),
      }}
      initialSettings={{
        pointsCurrency: POINTS_CURRENCY,
        currency: settings.currency,
        buyPointsPerUnit: settings.buyPointsPerUnit,
        sellMinorPerPoint: settings.sellMinorPerPoint,
        minWithdrawalPoints: settings.minWithdrawalPoints,
        minStakePoints: settings.minStakePoints,
        maxStakePoints: settings.maxStakePoints,
        contactInstructions: settings.contactInstructions,
      }}
      initialWithdrawals={withdrawals.map((request) => ({
        id: request.id,
        amountMinor: request.amountMinor,
        currency: request.currency,
        status: isWithdrawalRequestStatus(request.status)
          ? request.status
          : "pending",
        userNote: request.userNote,
        adminNote: request.adminNote,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        decidedAt: request.decidedAt,
        paidAt: request.paidAt,
      }))}
      initialTransactions={transactions}
    />
  );
}
