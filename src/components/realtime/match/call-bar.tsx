"use client";

import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOff02Icon,
  HeadphonesIcon,
  HeadphoneOffIcon,
  UserGroupIcon,
  Message01Icon,
  Logout01Icon,
  DoorClosedIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";

import type {
  RoomVoiceController,
  VoiceParticipant,
} from "@/lib/realtime/use-room-voice";

export interface CallBarProps {
  voice: RoomVoiceController;
  /** The joined room — admin mute messages go through it. */
  room: Room;
  /** Platform id of the local viewer ("" for guests). */
  viewerUserId: string;
  /** Opens the chat panel (owned by the parent — RoomChat stays put). */
  chatOpen: boolean;
  onToggleChat: () => void;
  /** Unread chat count, for the badge. */
  unreadChat: number;
  /** Open the two-step leave confirmation (owned by the parent). */
  onLeaveRequest: () => void;
  /** Admin only — close the room for everyone. */
  onCloseRoom: () => void;
  /** True when this viewer is the room admin. */
  isAdmin: boolean;
}

/**
 * Zoom-style call bar, bottom-centre of the match screen: every call
 * control lives on ONE icon-only line — mic, participants (popover with
 * speaking dots), chat (unread badge), then quit/close in red. Words
 * become tooltips; the board keeps the space.
 */
export function CallBar({
  voice,
  room,
  viewerUserId,
  chatOpen,
  onToggleChat,
  unreadChat,
  onLeaveRequest,
  onCloseRoom,
  isAdmin,
}: CallBarProps) {
  const [showParticipants, setShowParticipants] = useState(false);
  const {
    status,
    muted,
    adminMuted,
    toggleMic,
    participants,
    canSpeak,
  } = voice;

  const engaged = status !== "off";
  // A player with voice on is BOTH speaking-capable and listening; the
  // mic button reflects the enforced state (an admin mute locks it).
  const micLive = engaged && canSpeak && !muted && !adminMuted;
  const micLocked = canSpeak && adminMuted;
  const listening = engaged && !canSpeak;
  const pendingStatus =
    status === "requesting"
      ? "Autorisation micro…"
      : status === "connecting"
        ? "Connexion vocale…"
        : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center sm:bottom-4">
      <div className="pointer-events-auto relative flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/85 px-2 py-1.5 shadow-2xl backdrop-blur-md">
        {/* Mic — the primary control. Players toggle mic; spectators see
            their listening state and drop voice with the same button.
            An admin-imposed mute locks the button (server-enforced). */}
        {canSpeak ? (
          <CallButton
            label={
              micLocked
                ? "Micro coupé par le créateur"
                : micLive
                  ? "Couper le micro"
                  : pendingStatus ?? "Activer le micro (et écouter)"
            }
            active={micLive}
            busy={Boolean(pendingStatus)}
            onClick={toggleMic}
          >
            <HugeiconsIcon
              icon={micLive ? Mic01Icon : MicOff02Icon}
              size={18}
              strokeWidth={1.8}
            />
          </CallButton>
        ) : (
          <CallButton
            label={
              pendingStatus ?? (listening ? "Arrêter l'écoute" : "Écouter la voix")
            }
            active={listening}
            busy={Boolean(pendingStatus)}
            onClick={toggleMic}
          >
            <HugeiconsIcon
              icon={listening ? HeadphonesIcon : HeadphoneOffIcon}
              size={18}
              strokeWidth={1.8}
            />
          </CallButton>
        )}

        {/* Participants — popover with speaking dots and the voice state. */}
        <div className="relative">
          <CallButton
            label="Participants"
            active={showParticipants}
            badge={participants.length > 0 ? participants.length : undefined}
            onClick={() => setShowParticipants((v) => !v)}
          >
            <HugeiconsIcon icon={UserGroupIcon} size={18} strokeWidth={1.8} />
          </CallButton>

              {showParticipants && (
            <ParticipantsPopover
              participants={participants}
              isAdmin={isAdmin}
              viewerUserId={viewerUserId}
              onAdminMute={(userId, mute) =>
                room.send("voice:admin-mute", { userId, muted: mute })
              }
              onClose={() => setShowParticipants(false)}
            />
          )}
        </div>

        {/* Chat — parent owns the panel; the badge shows unread. */}
        <CallButton
          label="Chat"
          active={chatOpen}
          badge={unreadChat > 0 ? (unreadChat > 9 ? "9+" : unreadChat) : undefined}
          onClick={onToggleChat}
        >
          <HugeiconsIcon icon={Message01Icon} size={18} strokeWidth={1.8} />
        </CallButton>

        <span aria-hidden className="mx-1 h-6 w-px bg-white/10" />

        {/* Quit — red, consistent with the destructive semantics. */}
        <CallButton label="Quitter la partie" danger onClick={onLeaveRequest}>
          <HugeiconsIcon icon={Logout01Icon} size={18} strokeWidth={1.8} />
        </CallButton>

        {isAdmin && (
          <CallButton label="Fermer la room" danger onClick={onCloseRoom}>
            <HugeiconsIcon icon={DoorClosedIcon} size={18} strokeWidth={1.8} />
          </CallButton>
        )}
      </div>
    </div>
  );
}

