"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mic01Icon,
  MicOffIcon,
  Loading03Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";

import type {
  RoomVoiceController,
  VoiceParticipant,
  VoiceStatus,
} from "@/lib/realtime/use-room-voice";

export interface VoiceControlsProps {
  voice: RoomVoiceController;
}

const STATUS_LABEL: Record<VoiceStatus, string> = {
  off: "Micro désactivé",
  requesting: "Autorisation…",
  connecting: "Connexion vocale…",
  connected: "Voix connectée",
  denied: "Micro refusé",
  unavailable: "Micro indisponible",
  error: "Erreur audio",
};

/** One remote participant: name + realtime speaking dot. */
function VoicePeer({ participant }: { participant: VoiceParticipant }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150 ${
          participant.speaking
            ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]"
            : "bg-slate-600"
        }`}
      />
      <span
        className={`truncate ${
          participant.speaking
            ? "text-slate-100"
            : "text-slate-400"
        }`}
      >
        {participant.name}
      </span>
      {participant.speaking && <span className="sr-only">parle</span>}
    </li>
  );
}

export function VoiceControls({ voice }: VoiceControlsProps) {
  const { status, muted, toggleMic, participants, canSpeak, error } = voice;
  const busy = status === "connecting";

  return (
    <section className="pointer-events-auto w-48 rounded-xl border border-white/10 bg-slate-950/80 p-3 shadow-xl backdrop-blur-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Voix
        </h2>
        <span
          className={`text-[10px] font-medium ${
            status === "connected" ? "text-emerald-400" : "text-slate-500"
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>

      {canSpeak ? (
        <button
          type="button"
          onClick={toggleMic}
          disabled={busy}
          className={`mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            status === "connected" && !muted
              ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
              : "bg-white/10 text-slate-200 hover:bg-white/20"
          } disabled:cursor-wait disabled:opacity-60`}
          aria-pressed={status === "connected" && !muted}
        >
          <HugeiconsIcon
            icon={
              busy
                ? Loading03Icon
                : status === "connected" && !muted
                  ? Mic01Icon
                  : MicOffIcon
            }
            className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
          />
          {status === "connected" && !muted
            ? "Micro actif"
            : busy
              ? "En cours…"
              : "Activer le micro"}
        </button>
      ) : status === "off" ? (
        // Spectators and pending users: listening is opt-in, one click,
        // and never touches their microphone.
        <button
          type="button"
          onClick={toggleMic}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/20"
        >
          <HugeiconsIcon icon={Mic01Icon} className="h-4 w-4" />
          Écouter la voix
        </button>
      ) : status === "connected" ? (
        <button
          type="button"
          onClick={toggleMic}
          className="mt-2.5 flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/20"
        >
          Arrêter l&apos;écoute
        </button>
      ) : (
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {busy ? "Connexion vocale…" : "Écoute seule — seuls les joueurs parlent."}
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-amber-400">
          <HugeiconsIcon icon={Alert02Icon} className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {participants.length > 0 && (
        <ul className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
          {participants.map((participant) => (
            <VoicePeer key={participant.sessionId} participant={participant} />
          ))}
        </ul>
      )}
    </section>
  );
}
