"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BanIcon,
  EllipsisVerticalIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  UserCogIcon,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  banUserAction,
  revokeUserSessionsAction,
  setUserRoleAction,
  unbanUserAction,
} from "@/lib/admin/actions";

/**
 * Contextual per-row actions for a user account — the Actions column of
 * the users table. Only operations the Better Auth admin plugin REALLY
 * supports, adapted to the row's state (banned → Débannir, else
 * Bannir…), each behind a confirmation that states the real
 * consequence. The server re-checks authorization inside every action;
 * this menu is UX, not security.
 */

export interface UserRowActionsUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
}

type DialogState =
  | { kind: "none" }
  | { kind: "ban" }
  | { kind: "unban" }
  | { kind: "role" }
  | { kind: "revoke" };

export function UserRowActions({ user }: { user: UserRowActionsUser }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [daysInput, setDaysInput] = useState("");
  // The role dialog always offers the OPPOSITE of the current role —
  // one decision to confirm, no radio group to reason about.
  const [targetRole, setTargetRole] = useState<"admin" | "user">(
    user.role === "admin" ? "user" : "admin",
  );

  const close = () => {
    if (!pending) setDialog({ kind: "none" });
  };

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        setDialog({ kind: "none" });
        // Refetch so the table shows the PERSISTED state (verify step).
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const confirmBan = () => {
    const days = Number.parseInt(daysInput, 10);
    run(() =>
      banUserAction({
        userId: user.id,
        userEmail: user.email,
        reason: reason.trim() || undefined,
        days: Number.isFinite(days) && days > 0 ? days : undefined,
      }),
    );
  };
  const confirmUnban = () =>
    run(() => unbanUserAction({ userId: user.id, userEmail: user.email }));
  const confirmRole = () =>
    run(() =>
      setUserRoleAction({ userId: user.id, userEmail: user.email, role: targetRole }),
    );
  const confirmRevoke = () =>
    run(() => revokeUserSessionsAction({ userId: user.id, userEmail: user.email }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions pour ${user.email}`}
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {/* Base UI: a GroupLabel is only valid INSIDE a Menu.Group —
              so the label and its actions form one group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user.banned ? (
              <DropdownMenuItem onClick={() => setDialog({ kind: "unban" })}>
                <ShieldCheckIcon />
                Débannir
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setDialog({ kind: "ban" })}>
                <BanIcon />
                Bannir…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                setTargetRole(user.role === "admin" ? "user" : "admin");
                setDialog({ kind: "role" });
              }}
            >
              <UserCogIcon />
              {user.role === "admin" ? "Rétrograder en utilisateur" : "Promouvoir admin"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog({ kind: "revoke" })}>
            <KeyRoundIcon />
            Révoquer les sessions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Bannir — durée optionnelle + motif, conséquence expliquée */}
      <AlertDialog open={dialog.kind === "ban"} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bannir {user.email} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte ne pourra plus se connecter pendant la durée choisie —
              laisse vide pour un bannissement permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ban-days">Durée en jours (vide = permanent)</Label>
              <Input
                id="ban-days"
                type="number"
                min={1}
                value={daysInput}
                onChange={(event) => setDaysInput(event.target.value)}
                placeholder="permanent"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ban-reason">Motif</Label>
              <Textarea
                id="ban-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motif du bannissement…"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmBan();
              }}
            >
              {pending ? "Bannissement…" : "Bannir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Débannir */}
      <AlertDialog open={dialog.kind === "unban"} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Débannir {user.email} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte pourra de nouveau se connecter immédiatement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmUnban();
              }}
            >
              {pending ? "Débannissement…" : "Débannir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Changement de rôle */}
      <AlertDialog open={dialog.kind === "role"} onOpenChange={(open) => !open && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetRole === "admin"
                ? `Promouvoir ${user.email} admin ?`
                : `Rétrograder ${user.email} en utilisateur ?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetRole === "admin"
                ? "Ce compte aura accès à la console d'administration et à toutes ses actions."
                : "Ce compte perdra immédiatement l'accès à la console d'administration."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmRole();
              }}
            >
              {pending ? "Application…" : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Révocation des sessions */}
      <AlertDialog
        open={dialog.kind === "revoke"}
        onOpenChange={(open) => !open && close()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer les sessions de {user.email} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les sessions actives seront déconnectées immédiatement. Le
              compte pourra se reconnecter normalement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmRevoke();
              }}
            >
              {pending ? "Révocation…" : "Révoquer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
