"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import type { Room } from "@colyseus/sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Message01Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";

import { useRoomChat } from "@/lib/realtime";
import { CHAT_MAX_CONTENT_LENGTH } from "@/lib/realtime/types";

import { MessageList } from "./message-list";

interface RoomChatProps {
  room: Room | null;
  viewerUserId: string;
  /**
   * `floating` overlays the game (a bubble that opens a panel) and suits
   * a board that owns the whole viewport. `panel` is a plain block that
   * a page lays out itself.
   */
  variant?: "floating" | "panel";
}

/**
 * The room's chat. Generic room infrastructure: it takes a joined room
 * and works the same for Checkers, Ludo and anything added later.
 *
 * Messages last as long as the room does. Nothing is stored.
 */
export function RoomChat({
  room,
  viewerUserId,
  variant = "floating",
}: RoomChatProps) {
  const { messages, error, send, dismissError } = useRoomChat(room);
  const [open, setOpen] = useState(variant === "panel");
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState(0);
  const inputId = useId();

  const unread = open ? 0 : Math.max(0, messages.length - seen);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setSeen(messages.length);
  }, [messages.length]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSeen(messages.length);
  }, [messages.length]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (draft.trim().length === 0) return;
      send(draft);
      setDraft("");
    },
    [draft, send],
  );

  const body = (
    <>
      <MessageList messages={messages} viewerUserId={viewerUserId} />

      {error && (
        <p
          role="alert"
          onClick={dismissError}
          className="cursor-pointer border-t border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-slate-200/80 p-2 dark:border-white/10"
      >
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>

        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={CHAT_MAX_CONTENT_LENGTH}
          autoComplete="off"
          placeholder="Écrire un message…"
          disabled={!room}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white/80 px-3 text-sm outline-none placeholder:text-slate-400 focus-visible:border-slate-400 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/25 dark:focus-visible:border-white/30"
        />

        <button
          type="submit"
          disabled={!room || draft.trim().length === 0}
          aria-label="Envoyer"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white transition enabled:hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-black dark:enabled:hover:bg-white/90"
        >
          <HugeiconsIcon icon={SentIcon} size={16} strokeWidth={1.8} />
        </button>
      </form>
    </>
  );

  if (variant === "panel") {
    return (
      <section
        aria-label="Chat de la partie"
        className="flex h-[26rem] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 backdrop-blur-xl lg:h-full dark:border-white/10 dark:bg-white/[0.035]"
      >
        <Header onClose={null} count={messages.length} />
        {body}
      </section>
    );
  }

  // Floating: a bubble that opens a panel anchored bottom-right.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-end p-3 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:p-0">
      {open ? (
        <section
          aria-label="Chat de la partie"
          className="pointer-events-auto flex h-[min(60vh,26rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl sm:w-80 dark:border-white/10 dark:bg-neutral-900/95"
        >
          <Header onClose={handleClose} count={messages.length} />
          {body}
        </section>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          className="pointer-events-auto relative flex h-11 items-center gap-2 rounded-full bg-slate-950/90 px-4 text-sm font-semibold text-white shadow-xl backdrop-blur-sm transition hover:bg-slate-800 dark:bg-white/95 dark:text-black dark:hover:bg-white"
        >
          <HugeiconsIcon icon={Message01Icon} size={17} strokeWidth={1.8} />
          Chat
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

function Header({
  onClose,
  count,
}: {
  onClose: (() => void) | null;
  count: number;
}) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-3 py-2 dark:border-white/10">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">Chat</h2>
        <span className="text-[11px] text-slate-400 dark:text-white/30">
          éphémère · {count}
        </span>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le chat"
          className="flex size-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.8} />
        </button>
      )}
    </header>
  );
}
