"use client";

import { useState } from "react";
import type { Room } from "@colyseus/sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOff02Icon,
  HeadphonesIcon,
  HeadphoneOffIcon,
  Video01Icon,
  VideoOffIcon,
  UserGroupIcon,
  Message01Icon,
  Logout01Icon,
  DoorClosedIcon,
  Cancel01Icon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { Floating } from "@/components/floating";
import type {
  RoomVoiceController,
  VoiceParticipant,
  VoicePeerDiagnostic,
} from "@/lib/realtime/use-livekit-voice";

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const {
    status,
    muted,
    incomingMuted,
    adminMuted,
    toggleVoice,
    toggleMic,
    toggleIncoming,
    participants,
    canSpeak,
    diagnostics,
    cameraOn,
    toggleCamera,
  } = voice;

  const engaged = status !== "off";
  // The mic button reflects the enforced state (an admin mute locks it).
  const micLive = engaged && canSpeak && !muted && !adminMuted;
  const micLocked = canSpeak && adminMuted;
  const pendingStatus = status === "connecting" ? "Connexion vocale…" : null;
  /** Mic failures must be VISIBLE: a refused permission or a blocked
   * context used to fail silently — the button looked dead. */
  const micProblem =
    engaged && canSpeak && voice.error ? micErrorLabel(status) : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex justify-center sm:bottom-4">
      <Floating
        storageKey="call-bar"
        className="relative flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/85 px-2 py-1.5 shadow-2xl backdrop-blur-md"
      >
        {/* TRANSMIT side — the microphone. Voice off: one button engages
            the whole voice connection. Engaged: players flip their mic
            (admin-locked when enforced); spectators hold no mic, so the
            same slot toggles the connection off. */}
        {!engaged ? (
          <CallButton
            label={canSpeak ? "Activer la voix (micro)" : "Écouter la voix"}
            onClick={toggleVoice}
          >
            <HugeiconsIcon
              icon={canSpeak ? MicOff02Icon : HeadphoneOffIcon}
              size={18}
              strokeWidth={1.8}
            />
          </CallButton>
        ) : canSpeak ? (
          <>
            <CallButton
              label={
                micLocked
                  ? "Micro coupé par le créateur"
                  : micLive
                    ? "Couper le micro"
                    : (pendingStatus ?? "Activer le micro")
              }
              active={micLive}
              busy={Boolean(pendingStatus)}
              danger={Boolean(micProblem)}
              onClick={toggleMic}
            >
              <HugeiconsIcon
                icon={micLive ? Mic01Icon : MicOff02Icon}
                size={18}
                strokeWidth={1.8}
              />
            </CallButton>
            {micProblem && (
              <span
                role="alert"
                title={micProblem}
                aria-label={micProblem}
                className="flex size-10 items-center justify-center text-red-400"
              >
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={16}
                  strokeWidth={1.8}
                />
              </span>
            )}
          </>
        ) : null}

        {/* CAMERA — players only, voice engaged: LiveKit publishes the
            track on demand; the stage shows it when someone turns one
            on. Off by default: a board game does not need it. */}
        {engaged && canSpeak && (
          <CallButton
            label={cameraOn ? "Couper la caméra" : "Activer la caméra"}
            active={cameraOn}
            onClick={toggleCamera}
          >
            <HugeiconsIcon
              icon={cameraOn ? Video01Icon : VideoOffIcon}
              size={18}
              strokeWidth={1.8}
            />
          </CallButton>
        )}

        {/* RECEIVE side — the others' voices, a LOCAL listening control
            (spec §7): muting here never touches the mic and never
            reaches the server. */}
        {engaged && (
          <CallButton
            label={
              incomingMuted
                ? "Activer le son des autres"
                : "Couper le son des autres"
            }
            active={!incomingMuted}
            onClick={toggleIncoming}
          >
            <HugeiconsIcon
              icon={incomingMuted ? HeadphoneOffIcon : HeadphonesIcon}
              size={18}
              strokeWidth={1.8}
            />
          </CallButton>
        )}

        {/* Diagnostics — mesh health at a glance: one dot + peer count,
            click for the signaling event log. Lives in dev AND prod:
            it is how a remote player reports a voice bug without ever
            opening the console. */}
        {engaged && (
          <div className="relative">
            <VoiceDiagnosticsBadge
              status={status}
              peers={diagnostics.peers}
              micAttached={diagnostics.micAttached || !canSpeak}
              meshSize={participants.length}
              lastEvent={diagnostics.lastEvent}
              open={showDiagnostics}
              onClick={() => setShowDiagnostics((v) => !v)}
            />
            {showDiagnostics && (
              <DiagnosticsPopover
                status={status}
                diagnostics={diagnostics}
                onClose={() => setShowDiagnostics(false)}
              />
            )}
          </div>
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
          badge={
            unreadChat > 0 ? (unreadChat > 9 ? "9+" : unreadChat) : undefined
          }
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
      </Floating>
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

/** Human-readable label for a mic failure, from the voice status. */
function micErrorLabel(status: RoomVoiceController["status"]): string | null {
  switch (status) {
    case "denied":
      return "Micro refusé — clique le micro pour réessayer, ou autorise le site dans les réglages du navigateur (icône à gauche de l'adresse).";
    case "unavailable":
      return "Aucun micro détecté sur cet appareil.";
    case "error":
      return "Le micro n'a pas pu démarrer — réessaie ou recharge la page.";
    default:
      return "Le navigateur n'a pas répondu à la demande de micro (prompt caché ou contexte qui le bloque).";
  }
}

/** Health color of one peer connection, for the badge dot. */
function worstPeerState(
  peers: VoicePeerDiagnostic[],
): "connected" | "connecting" | "broken" {
  if (peers.length === 0) return "connecting";
  if (peers.some((p) => p.connectionState === "connected")) return "connected";
  const stuck = peers.some(
    (p) =>
      p.connectionState === "failed" ||
      (p.signalingState === "have-local-offer" && p.connectionState === "new"),
  );
  if (stuck) return "broken";
  return "connecting";
}

/** The tiny always-visible voice health indicator. */
function VoiceDiagnosticsBadge({
  status,
  peers,
  micAttached,
  meshSize,
  lastEvent,
  open,
  onClick,
}: {
  status: RoomVoiceController["status"];
  peers: VoicePeerDiagnostic[];
  /** The REAL microphone is captured (spectators always pass true). */
  micAttached: boolean;
  meshSize: number;
  lastEvent: string | null;
  open: boolean;
  onClick: () => void;
}) {
  const broken =
    status === "denied" ||
    status === "unavailable" ||
    status === "error" ||
    worstPeerState(peers) === "broken";
  // "connected" is the mesh being up, not audio flowing: alone in a
  // room it used to light up green while the user heard nothing. Green
  // now requires either a live remote stream or a live microphone.
  const live =
    !broken &&
    status === "connected" &&
    (peers.some((p) => p.connectionState === "connected") || micAttached);
  const color = broken
    ? "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.9)]"
    : live && micAttached
      ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
      : "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]";
  return (
    <button
      type="button"
      title={lastEvent ?? "Diagnostic vocal"}
      aria-label="Diagnostic vocal"
      aria-pressed={open}
      onClick={onClick}
      className="relative flex h-10 items-center gap-1.5 rounded-full px-2.5 text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <span
        aria-hidden
        className={`size-2 rounded-full transition-colors ${color}`}
      />
      <span className="text-[11px] font-semibold tabular-nums">{meshSize}</span>
    </button>
  );
}

/** Click-through detail: states per peer + the signaling event log. */
function DiagnosticsPopover({
  status,
  diagnostics,
  onClose,
}: {
  status: RoomVoiceController["status"];
  diagnostics: RoomVoiceController["diagnostics"];
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-12 right-0 w-72 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl backdrop-blur-md">
      <header className="flex items-center justify-between px-1.5 pb-1.5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Diagnostic vocal
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
      <p className="px-1.5 pb-1 text-[11px] text-white/60">
        Statut&nbsp;: {status} ·{" "}
        {diagnostics.peers.length === 0
          ? "seul·e dans le room"
          : `${diagnostics.peers.length} connexion(s)`}{" "}
        · micro&nbsp;: {diagnostics.micAttached ? "capté" : "non capté"}
      </p>
      {diagnostics.peers.length > 0 && (
        <ul className="space-y-0.5 px-1.5 pb-1">
          {diagnostics.peers.map((peer) => (
            <li
              key={peer.sessionId}
              className="flex items-center gap-1.5 text-[10px] tabular-nums text-white/50"
            >
              <span className="truncate">{peer.sessionId}</span>
              <span className="ml-auto">{peer.connectionState}</span>
              <span className="text-white/25">·</span>
              <span>{peer.signalingState}</span>
              {peer.publishing && <span title="micro attaché">🎤</span>}
            </li>
          ))}
        </ul>
      )}
      <ol className="max-h-40 space-y-0.5 overflow-y-auto px-1.5 pb-1 pt-0.5">
        {diagnostics.events.length === 0 ? (
          <li className="text-[10px] text-white/30">Aucun événement.</li>
        ) : (
          diagnostics.events.map((event, index) => (
            <li
              key={`${index}-${event}`}
              className={`text-[10px] leading-snug ${
                index === diagnostics.events.length - 1
                  ? "text-white/80"
                  : "text-white/40"
              }`}
            >
              {event}
            </li>
          ))
        )}
      </ol>
    </div>
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
                    title={
                      p.audible ? "Couper son micro" : "Réactiver son micro"
                    }
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
