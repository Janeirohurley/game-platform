"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  walletApi,
  WalletApiError,
  type WalletSettingsDto,
  type WithdrawalRequestDto,
} from "@/lib/wallet/api-client";
import { money, showWalletError } from "./wallet-shared";

const STATUS_LABELS: Record<
  WithdrawalRequestDto["status"],
  { label: string; variant: "outline" | "secondary" | "default" | "destructive" }
> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvée", variant: "default" },
  paid: { label: "Payée", variant: "outline" },
  rejected: { label: "Rejetée", variant: "destructive" },
};

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Withdrawal request — points are RESERVED immediately (debited from the
 * ledger in the same transaction as the request). An admin pays outside
 * the application, then approves and marks the request paid; a rejection
 * restores the exact amount.
 */
export function WithdrawPointsPanel({
  settings,
  balanceMinor,
  requests,
  onChanged,
}: {
  settings: WalletSettingsDto;
  balanceMinor: number;
  requests: WithdrawalRequestDto[];
  onChanged: () => void;
}) {
  const [pointsStr, setPointsStr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());

  const points = Number.parseInt(pointsStr.replace(/[^0-9]/g, ""), 10) || 0;
  const estimateMinor =
    Number.isSafeInteger(settings.sellMinorPerPoint * points) && points > 0
      ? settings.sellMinorPerPoint * points
      : 0;

  const belowMinimum = points > 0 && points < settings.minWithdrawalPoints;
  const overBalance = points > 0 && points > balanceMinor;
  const valid =
    points >= settings.minWithdrawalPoints &&
    points <= balanceMinor &&
    Number.isSafeInteger(points);

  async function submit() {
    setFormError(null);
    if (!valid) return;
    setSubmitting(true);
    try {
      const result = await walletApi.createWithdrawalRequest({
        points,
        note: note.trim() || undefined,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = crypto.randomUUID();
      setPointsStr("");
      setNote("");
      toast.success(
        result.duplicate
          ? "Cette demande a déjà été enregistrée."
          : "Demande envoyée — points réservés.",
      );
      onChanged();
    } catch (error) {
      showWalletError(error);
      if (error instanceof WalletApiError && error.code !== "rate_limited") {
        setFormError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Retirer des points</CardTitle>
          <CardDescription>
            Solde disponible : {money(balanceMinor, settings.pointsCurrency)}.
            Les points sont réservés dès l&apos;envoi de la demande.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              Taux de retrait : 1 point ={" "}
              {money(settings.sellMinorPerPoint, settings.currency)}. Retrait
              minimum : {settings.minWithdrawalPoints.toLocaleString("fr-FR")}{" "}
              points.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-points">Points à retirer</Label>
            <Input
              id="withdraw-points"
              inputMode="numeric"
              autoComplete="off"
              placeholder={String(settings.minWithdrawalPoints)}
              value={pointsStr}
              onChange={(event) => setPointsStr(event.target.value)}
            />
            {belowMinimum && (
              <p className="text-xs text-destructive">
                Minimum : {settings.minWithdrawalPoints.toLocaleString("fr-FR")}{" "}
                points.
              </p>
            )}
            {overBalance && (
              <p className="text-xs text-destructive">
                Ce montant dépasse votre solde disponible.
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Montant estimé</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {money(estimateMinor, settings.currency)}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="withdraw-note">Note (optionnelle)</Label>
            <Textarea
              id="withdraw-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={240}
              placeholder="Coordonnées de paiement, précisions…"
            />
          </div>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <Button onClick={() => void submit()} disabled={!valid || submitting}>
            {submitting ? "Envoi…" : "Demander le retrait"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes demandes</CardTitle>
          <CardDescription>
            En attente → approuvée → payée, ou rejetée (points restitués).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Équivalent
                  </TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="hidden md:table-cell">Motif</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const meta =
                    STATUS_LABELS[request.status] ?? STATUS_LABELS.pending;
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {request.amountMinor.toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {money(
                          settings.sellMinorPerPoint * request.amountMinor,
                          settings.currency,
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-xs text-muted-foreground md:table-cell">
                        {request.adminNote ?? request.userNote ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Aucune demande de retrait.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
