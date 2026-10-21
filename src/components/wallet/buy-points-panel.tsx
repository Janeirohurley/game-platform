"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WalletSettingsDto } from "@/lib/wallet/api-client";

/**
 * Buy points — payment happens OUTSIDE the application. This panel only
 * shows the configured tariff and the administrator's instructions; it
 * moves no money and calls no payment provider.
 */
export function BuyPointsPanel({ settings }: { settings: WalletSettingsDto }) {
  const instructions = settings.contactInstructions.trim();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Acheter des points</CardTitle>
          <CardDescription>
            Le paiement se fait directement avec l&apos;administrateur, hors
            application. Aucun prélèvement automatique.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Taux d&apos;achat</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              1 {settings.currency} ={" "}
              {settings.buyPointsPerUnit.toLocaleString("fr-FR")} points
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Instructions de paiement</p>
            {instructions ? (
              <p className="whitespace-pre-line rounded-lg border p-4 text-sm">
                {instructions}
              </p>
            ) : (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">
                Aucune instruction n&apos;est configurée pour le moment.
                Contactez l&apos;administrateur pour connaître les modalités.
              </p>
            )}
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Effectuez le paiement en dehors de l&apos;application.</li>
            <li>Communiquez la référence du paiement à l&apos;administrateur.</li>
            <li>
              Les points sont crédités manuellement après vérification — ils
              apparaissent dans votre historique.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
