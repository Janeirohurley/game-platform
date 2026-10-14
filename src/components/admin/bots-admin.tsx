"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BotIcon,
  EllipsisVerticalIcon,
  Link2Icon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminBotListRow,
  AttachableAccountRow,
} from "@/lib/admin/bot-queries";
import {
  bindBotAction,
  createBotAction,
  deleteBotAction,
  provisionBotsAction,
  searchAccountsAction,
  updateBotAction,
} from "@/lib/admin/bot-actions";
import type { BotMode } from "@/lib/db/schema/bots";

type GameOption = { id: string; title: string };

const DIFFICULTIES = [
  { value: "easy", label: "Facile" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Difficile" },
] as const;

const KNOBS = [
  { value: "0.25", label: "Faible" },
  { value: "0.5", label: "Moyenne" },
  { value: "0.75", label: "Élevée" },
] as const;

function difficultyLabel(value: string): string {
  return DIFFICULTIES.find((d) => d.value === value)?.label ?? value;
}

function knobToString(value: number): string {
  if (value <= 0.375) return "0.25";
  if (value >= 0.625) return "0.75";
  return "0.5";
}

/** Table + all console dialogs. One client island; the page stays server. */
export function BotsAdmin({
  rows,
  games,
}: {
  rows: AdminBotListRow[];
  games: GameOption[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [refillOpen, setRefillOpen] = useState(false);
  const [dialog, setDialog] = useState<
    { kind: "edit" | "bind" | "delete"; bot: AdminBotListRow } | null
  >(null);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} bot{rows.length > 1 ? "s" : ""} sur cette page.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefillOpen(true)}
          >
            <RefreshCwIcon />
            Réapprovisionner
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            Nouveau bot
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bot</TableHead>
              <TableHead>Jeu</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Raisonnement</TableHead>
              <TableHead>Stratégie</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aucun bot ne correspond à ces filtres.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((bot) => (
                <TableRow key={bot.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <BotIcon className="size-4 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {bot.label ?? bot.displayName ?? bot.gamerTag ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @{bot.gamerTag ?? "—"}
                          {bot.ownerEmail ? ` · ${bot.ownerEmail}` : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {games.find((g) => g.id === bot.gameId)?.title ?? bot.gameId}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={bot.mode === "attached" ? "default" : "outline"}
                    >
                      {bot.mode === "attached" ? "Rattaché" : "Réserve"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {difficultyLabel(bot.difficulty)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {bot.config
                      ? `agg ${bot.config.aggression.toFixed(2)} · prudence ${bot.config.caution.toFixed(2)}`
                      : "défaut"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={bot.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActions bot={bot} onOpen={setDialog} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateBotDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        games={games}
      />

      <RefillPoolDialog
        open={refillOpen}
        onOpenChange={setRefillOpen}
        games={games}
      />

      {dialog?.kind === "edit" && (
        <EditBotDialog
          bot={dialog.bot}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog?.kind === "bind" && (
        <BindBotDialog
          bot={dialog.bot}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteBotDialog
          bot={dialog.bot}
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
    </>
  );
}

function StatusBadge({ status }: { status: AdminBotListRow["status"] }) {
  if (status === "in_match") {
    return (
      <Badge variant="secondary" className="bg-amber-500/15 text-amber-600">
        En partie
      </Badge>
    );
  }
  if (status === "disabled") {
    return <Badge variant="destructive">Désactivé</Badge>;
  }
  return (
    <Badge variant="outline" className="text-emerald-600">
      Disponible
    </Badge>
  );
}

function RowActions({
  bot,
  onOpen,
}: {
  bot: AdminBotListRow;
  onOpen: (d: { kind: "edit" | "bind" | "delete"; bot: AdminBotListRow }) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions pour ${bot.gamerTag ?? bot.id}`}
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">
            {bot.label ?? bot.gamerTag ?? bot.id}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onOpen({ kind: "edit", bot })}>
            <PencilIcon />
            Modifier
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpen({ kind: "bind", bot })}>
            <Link2Icon />
            Rattacher à un compte
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onOpen({ kind: "delete", bot })}>
            <Trash2Icon />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StrategyFields({
  aggression,
  caution,
  onAggression,
  onCaution,
}: {
  aggression: string;
  caution: string;
  onAggression: (value: string) => void;
  onCaution: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label>Agressivité</Label>
        <Select value={aggression} onValueChange={(v) => onAggression(String(v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KNOBS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Prudence</Label>
        <Select value={caution} onValueChange={(v) => onCaution(String(v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KNOBS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AccountPicker({ onSelect }: { onSelect: (a: AttachableAccountRow) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AttachableAccountRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setSearching(true);
      try {
        const rows = await searchAccountsAction(trimmed);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un compte (nom, e-mail, tag)…"
      />
      {searching && <p className="text-xs text-muted-foreground">Recherche…</p>}
      {!searching && results.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-lg border">
          {results.map((account) => (
            <button
              key={account.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => onSelect(account)}
            >
              <span>
                {account.name ?? account.gamerTag ?? account.email ?? account.id}
              </span>
              {account.isBot ? <Badge variant="outline">compte bot</Badge> : null}
            </button>
          ))}
        </div>
      )}
      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun compte trouvé.</p>
      )}
    </div>
  );
}

function ChosenAccount({
  account,
  onClear,
}: {
  account: AttachableAccountRow;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-2 text-sm">
      <span>
        {account.name ?? account.gamerTag ?? account.email}
        {account.gamerTag ? (
          <span className="text-muted-foreground"> · @{account.gamerTag}</span>
        ) : null}
      </span>
      <Button variant="ghost" size="sm" type="button" onClick={onClear}>
        Changer
      </Button>
    </div>
  );
}

function RefillPoolDialog({
  open,
  onOpenChange,
  games,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: GameOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gameId, setGameId] = useState(games[0]?.id ?? "ludo");
  const [count, setCount] = useState("5");

  const submit = () => {
    const parsed = Number.parseInt(count, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 32) {
      toast.error("Indiquez un nombre entre 1 et 32.");
      return;
    }
    startTransition(async () => {
      const result = await provisionBotsAction({ gameId, count: parsed });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réapprovisionner la réserve</DialogTitle>
          <DialogDescription>
            Crée des bots inertes en réserve pour un jeu. Ils sont prêts à être
            réclamés par une nouvelle table — aucun compte réel n&apos;est touché.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Jeu</Label>
            <Select value={gameId} onValueChange={(v) => setGameId(String(v))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refill-count">Nombre</Label>
            <Input
              id="refill-count"
              type="number"
              min={1}
              max={32}
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateBotDialog({
  open,
  onOpenChange,
  games,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: GameOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [gameId, setGameId] = useState(games[0]?.id ?? "ludo");
  const [mode, setMode] = useState<BotMode>("pool");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [label, setLabel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gamerTag, setGamerTag] = useState("");
  const [aggression, setAggression] = useState("0.5");
  const [caution, setCaution] = useState("0.5");
  const [account, setAccount] = useState<AttachableAccountRow | null>(null);

  const reset = () => {
    setGameId(games[0]?.id ?? "ludo");
    setMode("pool");
    setDifficulty("normal");
    setLabel("");
    setDisplayName("");
    setGamerTag("");
    setAggression("0.5");
    setCaution("0.5");
    setAccount(null);
  };

  const submit = () => {
    if (mode === "attached" && !account) {
      toast.error("Choisissez le compte à rattacher.");
      return;
    }
    startTransition(async () => {
      const result = await createBotAction({
        gameId,
        mode,
        difficulty: difficulty as "easy" | "normal" | "hard",
        label: label.trim() || null,
        config: { aggression: Number(aggression), caution: Number(caution) },
        displayName: displayName.trim() || undefined,
        gamerTag: gamerTag.trim() || undefined,
        targetUserId: account?.id,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
        reset();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau bot</DialogTitle>
          <DialogDescription>
            Un bot est un cerveau. En réserve, il joue un compte inerte ;
            rattaché, il joue à la place d&apos;un compte existant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jeu</Label>
              <Select value={gameId} onValueChange={(v) => setGameId(String(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {games.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as BotMode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool">Réserve autonome</SelectItem>
                  <SelectItem value="attached">Rattaché à un compte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Raisonnement</Label>
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <StrategyFields
            aggression={aggression}
            caution={caution}
            onAggression={setAggression}
            onCaution={setCaution}
          />

          <div className="space-y-1.5">
            <Label htmlFor="create-label">Libellé (optionnel)</Label>
            <Input
              id="create-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nom interne du bot"
            />
          </div>

          {mode === "attached" ? (
            <div className="space-y-1.5">
              <Label>Compte à rattacher</Label>
              {account ? (
                <ChosenAccount account={account} onClear={() => setAccount(null)} />
              ) : (
                <AccountPicker onSelect={setAccount} />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-name">Nom affiché (optionnel)</Label>
                <Input
                  id="create-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Généré si vide"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-tag">Gamer tag (optionnel)</Label>
                <Input
                  id="create-tag"
                  value={gamerTag}
                  onChange={(event) => setGamerTag(event.target.value)}
                  placeholder="Généré si vide"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditBotDialog({
  bot,
  onOpenChange,
}: {
  bot: AdminBotListRow;
  onOpenChange: (open: boolean) => void;
}) {
  const [label, setLabel] = useState(bot.label ?? "");
  const [difficulty, setDifficulty] = useState<string>(bot.difficulty);
  const [aggression, setAggression] = useState(
    knobToString(bot.config?.aggression ?? 0.5),
  );
  const [caution, setCaution] = useState(
    knobToString(bot.config?.caution ?? 0.5),
  );
  const [enabled, setEnabled] = useState(bot.status !== "disabled");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    startTransition(async () => {
      const result = await updateBotAction({
        botId: bot.id,
        label: label.trim() || null,
        difficulty: difficulty as "easy" | "normal" | "hard",
        config: { aggression: Number(aggression), caution: Number(caution) },
        enabled,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            Modifier {bot.label ?? bot.gamerTag ?? bot.id}
          </DialogTitle>
          <DialogDescription>
            Raisonnement et stratégie du cerveau. Désactiver le retire de la
            réserve sans supprimer son compte.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-label">Libellé</Label>
            <Input
              id="edit-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Nom interne du bot"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Raisonnement</Label>
            <Select
              value={difficulty}
              onValueChange={(v) => setDifficulty(String(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <StrategyFields
            aggression={aggression}
            caution={caution}
            onAggression={setAggression}
            onCaution={setCaution}
          />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="edit-enabled">Actif</Label>
              <p className="text-xs text-muted-foreground">
                Un bot inactif n&apos;est jamais réclamé par une partie.
              </p>
            </div>
            <Switch
              id="edit-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BindBotDialog({
  bot,
  onOpenChange,
}: {
  bot: AdminBotListRow;
  onOpenChange: (open: boolean) => void;
}) {
  const [account, setAccount] = useState<AttachableAccountRow | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    if (!account) return;
    startTransition(async () => {
      const result = await bindBotAction({
        botId: bot.id,
        targetUserId: account.id,
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rattacher à un compte</DialogTitle>
          <DialogDescription>
            Le cerveau jouera à la place de ce compte. Le compte que le bot
            pilotait avant reste intact.
          </DialogDescription>
        </DialogHeader>
        {account ? (
          <ChosenAccount account={account} onClear={() => setAccount(null)} />
        ) : (
          <AccountPicker onSelect={setAccount} />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button disabled={pending || !account} onClick={submit}>
            {pending ? "Rattachement…" : "Rattacher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteBotDialog({
  bot,
  onOpenChange,
}: {
  bot: AdminBotListRow;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    startTransition(async () => {
      const result = await deleteBotAction({ botId: bot.id });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Supprimer {bot.label ?? bot.gamerTag ?? bot.id} ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {bot.mode === "pool"
              ? "Le compte inerte créé pour ce bot sera supprimé avec lui."
              : "Le compte rattaché est conservé — seul le cerveau est retiré."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {pending ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
