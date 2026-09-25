"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, LinkSquare01Icon } from "@hugeicons/core-free-icons";

import type { LobbyViewProps } from "./lobby-types";

/**
 * Generic invite bar: displays the room id and a copy-link button.
 * The link format works for any game: /games/{gameId}/join/{roomId}.
 */
export function InviteBar({ snapshot, inviteUrl, onCopyInvite }: LobbyViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyInvite();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-400">
        <HugeiconsIcon icon={LinkSquare01Icon} className="size-4" />
        Code de la room
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-200">
          {snapshot.gameId} · {inviteUrl}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          <HugeiconsIcon icon={Copy01Icon} className="size-4" />
          {copied ? "Copié !" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
