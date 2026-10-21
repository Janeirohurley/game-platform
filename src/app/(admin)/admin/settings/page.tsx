import type { Metadata } from "next";

import { WalletSettingsForm } from "@/components/admin/wallet-settings-form";
import { requireAdminSession } from "@/lib/admin/session";
import { getWalletSettings } from "@/lib/wallet/settings";

export const metadata: Metadata = {
  title: "Tarifs — Administration",
};

/**
 * Tariffs are data: every rate the points layer uses is edited here, then
 * read back by the user screens and the withdrawal service. No amount is
 * hard-coded.
 */
export default async function AdminSettingsPage() {
  await requireAdminSession();

  const settings = await getWalletSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          Tarifs et paramètres
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Taux d&apos;achat, taux de retrait, minimums et instructions de
          paiement. Ces valeurs s&apos;appliquent immédiatement aux nouvelles
          demandes.
        </p>
      </div>

      <WalletSettingsForm
        initial={{
          currency: settings.currency,
          buyPointsPerUnit: settings.buyPointsPerUnit,
          sellMinorPerPoint: settings.sellMinorPerPoint,
          minWithdrawalPoints: settings.minWithdrawalPoints,
          minStakePoints: settings.minStakePoints,
          maxStakePoints: settings.maxStakePoints,
          contactInstructions: settings.contactInstructions,
        }}
      />
    </div>
  );
}
