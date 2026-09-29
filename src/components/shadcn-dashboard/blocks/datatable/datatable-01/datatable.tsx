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

import type { AdminUserRow } from "@/lib/admin/queries";

/**
 * Registry block (datatable-01), content-adapted for REAL data:
 *  - rows come from the server page (SQL LIMIT/OFFSET slice),
 *  - search & page live in the URL (server-side pagination),
 *  - the CSV export downloads exactly the CURRENT page,
 *  - status badges map to the platform's real account states.
 * TanStack Table keeps the row-model wiring; paging stays server-owned.
 */

export interface UsersTableProps {
    rows: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    search: string;
}

// Colors for real account states (mirrors the registry's badge grammar)
const statusColors: Record<string, string> = {
    banned: "bg-destructive/10! text-destructive! hover:bg-destructive/10!",
    unverified: "bg-orange-400/10! text-orange-400! hover:bg-orange-400/10!",
    active: "bg-chart-2/10! text-chart-2! hover:bg-chart-2/10!",
};

function accountStatus(row: AdminUserRow): { key: string; label: string } {
    if (row.banned) return { key: "banned", label: "banni" };
    if (!row.emailVerified) return { key: "unverified", label: "non vérifié" };
    return { key: "active", label: "actif" };
}

const columnHelper = createColumnHelper<AdminUserRow>();

const columns = [
    columnHelper.accessor("name", {
        header: () => <span>Utilisateur</span>,
        cell: (info) => (
            <div className="flex gap-3 items-center min-w-48">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                    {info.getValue().slice(0, 2).toUpperCase()}
                </span>
                <div>
                    <h6 className="text-sm font-medium">{info.getValue()}</h6>
                    <p className="text-xs text-muted-foreground">
                        {info.row.original.email}
                    </p>
                </div>
            </div>
        ),
    }),
    columnHelper.accessor("role", {
        header: () => <span>Rôle</span>,
        cell: (info) => (
            <Badge
                variant={info.getValue() === "admin" ? "default" : "outline"}
                className="capitalize"
            >
                {info.getValue()}
            </Badge>
        ),
    }),
    columnHelper.accessor("hasProfile", {
        header: () => <span>Profil gamer</span>,
        cell: (info) => (
            <span className="text-sm text-muted-foreground">
                {info.getValue() ? "créé" : "—"}
            </span>
        ),
    }),
    columnHelper.accessor("createdAt", {
        header: () => <span>Inscrit le</span>,
        cell: (info) => (
            <span className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                    info.getValue(),
                )}
            </span>
        ),
    }),
    columnHelper.accessor("banned", {
        header: () => <span>Statut</span>,
        cell: (info) => {
            const status = accountStatus(info.row.original);
            return (
                <Badge className={`${statusColors[status.key]} border-0 shadow-none`}>
                    {status.label}
                </Badge>
            );
        },
    }),
];

function pageHref(page: number, search: string): string {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/users?${query}` : "/admin/users";
}

const UsersTable = ({
    rows,
    total,
    page,
    pageSize,
    totalPages,
    search,
}: UsersTableProps) => {
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
        const headers = ["Name", "Email", "Role", "Status", "CreatedAt"];

        const csvRows = rows.map((item) =>
            [
                `"${item.name}"`,
                `"${item.email}"`,
                `"${item.role}"`,
                `"${accountStatus(item).label}"`,
                `"${item.createdAt.toISOString()}"`,
            ].join(",")
        );

        const csvContent = [headers.join(","), ...csvRows].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "users-page.csv");
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
                        placeholder="Rechercher un nom ou un email…"
                        className="pl-9"
                        aria-label="Rechercher des utilisateurs"
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
                                            ? `Aucun compte ne correspond à « ${search.trim()} ».`
                                            : "Aucun compte inscrit pour le moment."}
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
                    {windowStart}–{windowEnd} sur {total.toLocaleString("fr-FR")} comptes
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

export default UsersTable;
