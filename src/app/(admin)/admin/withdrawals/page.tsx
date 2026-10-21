import type { Metadata } from "next";
import Link from "next/link";

import { StatusPill } from "@/components/admin/status-pill";
import { WithdrawalRowActions } from "@/components/admin/withdrawal-row-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdminSession } from "@/lib/admin/session";
import { formatMoney } from "@/lib/wallet/money";
import { isWithdrawalRequestStatus } from "@/lib/wallet/points-types";
import { getWalletSettings } from "@/lib/wallet/settings";
import { listWithdrawalRequestsAdmin } from "@/lib/wallet/withdrawal-requests";

export const metadata: Metadata = {
  title: "Demandes de retrait — Administration",
};

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvées" },
  { value: "paid", label: "Payées" },
  { value: "rejected", label: "Rejetées" },
] as const;

/**
 * Manual payout queue. Points were already debited when the request was
 * created, so approving / marking paid moves NO money — the admin pays
 * outside the application and records the decision here. Rejecting
 * refunds the exact amount through the ledger.
 */
export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminSession();

  const params = await searchParams;
  const status =
    params.status && isWithdrawalRequestStatus(params.status)
      ? params.status
      : undefined;

  const [rows, settings] = await Promise.all([
    listWithdrawalRequestsAdmin({ status }),
    getWalletSettings(),
  ]);

  const buildHref = (value: string) =>
    value ? `/admin/withdrawals?status=${value}` : "/admin/withdrawals";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          Demandes de retrait
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les points sont débités dès la demande. Le paiement se fait hors
          application : approuvez, payez, puis marquez la demande comme payée.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((filter) => {
          const active = (status ?? "") === filter.value;
          return (
            <Link
              key={filter.label}
              href={buildHref(filter.value)}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Équivalent
              </TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="hidden lg:table-cell">Note</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {row.createdAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell>
                  <p className="truncate font-medium">{row.userName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.userEmail}
                  </p>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.amountMinor.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatMoney(
                    settings.sellMinorPerPoint * row.amountMinor,
                    settings.currency,
                  )}
                </TableCell>
                <TableCell>
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="hidden max-w-56 text-xs text-muted-foreground lg:table-cell">
                  {row.adminNote ?? row.userNote ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <WithdrawalRowActions
                    requestId={row.id}
                    status={row.status}
                  />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucune demande
                  {status ? " pour ce filtre" : ""}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
