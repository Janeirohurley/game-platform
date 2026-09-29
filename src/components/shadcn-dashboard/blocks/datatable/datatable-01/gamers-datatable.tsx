"use client"
import {
    createColumnHelper,
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink, SearchIcon } from "lucide-react";
import Link from "next/link";
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
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { formatRelativeTime } from "@/lib/admin/format";
import type { AdminGamerRow } from "@/lib/admin/queries";

/**
 * Registry block (datatable-01), same content-adaptation as the users
 * table but for the GAMER population (profiles ⋈ user): rows come from
 * the server page (SQL LIMIT/OFFSET), search & page live in the URL,
 * the CSV export downloads exactly the CURRENT page. TanStack Table
 * keeps the row-model wiring; paging stays server-owned.
 */

export interface GamersTableProps {
    rows: AdminGamerRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    search: string;
}

const visibilityColors: Record<string, string> = {
    public: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10!",
    private: "bg-muted! text-muted-foreground! hover:bg-muted!",
};

const columnHelper = createColumnHelper<AdminGamerRow>();

const columns = [
    columnHelper.accessor("username", {
        header: () => <span>Gamer</span>,
        cell: (info) => (
            <div className="flex gap-3 items-center min-w-48">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {info.getValue().slice(0, 2).toUpperCase()}
                </span>
                <div>
                    {/* The tag IS the drill-down link to /admin/gamers/[username]. */}
                    <Link
                        href={`/admin/gamers/${info.getValue()}`}
                        className="text-sm font-medium hover:underline"
                    >
                        @{info.getValue()}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                        {info.row.original.displayName ?? info.row.original.accountName}
                    </p>
                </div>
            </div>
        ),
    }),
    columnHelper.accessor("level", {
        header: () => <span>Niveau</span>,
        cell: (info) => (
            <div className="flex items-center gap-2">
                <Badge variant="secondary">Niv. {info.getValue()}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {info.row.original.xp.toLocaleString("fr-FR")} XP
                </span>
            </div>
        ),
    }),
    columnHelper.accessor("rating", {
        header: () => <span>Rating</span>,
        cell: (info) => (
            <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("gamesPlayed", {
        header: () => <span>Parties</span>,
        cell: (info) => (
            <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
    }),
    columnHelper.accessor("wins", {
        header: () => <span>Bilan</span>,
        cell: (info) => {
            const g = info.row.original;
            return (
                <span className="text-xs tabular-nums">
                    <span className="text-chart-2">{g.wins}V</span>
                    {" · "}
                    <span className="text-destructive">{g.losses}D</span>
                    {g.draws > 0 && (
                        <>
                            {" · "}
                            <span className="text-muted-foreground">{g.draws}N</span>
                        </>
                    )}
                </span>
            );
        },
    }),
    columnHelper.accessor("isPublic", {
        header: () => <span>Visibilité</span>,
        cell: (info) => (
            <Badge
                className={`${visibilityColors[info.getValue() ? "public" : "private"]} border-0 shadow-none`}
            >
                {info.getValue() ? "public" : "privé"}
            </Badge>
        ),
    }),
    columnHelper.accessor("lastPlayedAt", {
        header: () => <span>Dernière partie</span>,
        cell: (info) => {
            const last = info.row.original.lastPlayedAt;
            return (
                <span className="text-sm text-muted-foreground">
                    {last ? formatRelativeTime(last) : "—"}
                </span>
            );
        },
    }),
    columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: (info) => (
            <Button
                variant="ghost"
                size="icon-sm"
                render={
                    <Link
                        href={`/profile/${info.row.original.username}`}
                        aria-label={`Profil public de @${info.row.original.username}`}
                        target="_blank"
                    />
                }
            >
                <ExternalLink />
            </Button>
        ),
    }),
];

function pageHref(page: number, search: string): string {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/gamers?${query}` : "/admin/gamers";
}

const GamersTable = ({
    rows,
    total,
    page,
    pageSize,
    totalPages,
    search,
}: GamersTableProps) => {
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
        const headers = ["GamerTag", "DisplayName", "Level", "XP", "Rating", "GamesPlayed", "Wins", "Losses", "Draws", "Visibility", "LastPlayedAt"];

        const csvRows = rows.map((g) =>
            [
                `"${g.username}"`,
                `"${g.displayName ?? ""}"`,
                g.level,
                g.xp,
                g.rating,
                g.gamesPlayed,
                g.wins,
                g.losses,
                g.draws,
                g.isPublic ? "public" : "private",
                `"${g.lastPlayedAt?.toISOString() ?? ""}"`,
            ].join(",")
        );

        const csvContent = [headers.join(","), ...csvRows].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "gamers-page.csv");
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

    return (
        <section className="w-full">
            {/* Toolbar: search (URL-driven) + registry CSV export */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <form
                    className="relative w-full max-w-sm"
                    onSubmit={(event) => {
                        event.preventDefault();
                        router.push(pageHref(1, term));
                    }}
                >
                    <SearchIcon
                        size={16}
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        value={term}
                        onChange={(event) => setTerm(event.target.value)}
                        placeholder="Rechercher un gamer, un nom ou un email…"
                        className="pl-9"
                        aria-label="Rechercher des gamers"
                    />
                </form>
                <Button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 cursor-pointer hover:bg-primary/80"
                >
                    <Download size={15} />
                    Export CSV
                </Button>
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
                                        {search.trim()
                                            ? `Aucun gamer ne correspond à « ${search.trim()} ».`
                                            : "Aucun profil gamer pour le moment."}
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

            {/* Server-side pagination — plain links, no client state */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground tabular-nums">
                    {windowStart}–{windowEnd} sur {total.toLocaleString("fr-FR")} gamers
                </p>
                {totalPages > 1 && (
                    <Pagination className="mr-auto w-auto justify-end">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    text="Précédent"
                                    href={page > 1 ? pageHref(page - 1, search) : undefined}
                                    aria-disabled={page <= 1}
                                    className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                                />
                            </PaginationItem>
                            {pageNumbers.map((p) => (
                                <PaginationItem key={p}>
                                    <PaginationLink
                                        href={pageHref(p, search)}
                                        isActive={p === page}
                                    >
                                        {p}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}
                            <PaginationItem>
                                <PaginationNext
                                    text="Suivant"
                                    href={page < totalPages ? pageHref(page + 1, search) : undefined}
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

export default GamersTable;
