"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateWalletSettingsAction } from "@/lib/admin/points-actions";
import { formatMoney } from "@/lib/wallet/money";

export interface WalletSettingsFormValues {
  currency: string;
  buyPointsPerUnit: number;
  sellMinorPerPoint: number;
  minWithdrawalPoints: number;
  minStakePoints: number;
  maxStakePoints: number;
  contactInstructions: string;
}

const INTEGER_FIELDS = [
  "buyPointsPerUnit",
  "sellMinorPerPoint",
  "minWithdrawalPoints",
  "minStakePoints",
  "maxStakePoints",
] as const;

type IntegerField = (typeof INTEGER_FIELDS)[number];

function parseInteger(value: string): number {
  return Number.parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

export function WalletSettingsForm({
  initial,
}: {
  initial: WalletSettingsFormValues;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState(initial.currency);
  const [integers, setIntegers] = useState<Record<IntegerField, string>>({
    buyPointsPerUnit: String(initial.buyPointsPerUnit),
    sellMinorPerPoint: String(initial.sellMinorPerPoint),
    minWithdrawalPoints: String(initial.minWithdrawalPoints),
    minStakePoints: String(initial.minStakePoints),
    maxStakePoints: String(initial.maxStakePoints),
  });
  const [contactInstructions, setContactInstructions] = useState(
    initial.contactInstructions,
  );
  const [pending, setPending] = useState(false);

  const parsed = {
    currency: currency.trim().toUpperCase(),
    buyPointsPerUnit: parseInteger(integers.buyPointsPerUnit),
    sellMinorPerPoint: parseInteger(integers.sellMinorPerPoint),
    minWithdrawalPoints: parseInteger(integers.minWithdrawalPoints),
    minStakePoints: parseInteger(integers.minStakePoints),
    maxStakePoints: parseInteger(integers.maxStakePoints),
    contactInstructions: contactInstructions.trim(),
  };

  const valid =
    /^[A-Z]{3}$/.test(parsed.currency) &&
    parsed.buyPointsPerUnit > 0 &&
    parsed.sellMinorPerPoint > 0 &&
    parsed.minWithdrawalPoints > 0 &&
    parsed.minStakePoints > 0 &&
    parsed.maxStakePoints >= parsed.minStakePoints;

  async function submit() {
    if (!valid) return;
    setPending(true);
    const result = await updateWalletSettingsAction(parsed);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="settings-currency"
          label="Devise de référence"
          hint="Code ISO à 3 lettres (ex. : BIF). Les points restent en PTS."
        >
          <Input
            id="settings-currency"
            value={currency}
            maxLength={3}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </Field>

        <Field
          id="settings-buy"
          label="Points achetés par unité"
          hint={`1 ${parsed.currency || "unité"} → ${parsed.buyPointsPerUnit.toLocaleString(
            "fr-FR",
          )} points.`}
        >
          <Input
            id="settings-buy"
            inputMode="numeric"
            value={integers.buyPointsPerUnit}
            onChange={(event) =>
              setIntegers((current) => ({
                ...current,
                buyPointsPerUnit: event.target.value,
              }))
            }
          />
        </Field>

        <Field
          id="settings-sell"
          label="Unités mineures par point"
          hint={`${parsed.minWithdrawalPoints.toLocaleString(
            "fr-FR",
          )} points ≈ ${formatMoney(
            parsed.sellMinorPerPoint * parsed.minWithdrawalPoints,
            parsed.currency || "BIF",
          )}.`}
        >
          <Input
            id="settings-sell"
            inputMode="numeric"
            value={integers.sellMinorPerPoint}
            onChange={(event) =>
              setIntegers((current) => ({
                ...current,
                sellMinorPerPoint: event.target.value,
              }))
            }
          />
        </Field>

        <Field
          id="settings-min-withdrawal"
          label="Retrait minimum (points)"
        >
          <Input
            id="settings-min-withdrawal"
            inputMode="numeric"
            value={integers.minWithdrawalPoints}
            onChange={(event) =>
              setIntegers((current) => ({
                ...current,
                minWithdrawalPoints: event.target.value,
              }))
            }
          />
        </Field>

        <Field id="settings-min-stake" label="Mise minimum (points)">
          <Input
            id="settings-min-stake"
            inputMode="numeric"
            value={integers.minStakePoints}
            onChange={(event) =>
              setIntegers((current) => ({
                ...current,
                minStakePoints: event.target.value,
              }))
            }
          />
        </Field>

        <Field id="settings-max-stake" label="Mise maximum (points)">
          <Input
            id="settings-max-stake"
            inputMode="numeric"
            value={integers.maxStakePoints}
            onChange={(event) =>
              setIntegers((current) => ({
                ...current,
                maxStakePoints: event.target.value,
              }))
            }
          />
        </Field>
      </div>

      <Field
        id="settings-contact"
        label="Instructions de paiement (affichées aux utilisateurs)"
        hint="Numéro, e-mail ou toute consigne pour acheter des points hors application."
      >
        <Textarea
          id="settings-contact"
          value={contactInstructions}
          onChange={(event) => setContactInstructions(event.target.value)}
          rows={4}
          placeholder="Ex. : Envoyez le paiement au +257… puis indiquez la référence ici."
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={!valid || pending}>
          {pending ? "Enregistrement…" : "Enregistrer les tarifs"}
        </Button>
        {!valid && (
          <p className="text-sm text-destructive">
            Vérifiez les valeurs : taux positifs et mise max ≥ mise min.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
