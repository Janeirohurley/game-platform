import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { StatusPill } from "@/components/admin/status-pill";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { verifyTransactionAction } from "@/lib/admin/wallet-actions";
import { getTransactionDetailAdmin } from "@/lib/admin/wallet-queries";
import { requireAdminSession } from "@/lib/admin/session";
import { formatMoney } from "@/lib/wallet/money";

export const metadata: Metadata = {
  title: "Transaction — Administration",
};

/**
 * Phase 12 — the full audit trail of ONE transaction: owner, amounts +
 * explicit fees, every ledger leg (double-entry), every provider
 * webhook event, every reconciliation finding, and the admin
 * verification action (asks the rail, applies through the normal
 * settlement path — the console never writes money itself).
 */
export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();

  const { id } = await params;
  const detail = await getTransactionDetailAdmin(id);
  if (!detail) notFound();

  const tx = detail.transaction;
  const totalFee = tx.providerFee + tx.platformFee;
  const eventSum = detail.ledger.reduce((sum, leg) => sum + leg.amountMinor, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-xl font-semibold">
              {tx.type} · {tx.type === "deposit" ? "" : "−"}
              {formatMoney(tx.grossAmount, tx.currency)}
            </h1>
            <StatusPill status={tx.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {tx.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            action={verifyTransactionAction}
            args={{ transactionId: tx.id }}
            variant="outline"
          >
            Vérifier auprès du fournisseur
          </ActionButton>
        </div>
      </div>

      {/* Facts */}
      <Card>
        <CardHeader>
          <CardTitle>Operation</CardTitle>
          <CardDescription>
            Propriétaire, montants explicites et références.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Propriétaire" value={detail.ownerEmail ?? "—"} />
          <Fact label="Nom" value={detail.ownerName ?? "—"} />
          <Fact label="Devise" value={tx.currency} />
          <Fact label="Montant brut" value={formatMoney(tx.grossAmount, tx.currency)} />
          <Fact label="Frais fournisseur" value={formatMoney(tx.providerFee, tx.currency)} />
          <Fact label="Frais plateforme" value={formatMoney(tx.platformFee, tx.currency)} />
          <Fact label="Frais totaux" value={formatMoney(totalFee, tx.currency)} />
          <Fact label="Net" value={formatMoney(tx.netAmount, tx.currency)} />
          <Fact label="Fournisseur" value={tx.provider ?? "—"} />
          <Fact
            label="Réf. fournisseur"
            value={tx.providerTransactionId ?? "—"}
            mono
          />
          <Fact label="Clé d'idempotence" value={tx.idempotencyKey ?? "—"} mono />
          <Fact
            label="Transaction d'origine"
            value={tx.originalTransactionId ?? "—"}
            mono
          />
          <Fact label="Créée le" value={tx.createdAt.toLocaleString("fr-FR")} />
          <Fact
            label="Terminée le"
            value={tx.completedAt ? tx.completedAt.toLocaleString("fr-FR") : "—"}
          />
          <Fact
            label="Expire le"
            value={tx.expiresAt ? tx.expiresAt.toLocaleString("fr-FR") : "—"}
          />
          {tx.failureReason && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {tx.failureReason}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle>Grand livre (double entrée)</CardTitle>
          <CardDescription>
            {detail.ledger.length} écriture(s) — somme des jambes :{" "}
            <span className="tabular-nums">{eventSum}</span> (doit être 0).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune écriture — le mouvement n&apos;a pas encore touché le
              grand livre (dépôt en attente de règlement).
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compte</TableHead>
                    <TableHead className="text-right">Montant signé</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.ledger.map((leg) => (
                    <TableRow key={leg.id}>
                      <TableCell className="font-mono text-xs">
                        {leg.account}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          leg.amountMinor < 0 ? "text-destructive" : ""
                        }`}
                      >
                        {formatMoney(leg.amountMinor, leg.currency)}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {leg.createdAt.toLocaleString("fr-FR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider events */}
      <Card>
        <CardHeader>
          <CardTitle>Événements fournisseur (webhooks)</CardTitle>
          <CardDescription>
            Piste d&apos;audit côté rail — signature vérifiée à la réception.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun webhook reçu pour l&apos;instant.
            </p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Événement id
                    </TableHead>
                    <TableHead>Signature</TableHead>
                    <TableHead className="hidden sm:table-cell">Reçu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="text-sm">{event.type}</TableCell>
                      <TableCell>
                        <StatusPill status={event.status} />
                      </TableCell>
                      <TableCell className="hidden max-w-40 truncate font-mono text-xs sm:table-cell">
                        {event.providerEventId}
                      </TableCell>
                      <TableCell className="text-sm">
                        {event.signatureValid ? "valide" : "INVALIDE"}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {event.receivedAt.toLocaleString("fr-FR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation findings */}
      <Card>
        <CardHeader>
          <CardTitle>Anomalies de réconciliation</CardTitle>
          <CardDescription>
            Divergences détectées sur cette transaction (jamais corrigées en
            silence).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {detail.issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune anomalie.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {detail.issues.map((issue) => (
                <li
                  key={issue.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="font-medium">{issue.issueType}</span>
                  <span className="flex items-center gap-2">
                    <StatusPill status={issue.severity} />
                    <StatusPill status={issue.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link
              href="/admin/reconciliation"
              className="underline underline-offset-4"
            >
              Voir toute la réconciliation
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`truncate font-medium ${mono ? "font-mono text-xs" : "tabular-nums"}`}
      >
        {value}
      </p>
    </div>
  );
}
