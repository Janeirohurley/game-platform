/**
 * Server-safe status pill (the shadcn Badge uses a render hook, which
 * cannot run in a Server Component — this keeps admin tables renderable
 * on the server with zero client JS).
 */

const STYLES: Record<string, string> = {
  // transaction statuses
  created: "border-border bg-muted text-foreground",
  pending: "border-border bg-muted text-foreground",
  processing: "border-border bg-muted text-foreground",
  succeeded: "border-transparent bg-emerald-600 text-white",
  failed: "border-transparent bg-destructive text-destructive-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
  expired: "border-border bg-muted text-muted-foreground",
  refunded: "border-border bg-muted text-muted-foreground",
  reversed: "border-border bg-muted text-muted-foreground",
  // wallet / issue / event statuses
  active: "border-transparent bg-emerald-600 text-white",
  frozen: "border-transparent bg-amber-500 text-white",
  closed: "border-border bg-muted text-muted-foreground",
  open: "border-transparent bg-destructive text-destructive-foreground",
  acknowledged: "border-transparent bg-amber-500 text-white",
  resolved: "border-transparent bg-emerald-600 text-white",
  received: "border-border bg-muted text-foreground",
  ignored: "border-border bg-muted text-muted-foreground",
  // severities
  info: "border-border bg-muted text-muted-foreground",
  warning: "border-transparent bg-amber-500 text-white",
  critical: "border-transparent bg-destructive text-destructive-foreground",
};

const LABELS: Record<string, string> = {
  succeeded: "Réussie",
  failed: "Échec",
  processing: "En cours",
  pending: "En attente",
  created: "Créée",
  cancelled: "Annulée",
  expired: "Expirée",
  refunded: "Remboursée",
  reversed: "Inversée",
  active: "Actif",
  frozen: "Gelé",
  closed: "Clôturé",
  open: "Ouverte",
  acknowledged: "Prise en charge",
  resolved: "Résolue",
  received: "Reçu",
  ignored: "Ignoré",
  info: "Info",
  warning: "Avertissement",
  critical: "Critique",
};

export function StatusPill({ status }: { status: string }) {
  const style =
    STYLES[status] ?? "border-border bg-muted text-muted-foreground";
  const label = LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-medium capitalize ${style}`}
    >
      {label}
    </span>
  );
}
