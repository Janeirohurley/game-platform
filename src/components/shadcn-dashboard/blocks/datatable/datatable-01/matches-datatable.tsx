"use client"
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, SearchIcon } from "lucide-react";
import { Link } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import {
    NativeSelect,
    NativeSelectOption,
} from "@/components/ui/native-select";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatDuration, formatRelativeTime } from "@/lib/admin/format";
import type { AdminMatchRow } from "@/lib/admin/queries";

/**
 * Registry block (datatable-01), content-adapted for the MATCHES audit
 * trail: server-side pagination + game/outcome filters (URL-driven, so
 * every view is linkable), CSV export of the current page. The Actions
 * column is state-appropriate: a finished match is read-only by design
 * — the server owns the result — so the only real action is inspecting
 * the participant (gamer drill-down), never a fake "close/delete".
 */

export interface MatchesTableProps {
    rows: AdminMatchRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    search: string;
    game: string;
    outcome: string;
    games: { id: string; title: string }[];
}

const outcomeColors: Record<string, string> = {
    win: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10!",
    loss: "bg-destructive/10! text-destructive! hover:bg-destructive/10!",
    draw: "bg-muted! text-muted-foreground! hover:bg-muted!",
};

const outcomeLabels: Record<string, string> = {
    win: "victoire",
    loss: "défaite",
    draw: "nulle",
};

const columnHelper = createColumnHelper<AdminMatchRow>();