/** One icon button of the bar. */
function CallButton({
  label,
  active,
  busy,
  danger,
  badge,
  onClick,
  children,
}: {
  label: string;
  /** Lit state (mic live, popover open…). */
  active?: boolean;
  /** Waiting on something (permission…) — spinner instead of icon. */
  busy?: boolean;
  /** Destructive action — red tint. */
  danger?: boolean;
  badge?: string | number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`relative flex size-10 items-center justify-center rounded-full transition-colors ${
        danger
          ? "text-red-300 hover:bg-red-500/80 hover:text-white"
          : active
            ? "bg-white/15 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
      } ${busy ? "cursor-wait" : ""}`}
    >
      {children}
      {badge !== undefined && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Who is in the voice roster, with their live speaking/audible state.
    The admin gets a mute toggle per player (server-enforced). */
function ParticipantsPopover({
  participants,
  isAdmin,
  viewerUserId,
  onAdminMute,
  onClose,
}: {
  participants: VoiceParticipant[];
  isAdmin: boolean;
  viewerUserId: string;
  onAdminMute: (userId: string, mute: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-12 left-1/2 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-md">
      <header className="flex items-center justify-between px-1.5 pb-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Voix
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex size-6 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
        </button>
      </header>
      {participants.length === 0 ? (
        <p className="px-1.5 pb-1 text-[11px] text-white/40">
          Personne n&apos;a activé la voix.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {participants.map((p) => {
            // The admin can mute anyone but themselves; a muted player
            // shows a struck-through mic (server state, not a claim).
            const canAdminMute =
              isAdmin && p.userId !== viewerUserId && p.userId !== "";
            return (
              <li
                key={p.sessionId}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs text-white/75"
              >
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full transition-colors ${
                    p.speaking
                      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
                      : p.audible
                        ? "bg-white/30"
                        : "bg-white/15"
                  }`}
                />
                <span className={`truncate ${p.speaking ? "text-white" : ""}`}>
                  {p.name}
                </span>
                {!p.audible && (
                  <HugeiconsIcon
                    icon={MicOff02Icon}
                    size={12}
                    strokeWidth={1.8}
                    className="ml-auto shrink-0 text-white/30"
                  />
                )}
                {canAdminMute && (
                  <button
                    type="button"
                    title={p.audible ? "Couper son micro" : "Réactiver son micro"}
                    aria-label={
                      p.audible ? "Couper son micro" : "Réactiver son micro"
                    }
                    onClick={() => onAdminMute(p.userId, p.audible)}
                    className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white"
                  >
                    <HugeiconsIcon
                      icon={p.audible ? MicOff02Icon : Mic01Icon}
                      size={13}
                      strokeWidth={1.8}
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
