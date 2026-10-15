"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RefreshOverlay } from "@/components/loading/refresh-overlay";
import { TableSkeleton } from "@/components/loading/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  walletApi,
  WalletApiError,
  type TransactionListResponse,
} from "@/lib/wallet/api-client";
import { WALLET_TRANSACTION_STATUSES, WALLET_TRANSACTION_TYPES } from "@/lib/wallet/constants";
import {
  formatDateTime,
  signedMoney,
  StatusBadge,
  typeLabel,
} from "./wallet-shared";

type Props = {
  /** Bumped by the parent after a mutation → refetch current page. */
  refreshToken: number;
  onOpenDetail: (id: string) => void;
  initial?: TransactionListResponse;
};

function statusLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function keyOf(parts: {
  page: number;
  type: string;
  status: string;
  search: string;
  refreshToken: number;
}): string {
  return JSON.stringify(parts);
}

/**
 * Paginated transaction history with filters (type, status, search).
 * All paging is server-side; a row click opens the full audit dialog.
 * Loaded state is KEYED by the query it answers — while a new query
 * is in flight the previous rows stay visible (no flash), and state
 * is only written from async callbacks.
 */
export function TransactionsTable({
  refreshToken,
  onOpenDetail,
  initial,
}: Props) {
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryKey = keyOf({ page, type, status, search, refreshToken });
  const [loaded, setLoaded] = useState<{
    key: string;
    result: TransactionListResponse;
  } | null>(
    initial
      ? {
          key: keyOf({ page: 1, type: "", status: "", search: "", refreshToken: 0 }),
          result: initial,
        }
      : null,
  );
  const [loadError, setLoadError] = useState<{
    key: string;
    message: string;
  } | null>(null);

  // Debounced search → server query (async setState inside the timer).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let stale = false;
    walletApi
      .transactions({
        page,
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
      })
      .then((result) => {
        if (stale) return;
        setLoaded({ key: queryKey, result });
        setLoadError(null);
      })
      .catch((error) => {
        if (stale) return;
        if (error instanceof WalletApiError) {
          setLoadError({ key: queryKey, message: error.message });
        }
      });
    return () => {
      stale = true;
    };
  }, [page, type, status, search, refreshToken, queryKey]);

  const data = loaded?.result ?? null;
  const error =
    loadError && loadError.key === queryKey ? loadError.message : null;
  const loading = !loaded || loaded.key !== queryKey;

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={type}
          onChange={(e) => {
            setType(e.currentTarget.value);
            setPage(1);
          }}
          aria-label="Filter by type"
        >
          <NativeSelectOption value="">All types</NativeSelectOption>
          {WALLET_TRANSACTION_TYPES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {typeLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          value={status}
          onChange={(e) => {
            setStatus(e.currentTarget.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {WALLET_TRANSACTION_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.currentTarget.value)}
          placeholder="Search id / reference…"
          className="w-full sm:w-56"
          aria-label="Search transactions"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Body — first load has no rows yet, so the skeleton stands in for
          the table itself (same 5 columns, same row height). */}
      {!data && !error && (
        <TableSkeleton
          columns={5}
          rows={8}
          cellWidths={["w-32", "w-20", "w-28", "w-24", "w-20"]}
        />
      )}

      {data && data.rows.length === 0 && !loading && !error && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">◎</EmptyMedia>
            <EmptyTitle>No transactions yet</EmptyTitle>
            <EmptyDescription>
              Your deposits, withdrawals, refunds and game stakes will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {data && data.rows.length > 0 && (
        // Rows stay mounted while a new page/filter is in flight: the
        // overlay dims + sweeps them instead of swapping them for a
        // skeleton, so the table never collapses mid-scroll.
        <RefreshOverlay busy={loading} label="Loading transactions…">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Provider</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="cursor-pointer"
                    onClick={() => onOpenDetail(tx.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onOpenDetail(tx.id);
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(tx.createdAt)}
                    </TableCell>
                    <TableCell>{typeLabel(tx.type)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {tx.provider ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {signedMoney(tx, tx.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </RefreshOverlay>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.total} transaction{data.total === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              Page {data.page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