const columns = [
    columnHelper.accessor("gameTitle", {
        header: () => <span>Jeu</span>,
        cell: (info) => (
            <span className="text-sm font-medium">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("playerName", {
        header: () => <span>Joueur</span>,
        cell: (info) => {
            const tag = info.row.original.gamerTag;
            return (
                <div>
                    <h6 className="text-sm font-medium">{info.getValue()}</h6>
                    {tag && (
                        <Link
                            href={`/admin/gamers/${tag}`}
                            className="text-xs text-muted-foreground hover:underline"
                        >
                            @{tag}
                        </Link>
                    )}
                </div>
            );
        },
    }),
    columnHelper.accessor("outcome", {
        header: () => <span>Résultat</span>,
        cell: (info) => (
            <Badge className={`${outcomeColors[info.getValue()]} border-0 shadow-none`}>
                {outcomeLabels[info.getValue()]}
            </Badge>
        ),
    }),
    columnHelper.accessor("ratingDelta", {
        header: () => <span>Rating</span>,
        cell: (info) => (
            <span
                className={`text-sm tabular-nums ${
                    info.getValue() >= 0 ? "text-chart-2" : "text-destructive"
                }`}
            >
                {info.getValue() >= 0 ? "+" : ""}
                {info.getValue()}
            </span>
        ),
    }),
    columnHelper.accessor("xpEarned", {
        header: () => <span>XP</span>,
        cell: (info) => (
            <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("durationSeconds", {
        header: () => <span>Durée</span>,
        cell: (info) => (
            <span className="text-sm">{formatDuration(info.getValue())}</span>
        ),
    }),
    columnHelper.accessor("playerCount", {
        header: () => <span>Table</span>,
        cell: (info) => (
            <span className="text-sm tabular-nums text-muted-foreground">
                {info.getValue()} joueur{info.getValue() > 1 ? "s" : ""}
            </span>
        ),
    }),
    columnHelper.accessor("playedAt", {
        header: () => <span>Quand</span>,
        cell: (info) => (
            <span className="text-sm text-muted-foreground">
                {formatRelativeTime(info.getValue())}
            </span>
        ),
    }),
];

function pageHref(
    page: number,
    search: string,
    game: string,
    outcome: string,
): string {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (game) params.set("game", game);
    if (outcome) params.set("outcome", outcome);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/matches?${query}` : "/admin/matches";
}

const MatchesTable = ({
    rows,
    total,
    page,
    pageSize,
    totalPages,
    search,
    game,
    outcome,
    games,
}: MatchesTableProps) => {
    const router = useRouter();
    const [term, setTerm] = useState(search);

    // Keep the input in sync when navigation changes the URL.
    useEffect(() => {
        setTerm(search);
    }, [search]);

    // Registry pattern: TanStack Table manages its own row model — the
    // React compiler cannot instrument it, hence the local exemption.
    // eslint-disable-next-line react-hooks/incompatible-library -- see above
    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: totalPages,
    });

    const handleDownload = () => {
        const headers = ["Game", "Player", "GamerTag", "Outcome", "RatingDelta", "XP", "Duration", "PlayerCount", "PlayedAt"];

        const csvRows = rows.map((m) =>
            [
                `"${m.gameTitle}"`,
                `"${m.playerName}"`,
                `"${m.gamerTag ?? ""}"`,
                m.outcome,
                m.ratingDelta,
                m.xpEarned,
                m.durationSeconds,
                m.playerCount,
                `"${m.playedAt.toISOString()}"`,
            ].join(",")
        );

        const csvContent = [headers.join(","), ...csvRows].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "matches-page.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const windowStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const windowEnd = Math.min(page * pageSize, total);
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
        (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
    );

    // Filter change = new URL (page resets to 1).
    const filterHref = (patch: { game?: string; outcome?: string }) =>
        pageHref(1, search, patch.game ?? game, patch.outcome ?? outcome);

    return (
        <section className="w-full">
            {/* Toolbar: search + real filters + CSV export */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <form
                    className="relative w-full max-w-sm"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.push(pageHref(1, term, game, outcome));
                    }}
                >
                    <SearchIcon
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder="Rechercher un joueur ou un tag…"
                        className="pl-9"
                        aria-label="Rechercher des matchs"
                    />
                </form>
                <div className="flex flex-wrap items-center gap-2">
                    <NativeSelect
                        aria-label="Filtrer par jeu"
                        className="w-40"
                        value={game}
                        onChange={(event) =>
                            router.push(filterHref({ game: event.target.value }))
                        }
                    >
                        <NativeSelectOption value="">Tous les jeux</NativeSelectOption>
                        {games.map((g) => (
                            <NativeSelectOption key={g.id} value={g.id}>
                                {g.title}
                            </NativeSelectOption>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        aria-label="Filtrer par résultat"
                        className="w-36"
                        value={outcome}
                        onChange={(event) =>
                            router.push(filterHref({ outcome: event.target.value }))
                        }
                    >
                        <NativeSelectOption value="">Tous résultats</NativeSelectOption>
                        <NativeSelectOption value="win">victoires</NativeSelectOption>
                        <NativeSelectOption value="loss">défaites</NativeSelectOption>
                        <NativeSelectOption value="draw">nulles</NativeSelectOption>
                    </NativeSelect>
                    <Button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 cursor-pointer hover:bg-primary/80"
                    >
                        <Download size={15} />
                        Export CSV
                    </Button>
                </div>
            </div>

            <Card className="">
                <div className="overflow-x-auto">
                    <Table className="min-w-full">
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="text-sm font-medium text-left border-b border-border px-4 py-3 h-auto"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext(),
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody className="divide-y divide-border">
                            {table.getRowModel().rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="py-10 text-center text-sm text-muted-foreground"
                                    >
                                        {search.trim() || game || outcome
                                            ? "Aucun match ne correspond à ces critères — modifie la recherche ou les filtres."
                                            : "Aucun match enregistré pour le moment."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className="whitespace-nowrap py-3 px-4"
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Server-side pagination — plain links, filters preserved */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground tabular-nums">
                    {windowStart}–{windowEnd} sur {total.toLocaleString("fr-FR")} matchs
                </p>
                {totalPages > 1 && (
                    <Pagination className="mr-auto w-auto justify-end">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    text="Précédent"
                                    href={page > 1 ? pageHref(page - 1, search, game, outcome) : undefined}
                                    aria-disabled={page <= 1}
                                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>
                            {pageNumbers.map((p) => (
                                <PaginationItem key={p}>
                                    <PaginationLink
                                        href={pageHref(p, search, game, outcome)}
                                        isActive={p === page}
                                    >
                                        {p}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}
                            <PaginationItem>
                                <PaginationNext
                                    text="Suivant"
                                    href={page < totalPages ? pageHref(page + 1, search, game, outcome) : undefined}
                                    aria-disabled={page >= totalPages}
                                    className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>
        </section>
    );
};

export default MatchesTable;
