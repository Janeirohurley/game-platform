"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";

import type { ChatRejectionReason, RoomChatMessage } from "./types";

/**
 * The room's ephemeral chat, over the connection the game already uses.
 *
 * Game-agnostic on purpose: it takes a joined room and knows nothing
 * about what is being played in it. Messages are never authored here —
 * the client sends `{ content }` and renders whatever the server
 * broadcasts back, so what it displays is exactly what every other
 * player sees.
 *
 * Nothing is persisted. Leave the room and the list is gone.
 */

const REJECTION_TEXT: Record<ChatRejectionReason, string> = {
  invalid: "Message invalide.",
  empty: "Écris quelque chose avant d'envoyer.",
  "too-long": "Message trop long.",
  "rate-limited": "Tu écris trop vite. Attends un instant.",
  "not-in-room": "Tu n'es plus dans cette partie.",
};

/** Refresh the typing signal this often while the user keeps typing. */
const TYPING_REFRESH_MS = 2_000;
/** Stop signalling (and hide the indicator for oneself) after this idle. */
const TYPING_IDLE_STOP_MS = 6_000;

export interface TypingUser {
  userId: string;
  name: string;
}

export interface RoomChatController {
  messages: RoomChatMessage[];
  /** Set when the room refused the last message; clears on the next send. */
  error: string | null;
  send: (content: string) => void;
  dismissError: () => void;
  /** Others currently typing — refreshed by `notifyTyping`. */
  typingUsers: TypingUser[];
  /** Call on every keystroke; throttles the wire signal itself. */
  notifyTyping: () => void;
}

export function useRoomChat(room: Room | null): RoomChatController {
  const [messages, setMessages] = useState<RoomChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Guards against a late frame from a room we already left.
  const activeRoom = useRef<Room | null>(null);
  /** Timestamp of the last typing signal actually put on the wire. */
  const typingSentAt = useRef(0);

  // Changing room means a different chat: drop what we hold, during
  // render rather than in an effect, so nothing from the previous room
  // is ever painted.
  const [renderedRoom, setRenderedRoom] = useState<Room | null>(room);
  if (room !== renderedRoom) {
    setRenderedRoom(room);
    setMessages([]);
    setError(null);
    setTypingUsers([]);
  }

  useEffect(() => {
    activeRoom.current = room;

    if (!room) return;

    room.onMessage("chatSnapshot", (payload: { messages?: RoomChatMessage[] }) => {
      if (activeRoom.current !== room) return;
      const snapshot = Array.isArray(payload?.messages) ? payload.messages : [];
      // The snapshot is the whole buffer, so it replaces what we hold.
      setMessages([...snapshot].sort((a, b) => a.sequence - b.sequence));
    });

    room.onMessage("chatMessage", (message: RoomChatMessage) => {
      if (activeRoom.current !== room) return;
      setMessages((current) =>
        current.some((existing) => existing.id === message.id)
          ? current
          : [...current, message],
      );
    });

    room.onMessage("chatRejected", (payload: { reason?: ChatRejectionReason }) => {
      if (activeRoom.current !== room) return;
      const reason = payload?.reason;
      setError(
        (reason && REJECTION_TEXT[reason]) || "Message refusé par la partie.",
      );
    });

    // The server owns the typing truth: it prunes stale signals and
    // removes departed participants, so the set can only shrink
    // correctly. No client-side timer to disagree with it.
    room.onMessage("chatTyping", (payload: { users?: TypingUser[] }) => {
      if (activeRoom.current !== room) return;
      setTypingUsers(Array.isArray(payload?.users) ? payload.users : []);
    });

    // Handlers are registered — now ask for the buffer. Doing it here
    // rather than relying on the join-time push avoids missing a
    // snapshot that arrived before this effect ran.
    room.send("chatSync", {});

    return () => {
      // Late frames from this room are ignored from here on; the list
      // itself is cleared by the render-time reset above.
      activeRoom.current = null;
    };
  }, [room]);

  const send = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!room || trimmed.length === 0) return;
      setError(null);
      // Only the content travels. Identity, id, order and timestamp are
      // the server's to decide. Sending also ends our typing signal.
      room.send("chatMessage", { content: trimmed });
      room.send("chatTyping", { isTyping: false });
      typingSentAt.current = 0;
    },
    [room],
  );

  /** Wire throttling: first keystroke at once, then at most every 2s. */
  const notifyTyping = useCallback(() => {
    if (!room) return;
    const now = Date.now();
    if (typingSentAt.current && now - typingSentAt.current < TYPING_REFRESH_MS)
      return;
    typingSentAt.current = now;
    room.send("chatTyping", { isTyping: true });
  }, [room]);

  // Idle watchdog: a user who stops typing without sending stops
  // refreshing the signal; this explicit stop hides the indicator
  // immediately instead of waiting for the server TTL.
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => {
      if (
        typingSentAt.current &&
        Date.now() - typingSentAt.current >= TYPING_IDLE_STOP_MS
      ) {
        typingSentAt.current = 0;
        room.send("chatTyping", { isTyping: false });
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [room]);

  const dismissError = useCallback(() => setError(null), []);

  return { messages, error, send, dismissError, typingUsers, notifyTyping };
}
