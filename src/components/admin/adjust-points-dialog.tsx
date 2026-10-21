"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { adjustPointsAction } from "@/lib/admin/points-actions";

export interface AdjustTarget {
  userId: string;
  name: string;
  email: string;
  balanceMinor: number;
}

export function AdjustPointsDialog({
  target,
  onClose,
  onDone,
}: {
  target: AdjustTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const parsed = Number(amount);
  const valid =
    Number.isSafeInteger(parsed) && parsed > 0 && reason.trim().length >= 3;

  async function submit() {
    if (!target || !valid) return;
    setPending(true);
    const result = await adjustPointsAction({
      targetUserId: target.userId,
      amount: parsed,
      direction,
      reason: reason.trim(),
    });
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      setAmount("");
      setReason("");
      onDone();
      onClose();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créditer / débiter des points</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.name} (${target.email}) — solde actuel : ${target.balanceMinor.toLocaleString("fr-FR")} pts`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adjust-direction">Sens de l&apos;opération</Label>
            <NativeSelect
              id="adjust-direction"
              value={direction}
              onChange={(event) =>
                setDirection(event.target.value as "credit" | "debit")
              }
            >
              <NativeSelectOption value="credit">Créditer</NativeSelectOption>
              <NativeSelectOption value="debit">Débiter</NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-amount">Montant (points)</Label>
            <Input
              id="adjust-amount"
              inputMode="numeric"
              placeholder="100"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Motif (obligatoire)</Label>
            <Textarea
              id="adjust-reason"
              placeholder="Paiement reçu le 20/10, référence ABC123…"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? "En cours…" : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
