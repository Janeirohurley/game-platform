import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { StatusPill } from "@/components/admin/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setProviderEnabledAction } from "@/lib/admin/wallet-actions";
import { requireAdminSession } from "@/lib/admin/session";
import { listEffectiveProviders } from "@/lib/wallet/provider-config";

export const metadata: Metadata = {
  title: "Fournisseurs de paiement — Administration",
};

/**
 * Phase 12 — payment provider control plane. Every entry is the
 * EFFECTIVE view (adapter declarations ∩ database configuration), and
 * enabling/disabling is ONE audited row flip: no deploy, no code
 * change. Secrets are never shown here — they live in the
 * environment, and configuration can only NARROW an adapter.
 */
export default async function AdminProvidersPage() {
  await requireAdminSession();

  const providers = await listEffectiveProviders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          Fournisseurs de paiement
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue effective = déclarations de l&apos;adaptateur ∩ configuration en
          base. Activer/désactiver est une seule ligne auditable — aucun
          déploiement.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>{provider.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {provider.id} · {provider.environment}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={provider.enabled ? "active" : "closed"} />
                  {!provider.available && (
                    <StatusPill status="critical" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {provider.description && (
                <p className="text-muted-foreground">{provider.description}</p>
              )}

              {!provider.available && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                  Indisponible : {provider.unavailableReason ?? "raison inconnue"}
                </p>
              )}

              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Capacités effectives
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {provider.capabilities.length === 0 ? (
                    <span className="text-muted-foreground">aucune</span>
                  ) : (
                    provider.capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border px-2 py-0.5 text-xs"
                      >
                        {capability}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Fact label="Currencies" value={provider.supportedCurrencies.join(", ")} />
                <Fact
                  label="Limites"
                  value={
                    provider.minimumAmount !== null ||
                    provider.maximumAmount !== null
                      ? `${provider.minimumAmount ?? "−"} … ${provider.maximumAmount ?? "∞"} (minor)`
                      : "aucune"
                  }
                />
                <Fact
                  label="Frais (BPS)"
                  value={
                    provider.fees.platformBps !== undefined ||
                    provider.fees.providerBps !== undefined
                      ? `plateforme ${provider.fees.platformBps ?? 0} · fournisseur ${provider.fees.providerBps ?? 0}`
                      : "0"
                  }
                />
                <Fact
                  label="Frais fixes (minor)"
                  value={
                    provider.fees.platformFixedMinor !== undefined ||
                    provider.fees.providerFixedMinor !== undefined
                      ? `plateforme ${provider.fees.platformFixedMinor ?? 0} · fournisseur ${provider.fees.providerFixedMinor ?? 0}`
                      : "0"
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t pt-3">
                <p className="text-xs text-muted-foreground">
                  {provider.enabled
                    ? "Accepte les nouveaux opérations."
                    : "Désactivé — les opérations existantes restent réglables."}
                </p>
                <ActionButton
                  action={setProviderEnabledAction}
                  args={{ provider: provider.id, enabled: !provider.enabled }}
                  variant={provider.enabled ? "destructive" : "default"}
                >
                  {provider.enabled ? "Désactiver" : "Activer"}
                </ActionButton>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium tabular-nums">{value}</p>
    </div>
  );
}
