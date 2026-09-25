"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { RoomChatMessage } from "@/lib/realtime/types";

interface MessageListProps {
  messages: RoomChatMessage[];
  viewerUserId: string;
}

/** Distinct, readable hue per speaker, derived from the user id. */
function nameColor(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index++) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 360;
  }
  return `hsl(${hash} 70% 45%)`;
}

const time = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * The message list, newest at the bottom.
 *
 * It follows new messages only while the reader is already at the
 * bottom: someone scrolled up reading older messages is never yanked
 * back down. Content is rendered as text — never as HTML.
 */
export function MessageList({ messages, viewerUserId }: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  // Track whether the reader is at the bottom, with a small tolerance.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;

    const onScroll = () => {
      const distance =
        node.scrollHeight - node.scrollTop - node.clientHeight;
      setPinned(distance < 40);
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (node && pinned) node.scrollTop = node.scrollHeight;
  }, [messages, pinned]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-label="Messages de la partie"
        className="flex h-full flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {messages.length === 0 ? (
          <p className="my-auto text-center text-xs text-slate-400 dark:text-white/30">
            Pas encore de message. Les messages disparaissent avec la partie.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.userId === viewerUserId;

            return (
              <p key={message.id} className="text-sm leading-snug">
                <span
                  className="font-semibold"
                  style={mine ? undefined : { color: nameColor(message.userId) }}
                >
                  {mine ? "Toi" : message.username}
                </span>

                <span className="ml-1.5 text-[10px] tabular-nums text-slate-400 dark:text-white/25">
                  {time.format(new Date(message.createdAt))}
                </span>

                {/* Plain text: user content is never injected as HTML. */}
                <span className="ml-1.5 break-words text-slate-700 dark:text-white/75">
                  {message.content}
                </span>
              </p>
            );
          })
        )}
      </div>

      {!pinned && messages.length > 0 && (
        <button
          type="button"
          onClick={() => setPinned(true)}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white shadow-lg dark:bg-white dark:text-black"
        >
          Nouveaux messages ↓
        </button>
      )}
    </div>
  );
}
