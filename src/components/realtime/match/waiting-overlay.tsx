"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Clock01Icon,
  Copy01Icon,
  LinkSquare01Icon,
  EyeIcon,
  EyeOffIcon,
} from "@hugeicons/core-free-icons";
import type { JoinRequestStatus } from "@/lib/realtime/types";

export interface WaitingOverlayProps {
  /** Room id — used to build the invite link. */
  roomId: string;
  gameId: string;
  /** The viewer is waiting for the admin's approval. */
  pendingRequest: boolean;
  /** True when the viewer joined as spectator (watch mode). */
  isSpectator: boolean;
  /** Show the invite block to the admin only. */
  isAdmin: boolean;
  onCopyInvite: () => void;
  /** Requester only — withdraw the pending request. */
  onCancelRequest?: () => void;
  /** Spectator only — switch to asking for a player seat. */
  onRequestJoin?: () => void;
  requestStatus?: JoinRequestStatus | "idle" | "submitting" | "retrying" | "failed";
  requestError?: string | null;
  onRetryRequest?: () => void;
  connectionStatus?: string;
}

/**
 * Centre-top notice of the integrated waiting phase (spec section 14):
 * the invitation for the admin, the pending banner for requesters, the
 * "watching" marker for spectators. Deliberately light — the board
 * behind it stays the main visual.
 */
export function WaitingOverlay({
  roomId,
  gameId,
  pendingRequest,
  isSpectator,
  isAdmin,
  onCopyInvite,
  onCancelRequest,
  onRequestJoin,
  requestStatus,
  requestError,
  onRetryRequest,
  connectionStatus,
}: WaitingOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex flex-col items-center gap-2 px-4 text-center">
      {pendingRequest && (
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-xl border border-amber-500/30 bg-black/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-md">
          <p className="flex items-center gap-1.5 text-sm font-medium text-amber-300">
            <HugeiconsIcon icon={Clock01Icon} size={14} strokeWidth={1.8} />
            {requestStatus === "submitting" || requestStatus === "retrying"
              ? "Confirmation de votre demande en cours…"
              : "Votre demande est en attente de l&apos;approbation du créateur."}
          </p>
          {onCancelRequest && (
            <button
              type="button"
              onClick={onCancelRequest}
              className="text-xs text-white/60 underline underline-offset-4 transition hover:text-white"
            >
              Annuler ma demande
            </button>
          )}
        </div>
      )}

      {requestError && (
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-xl border border-rose-500/30 bg-black/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-md">
          <p className="text-sm font-medium text-rose-200">{requestError}</p>
          {onRetryRequest && (
            <button
              type="button"
              onClick={onRetryRequest}
              className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/30"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {connectionStatus && connectionStatus !== "connected" && (
        <p className="rounded-lg bg-black/55 px-3 py-1.5 text-xs text-white/75 shadow-lg backdrop-blur-md" role="status">
          {connectionStatus === "reconnecting"
            ? "Connexion perdue. Reconnexion en cours…"
            : connectionStatus === "synchronizing"
              ? "Connecté. Synchronisation de la demande…"
              : "Connexion instable. Vérification de la demande…"}
        </p>
      )}

      {isSpectator && onRequestJoin && (
        <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-xl border border-sky-500/30 bg-black/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-md">
          <p className="flex items-center gap-1.5 text-sm font-medium text-sky-300">
            <HugeiconsIcon icon={EyeIcon} size={14} strokeWidth={1.8} />
            Vous regardez la partie en spectateur.
          </p>
          <button
            type="button"
            onClick={onRequestJoin}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500"
          >
            <HugeiconsIcon icon={EyeOffIcon} size={12} strokeWidth={1.8} />
            Demander à jouer
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-white shadow-lg backdrop-blur-md">
          <p className="flex max-w-[16rem] items-center gap-1.5 truncate text-xs text-white/70 sm:max-w-xs">
            <HugeiconsIcon icon={LinkSquare01Icon} size={12} strokeWidth={1.8} />
            Partagez le lien pour inviter des joueurs :
            <span className="truncate font-mono text-[10px] text-white/45">
              /games/{gameId}/join/{roomId}
            </span>
          </p>
          <button
            type="button"
            onClick={onCopyInvite}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/20"
          >
            <HugeiconsIcon icon={Copy01Icon} size={12} strokeWidth={1.8} />
            Copier
          </button>
        </div>
      )}
    </div>
  );
}
