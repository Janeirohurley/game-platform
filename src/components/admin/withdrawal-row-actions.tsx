"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  approveWithdrawalAction,
  markWithdrawalPaidAction,
  rejectWithdrawalAction,
} from "@/lib/admin/points-actions";

/**
 * Per-row decision buttons. The server re-checks the admin role and the
 * request state inside every action; this component only reflects the
 * real outcome and refetches the queue afterwards.
 */
export function WithdrawalRowActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.ok) {
          toast.success(result.message);
          setRejectOpen(false);
          setReason("");
          router.refresh();
        } else {
          toast.error(result.message);
        }
      } catch {
        toast.error("L'opération a échoué côté serveur.");
      }
    });
  };

  if (status === "paid" || status === "rejected") {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const validReason = reason.trim().length >= 3;

  return (
    <div className="flex justify-end gap-2">
      {status === "pending" && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => approveWithdrawalAction(requestId))}
        >
          Approuver
        </Button>
      )}
      {status === "approved" && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => markWithdrawalPaidAction(requestId))}
        >
          Marquer payée
        </Button>
      )}
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => setRejectOpen(true)}
      >
        Rejeter…
      </Button>

      <AlertDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setRejectOpen(false);
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter cette demande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les points débités seront restitués au solde de l&apos;utilisateur.
              Le motif est obligatoire et lui sera communiqué.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motif du rejet</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex. : coordonnées de paiement incomplètes…"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending || !validReason}
              onClick={(event) => {
                event.preventDefault();
                run(() =>
                  rejectWithdrawalAction({
                    requestId,
                    reason: reason.trim(),
                  }),
                );
              }}
            >
              {pending ? "Rejet…" : "Rejeter et restituer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
