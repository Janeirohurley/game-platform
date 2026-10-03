import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrency } from "@/lib/wallet/currencies";
import { listEffectiveProviders, toPublicProvider } from "@/lib/wallet/provider-config";
import { toPublicAccount } from "@/lib/wallet/provider-accounts";
import {
  getWalletOverview,
  listProviderAccountsForUser,
  listTransactionsForUser,
} from "@/lib/wallet/queries";
import WalletPageClient from "./wallet-page-client";

/**
 * Wallet page — server shell: session check (belt-and-braces on top
 * of the (protected) layout) + initial data so the first paint shows
 * a real balance, real providers and real history with no loading
 * flash. All later updates flow through the wallet API (client).
 */
export default async function WalletPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/sign-in");
  }

  const [overview, providers, accountRows, transactions] = await Promise.all([
    getWalletOverview(session.user.id),
    listEffectiveProviders(),
    listProviderAccountsForUser(session.user.id),
    listTransactionsForUser(session.user.id, { page: 1, pageSize: 20 }),
  ]);

  return (
    <WalletPageClient
      initialOverview={{
        wallet: overview.wallet,
        balanceMinor: overview.balanceMinor,
        currency: getCurrency(overview.wallet.currency),
      }}
      initialProviders={providers.map(toPublicProvider)}
      initialAccounts={accountRows.map((row) => toPublicAccount(row.provider_accounts))}
      initialTransactions={transactions}
    />
  );
}
