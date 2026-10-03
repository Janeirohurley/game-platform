"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/**
 * Triggers the reconciliation sweep for one provider and reports the
 * run summary (issuesRecorded…) through a toast. The page itself is
 * revalidated by the action, so the new findings appear underneath.
 */
export function ReconciliationRunForm({
  providers,
  action,
}: {
  providers: Array<{ id: string; name: string }>;
  action: (input: {
    provider: string;
  }) => Promise<{ ok: boolean; message: string }>;
}) {
  const [provider, setProvider] = useState(providers[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun fournisseur enregistré.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        value={provider}
        onChange={(e) => setProvider(e.currentTarget.value)}
        aria-label="Fournisseur"
        className="min-w-48"
      >
        {providers.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        disabled={pending || !provider}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await action({ provider });
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            } catch {
              toast.error("La réconciliation a échoué côté serveur.");
            }
          })
        }
      >
        {pending ? "Analyse…" : "Lancer la réconciliation"}
      </Button>
    </div>
  );
}
