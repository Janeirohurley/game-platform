"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserBalanceRow } from "@/lib/admin/points-queries";
import {
  AdjustPointsDialog,
  type AdjustTarget,
} from "./adjust-points-dialog";

export function PointsUsersTable({ rows }: { rows: UserBalanceRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<AdjustTarget | null>(null);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead className="hidden md:table-cell">Pseudo</TableHead>
              <TableHead className="text-right">Solde (pts)</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell>
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.email}
                  </p>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {row.gamerTag ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.balanceMinor.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setTarget({
                        userId: row.userId,
                        name: row.name,
                        email: row.email,
                        balanceMinor: row.balanceMinor,
                      })
                    }
                  >
                    Créditer / débiter
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Aucun utilisateur.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdjustPointsDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => router.refresh()}
      />
    </>
  );
}
