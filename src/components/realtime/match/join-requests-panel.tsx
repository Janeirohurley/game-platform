"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircleIcon,
  UserXIcon,
  UserAdd01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";

import type {
  LobbyPendingRequestView,
  LobbySnapshot,
} from "@/lib/realtime/types";
import type { MatchRole } from "@/lib/realtime/use-match-room";

export interface JoinRequestsPanelProps {
  snapshot: LobbySnapshot;
  /** The local viewer's own role (admin sees approve/reject controls). */
  role: MatchRole;
  onApprove: (userId: string, requestId: string) => void;
  onReject: (userId: string, requestId: string) => void;
}

/**
 * Bottom-left overlay (spec section 14): the player join requests, shown
 * directly inside the match. The admin gets Accept / Reject controls;
 * everyone else — including the requesters themselves — never sees them.
 * The requester instead reads the pending banner (see WaitingOverlay).
 */
export function JoinRequestsPanel({
  snapshot,
  role,
  onApprove,
  onReject,
}: JoinRequestsPanelProps) {
  if (role !== "admin") return null;

  const requests = [...snapshot.pendingPlayerRequests].sort(
    (a, b) => a.requestedAt - b.requestedAt,
  );
  if (requests.length === 0) return null;

  const isFull = snapshot.players.length >= snapshot.targetPlayers;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-40 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-black/55 p-2.5 text-white shadow-lg backdrop-blur-md sm:bottom-4 sm:left-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/60">
        <HugeiconsIcon icon={UserAdd01Icon} size={12} strokeWidth={1.8} />
        Demandes d&apos;accès ({requests.length})
      </p>

      <ul className="mt-2 flex flex-col gap-2">
        {requests.map((request) => (
          <li key={request.userId}>
            <RequestRow
              request={request}
              disabled={isFull}
              onApprove={onApprove}
              onReject={onReject}
            />
          </li>
        ))}
      </ul>

      {isFull && (
        <p className="mt-2 text-[10px] text-amber-300">
          La table est pleine — libère une place pour accepter.
        </p>
      )}
    </div>
  );
}

function RequestRow({
  request,
  disabled,
  onApprove,
  onReject,
}: {
  request: LobbyPendingRequestView;
  disabled: boolean;
  onApprove: (userId: string, requestId: string) => void;
  onReject: (userId: string, requestId: string) => void;
}) {
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-2">
      <p className="truncate text-sm font-medium" title={request.name}>
        {request.name}
      </p>
      <p className="flex items-center gap-1 text-[10px] text-white/45">
        <HugeiconsIcon icon={Clock01Icon} size={10} strokeWidth={1.8} />
        veut rejoindre la partie
      </p>
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => request.requestId && onApprove(request.userId, request.requestId)}
          disabled={disabled || !request.requestId}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HugeiconsIcon icon={CheckmarkCircleIcon} size={12} strokeWidth={2} />
          Accepter
        </button>
        <button
          type="button"
          onClick={() => request.requestId && onReject(request.userId, request.requestId)}
          disabled={!request.requestId}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/85 transition hover:bg-red-500/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <HugeiconsIcon icon={UserXIcon} size={12} strokeWidth={2} />
          Refuser
        </button>
      </div>
    </div>
  );
}
