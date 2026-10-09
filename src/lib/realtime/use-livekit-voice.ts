"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room as ColyseusRoom } from "@colyseus/sdk";
import {
  Room as LkRoom,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type LocalAudioTrack,
  type AudioCaptureOptions,
} from "livekit-client";

import type { LobbySnapshot } from "./types";
import {
  livekitRoomName,
  LIVEKIT_TOKEN_ENDPOINT,
} from "@/lib/livekit/room-name";

/**
 * Voice/video over LiveKit — game state stays on Colyseus.
 *
 * Division of responsibility:
 *
 *   - Colyseus owns GAME STATE. It decides who plays, who watches, who
 *     may act. Nothing here may change that.
 *   - LiveKit owns MEDIA ONLY. It moves audio/video between browsers
 *     that the Colyseus room has already admitted (the token route
 *     checks room membership server-side before minting any token).
 *     A LiveKit outage degrades voice/video and nothing else: the
 *     board keeps running, because nothing in the game-state path
 *     imports this module.
 *
 * The two are joined only by a DERIVED room name (`game-room-<roomId>`
 * from `lib/livekit/room-name.ts`) — no second room-id system.
 *
 * The token comes from `/api/livekit/token`, which authenticates the
 * user (better-auth) and authorizes them against the room roster
 * BEFORE minting; this hook never constructs credentials.
 */

/**
 * Browser-side audio processing applied to EVERY microphone capture
 * (initial enable, unmute toggle, admin-mute lift). `voiceIsolation`
 * is the Chrome-only strong noise suppression; browsers without it
 * treat an unsupported ideal constraint as best-effort, so capture
 * falls back to plain `noiseSuppression` and never fails over it.
 */
const MICROPHONE_CAPTURE_OPTIONS: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  voiceIsolation: true,
};

/** `getSettings()` omits what the browser does not report — say so. */
const appliedFlag = (value: boolean | undefined): string =>
  value === true ? "on" : value === false ? "off" : "n/r";

/**
 * Reads back what the browser ACTUALLY applied to the capture. The
 * constraints above are best-effort: `voiceIsolation` is Chromium-only
 * and a browser may silently drop any of them. Surfaced in the
 * diagnostics feed so a live session can tell "processing requested"
 * from "processing in effect" before blaming the room acoustics.
 */
const appliedCaptureSettings = (track: LocalAudioTrack): string => {
  const settings = track.mediaStreamTrack.getSettings() as MediaTrackSettings & {
    voiceIsolation?: boolean;
  };
  return [
    `écho ${appliedFlag(settings.echoCancellation as boolean)}`,
    `bruit ${appliedFlag(settings.noiseSuppression)}`,
    `gain ${appliedFlag(settings.autoGainControl)}`,
    `isolation ${appliedFlag(settings.voiceIsolation)}`,
  ].join(" · ");
};

/** The voice connection, as the user experiences it. */
export type VoiceStatus =
  | "off" // voice not engaged — nothing requested, nothing flowing
  | "connecting" // token/connect in flight — not yet on the media server
  | "connected" // on the media server, alone or not (presence = the count)
  | "denied" // mic permission refused — listen-only, the match goes on
  | "unavailable" // no microphone / browser cannot provide one
  | "error"; // anything else that aborted the media setup

/** One remote participant, as the diagnostics panel shows it. */
export interface VoicePeerDiagnostic {
  /** LiveKit identity — stable `user-<userId>` derived server-side. */
  sessionId: string;
  connectionState: string;
  /** LiveKit has no per-peer signaling states: kept for UI parity. */
  signalingState: string;
  ice: string;
  /** The participant is publishing their microphone, unmuted. */
  publishing: boolean;
  /** Track enabled — false = locally muted. null = no track. */
  trackEnabled: boolean | null;
}

/** Live media snapshot, for the CallBar diagnostic badge. */
export interface VoiceMeshDiagnostics {
  lastEvent: string | null;
  events: string[];
  peers: VoicePeerDiagnostic[];
  /** The LOCAL microphone is captured (a real LocalAudioTrack exists). */
  micAttached: boolean;
}

export interface VoiceParticipant {
  /** LiveKit identity — stable `user-<userId>` derived server-side. */
  sessionId: string;
  userId: string;
  name: string;
  /** True while their audio level says they are talking. */
  speaking: boolean;
  /** False when their mic is logically muted (server `voiceMuted`). */
  audible: boolean;
}

export interface RoomVoiceController {
  status: VoiceStatus;
  /** Logical mic state — mirrors the server's `player.voiceMuted`. */
  muted: boolean;
  /**
   * INDEPENDENT control: true = the others' voices are silenced for me
   * only (local volume). Never sent to the server, never affects my
   * microphone.
   */
  incomingMuted: boolean;
  /** True when the ADMIN muted THIS player: their own unmute is
   * refused server-side until the admin lifts it. */
  adminMuted: boolean;
  /** Join/leave the voice connection entirely. */
  toggleVoice: () => void;
  /** Flip MY microphone while engaged (does not touch incoming audio). */
  toggleMic: () => void;
  /** Flip MY incoming audio (does not touch my microphone). */
  toggleIncoming: () => void;
  /** Tear everything down (leave, unmount, room close). */
  stop: () => void;
  /** Others currently in the media room, with speaking state. */
  participants: VoiceParticipant[];
  /** True when this viewer may ever speak (seated player). */
  canSpeak: boolean;
  error: string | null;
  /** Live media diagnostics (CallBar badge). */
  diagnostics: VoiceMeshDiagnostics;
  /** Video — camera published locally. */
  cameraOn: boolean;
  /** Toggle my camera (publishes/unpublishes the camera track). */
  toggleCamera: () => void;
  /**
   * The connected LiveKit Room, exposed so the UI can mount the
   * official components (RoomContext). `null` while disengaged.
   */
  mediaRoom: LkRoom | null;
}

const FAILURE_REASON = {
  denied: "Autorisation microphone refusée. Tu écoutes la partie sans micro.",
  unavailable: "Aucun microphone disponible sur cet appareil.",
  error: "Le micro n'a pas pu démarrer sur cet appareil.",
} as const;

/** Classify a media error into a user-facing voice status. */
function classifyMediaError(error: unknown): VoiceStatus {
  const name =
    error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied";
  }
  if (
    name === "NotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    name === "AbortError"
  ) {
    return "unavailable";
  }
  return "error";
}

/** Short label for a media error, for the diagnostics event ring. */
function errorLabel(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name || "erreur";
  }
  return "inconnue";
}

const EMPTY_DIAGNOSTICS: VoiceMeshDiagnostics = {
  lastEvent: null,
  events: [],
  peers: [],
  micAttached: false,
};

interface UseLiveKitVoiceOptions {
  /** The joined Colyseus room — its id derives the LiveKit room name. */
  room: ColyseusRoom;
  /** Mirrored lobby snapshot — roles are read from it, never claimed. */
  snapshot: LobbySnapshot | null;
  /** Platform user id of the local viewer ("" for anonymous guests). */
  viewerUserId: string;
  /**
   * Engage voice as soon as the server snapshot confirms the viewer's
   * role (spec §3/§12 default: incoming audio ON, microphone OFF —
   * seated players still get their own permission prompt, spectators
   * never do).
   */
  autoListenOnArrival?: boolean;
}

/**
 * Extract the platform user id from a LiveKit identity. Identities are
 * `user-<userId>` (minted server-side); a foreign identity that does
 * not match the convention simply has no known user.
 */
function userIdFromIdentity(identity: string): string {
  return identity.startsWith("user-") ? identity.slice("user-".length) : "";
}

export function useLiveKitVoice(
  options: UseLiveKitVoiceOptions,
): RoomVoiceController {
  const { room, snapshot, viewerUserId } = options;
  const autoListen = options.autoListenOnArrival ?? false;

  const [status, setStatus] = useState<VoiceStatus>("off");
  const [muted, setMuted] = useState(true);
  /**
   * The INCOMING control — LOCAL ONLY. Implemented as remote-volume
   * changes (LiveKit `setVolume`): subscriptions keep flowing, so
   * unmuting is instant and nobody else's state changes.
   */
  const [incomingMuted, setIncomingMuted] = useState(false);
  /** Admin-imposed mute on THIS player (server-enforced). */
  const [adminMuted, setAdminMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Remote participants (LiveKit identities). */
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());
  /** Live media diagnostics for the CallBar badge. */
  const [diagnostics, setDiagnostics] = useState<VoiceMeshDiagnostics>(
    EMPTY_DIAGNOSTICS,
  );
  const [cameraOn, setCameraOn] = useState(false);

  /** The LiveKit Room object — the entire media connection. */
  const lkRoomRef = useRef<LkRoom | null>(null);
  /** Same object as state, for the RoomContext consumers. */
  const [mediaRoom, setMediaRoom] = useState<LkRoom | null>(null);
  /** Guards against a stale token fetch answering after disengage. */
  const engagedRef = useRef(false);
  /** The local mic track, for the diagnostics' micAttached flag. */
  const micRef = useRef<LocalAudioTrack | null>(null);
  /** Latest incoming-mute preference for freshly subscribed peers. */
  const incomingMutedRef = useRef(false);

  // ------------------------------------------------------------------
  // Role resolution — from the SERVER state, never from a client claim.
  // ------------------------------------------------------------------
  const canSpeak = useMemo(() => {
    if (!snapshot) return false;
    return snapshot.players.some((player) => player.userId === viewerUserId);
  }, [snapshot, viewerUserId]);

  // ------------------------------------------------------------------
  // Diagnostics helper — one snapshot of the media room.
  // ------------------------------------------------------------------
  const pushDiagnostics = useCallback((event?: string) => {
    const lk = lkRoomRef.current;
    setDiagnostics((current) => {
      const peers: VoicePeerDiagnostic[] = [];
      if (lk) {
        for (const p of lk.remoteParticipants.values()) {
          const pub = p.getTrackPublication(Track.Source.Microphone);
          const audioTrack = pub?.audioTrack ?? null;            peers.push({
              sessionId: p.identity,
              connectionState: p.connectionQuality ?? "unknown",
              signalingState: String(p.kind),
            ice: pub
              ? pub.isSubscribed
                ? "subscribed"
                : "unsubscribed"
              : "unpublished",
            publishing: Boolean(pub && !pub.isMuted),
            trackEnabled: audioTrack
              ? audioTrack.mediaStreamTrack.enabled
              : null,
          });
        }
      }
      return {
        lastEvent: event ?? current.lastEvent,
        events:
          event !== undefined
            ? [...current.events.slice(-7), event]
            : current.events,
        peers,
        micAttached: Boolean(micRef.current),
      };
    });
  }, []);

  /** Record one media event (dev console + diagnostics ring). */
  const emit = useCallback(
    (message: string) => {
      if (process.env.NODE_ENV !== "production") {
        console.info(`[voice] ${message}`);
      }
      pushDiagnostics(message);
    },
    [pushDiagnostics],
  );

  // ------------------------------------------------------------------
  // Teardown — idempotent; used by disengage, leave and unmount.
  // ------------------------------------------------------------------
  const stop = useCallback((): void => {
    engagedRef.current = false;
    const lk = lkRoomRef.current;
    lkRoomRef.current = null;
    micRef.current = null;
    setMediaRoom(null);
    if (lk) {
      lk.removeAllListeners();
      void lk.disconnect().catch(() => undefined);
    }
    setRemoteIds([]);
    setSpeakingIds(new Set());
    setDiagnostics(EMPTY_DIAGNOSTICS);
    setCameraOn(false);
    setStatus("off");
    setMuted(true);
    setError(null);
    // incomingMuted is deliberately NOT reset: it is the user's
    // listening preference, independent of being in voice at all.
  }, []);

  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  // Unmount / room swap: full cleanup.
  useEffect(() => () => stopRef.current(), []);

  // ------------------------------------------------------------------
  // Engage — fetch a token, connect, wire events.
  // ------------------------------------------------------------------
  const engage = useCallback(async (): Promise<void> => {
    if (engagedRef.current) return;
    engagedRef.current = true;
    setError(null);
    setStatus("connecting");
    setDiagnostics(EMPTY_DIAGNOSTICS);

    try {
      // 1. Derive the media room name from the Colyseus room id —
      //    game-agnostic, deterministic.
      const roomName = livekitRoomName(room.roomId);

      // 2. Mint a token from OUR server. An ANONYMOUS viewer (no
      //    platform session) asks for the guest spectator scope: a
      //    RECEIVE-ONLY media token — they hear the match, they can
      //    never publish. A signed-in viewer goes through the full
      //    auth + membership verification.
      const anonymous = viewerUserId === "";
      const response = await fetch(
        `${LIVEKIT_TOKEN_ENDPOINT}?roomId=${encodeURIComponent(room.roomId)}${
          anonymous ? "&scope=spectator" : ""
        }`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const message =
          response.status === 401
            ? "Connecte-toi pour utiliser la voix."
            : response.status === 403
              ? "Tu ne fais pas partie de cette partie."
              : response.status === 503
                ? "Vérification de la room impossible — réessaie."
                : "Le service vocal est indisponible.";
        throw new Error(message);
      }
      const payload = (await response.json()) as {
        token?: string;
        url?: string;
      };
      if (!payload.token || !payload.url) {
        throw new Error("Jeton vocal invalide.");
      }

      if (!engagedRef.current) return; // disengaged while fetching

      // 3. Connect. Simulcast off keeps a 2–6 player board light;
      //    dynacast stops publishing streams nobody watches.
      const lk = new LkRoom({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { simulcast: false },
        // Processed capture for every mic acquisition below.
        audioCaptureDefaults: MICROPHONE_CAPTURE_OPTIONS,
      });

      const refresh = (): void => {
        setRemoteIds([...lk.remoteParticipants.keys()]);
        pushDiagnostics();
        // UPGRADE-ONLY: once joined, the status stays "connected" —
        // being ALONE on the channel is not "connecting" (a solo
        // player with quiet spectators must not look broken), and a
        // mic-failure state (denied/unavailable/error) is preserved.
        setStatus((current) =>
          current === "connecting" ? "connected" : current,
        );
      };

      lk.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        emit(`${p.identity} a rejoint la voix`);
        refresh();
        if (incomingMutedRef.current) p.setVolume(0);
      });
      lk.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        emit(`${p.identity} a quitté la voix`);
        refresh();
      });
      lk.on(RoomEvent.TrackMuted, () => pushDiagnostics());
      lk.on(RoomEvent.TrackUnmuted, () => pushDiagnostics());
      lk.on(RoomEvent.TrackSubscribed, () => pushDiagnostics());
      lk.on(RoomEvent.TrackUnsubscribed, () => pushDiagnostics());
      lk.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeakingIds(new Set(speakers.map((s) => s.identity)));
      });
      lk.on(RoomEvent.Disconnected, () => {
        if (engagedRef.current) {
          emit("déconnecté du serveur vocal");
          stop();
        }
      });
      lk.on(RoomEvent.SignalReconnecting, () => emit("reconnexion du signal…"));

      emit(`connexion → ${roomName}`);
      await lk.connect(payload.url, payload.token);
      lkRoomRef.current = lk;
      setMediaRoom(lk);
      emit("connecté au serveur vocal");

      // 4. The MIC is requested only for seated players (spectators
      //    never trigger a permission prompt — their absence is by
      //    design, not a failure). The camera stays off: the user
      //    enables it explicitly.
      if (canSpeak) {
        try {
          // The enable happens after connect, so it must carry the
          // capture options explicitly (they are not implied here).
          await lk.localParticipant.setMicrophoneEnabled(
            true,
            MICROPHONE_CAPTURE_OPTIONS,
          );
          micRef.current =
            lk.localParticipant.getTrackPublication(Track.Source.Microphone)
              ?.audioTrack as LocalAudioTrack | undefined ?? null;
          setMuted(false);
          emit("mic → capté");
          if (micRef.current) {
            emit(`traitement audio → ${appliedCaptureSettings(micRef.current)}`);
          }
        } catch (micError) {
          const failure = classifyMediaError(micError);
          emit(`mic → échec (${errorLabel(micError)})`);
          if (failure === "denied") {
            setStatus("denied");
            setError(FAILURE_REASON.denied);
          } else if (failure === "unavailable") {
            setStatus("unavailable");
            setError(FAILURE_REASON.unavailable);
          } else {
            setStatus("error");
            setError(FAILURE_REASON.error);
          }
          // Deliberately NO disconnect: the media room stays up
          // listen-only. The game is unaffected either way.
        }
      }

      refresh();
      // Connected to the media server — that is the whole meaning of
      // this status now. Who else is present is the participants
      // count, not a connection state.
      setStatus("connected");
    } catch (engageError) {
      if (!engagedRef.current) return;
      emit(`échec connexion (${errorLabel(engageError)})`);
      setStatus("error");
      setError(
        engageError instanceof Error
          ? engageError.message
          : "Connexion vocale impossible.",
      );
      lkRoomRef.current?.disconnect().catch(() => undefined);
      lkRoomRef.current = null;
      engagedRef.current = false;
    }
  }, [room, viewerUserId, canSpeak, emit, pushDiagnostics, stop]);

  // ------------------------------------------------------------------
  // Auto-listen on arrival.
  // ------------------------------------------------------------------
  const autoEngagedRef = useRef(false);
  useEffect(() => {
    if (!autoListen || autoEngagedRef.current || !snapshot) return;
    autoEngagedRef.current = true;
    void engage();
  }, [autoListen, snapshot, engage]);

  // ------------------------------------------------------------------
  // Toggles — the independent controls of the spec.
  // ------------------------------------------------------------------
  const toggleVoice = useCallback((): void => {
    if (status === "off" || status === "error") {
      void engage();
      return;
    }
    stop();
  }, [status, engage, stop]);

  const toggleMic = useCallback((): void => {
    const lk = lkRoomRef.current;
    if (!lk || status === "off" || status === "error") {
      void engage();
      return;
    }
    if (!canSpeak) {
      // Listen-only has no mic to flip — same as before.
      stop();
      return;
    }
    // Server-enforced: an admin-imposed mute refuses this unmute, so
    // the local track must not flip either — only the admin lifts it.
    if (adminMuted && muted) return;
    void (async () => {
      try {
        const next = !muted;
        await lk.localParticipant.setMicrophoneEnabled(
          !next,
          MICROPHONE_CAPTURE_OPTIONS,
        );
        micRef.current =
          lk.localParticipant.getTrackPublication(Track.Source.Microphone)
            ?.audioTrack as LocalAudioTrack | undefined ?? null;
        setMuted(next);
        room.send("voice:mute", { muted: next });
        emit(next ? "mic coupé" : "mic activé");
        if (micRef.current && !next) {
          emit(`traitement audio → ${appliedCaptureSettings(micRef.current)}`);
        }
      } catch (micError) {
        emit(`mic → échec (${errorLabel(micError)})`);
      }
    })();
  }, [status, canSpeak, muted, adminMuted, engage, emit, room, stop]);

  const toggleCamera = useCallback((): void => {
    const lk = lkRoomRef.current;
    if (!lk || status === "off" || status === "error") return;
    void (async () => {
      try {
        const next = !cameraOn;
        await lk.localParticipant.setCameraEnabled(next);
        setCameraOn(next);
        emit(next ? "caméra activée" : "caméra coupée");
      } catch (camError) {
        emit(`caméra → échec (${errorLabel(camError)})`);
        // A denied/missing camera must not kill the voice connection:
        // leave the status alone if voice is already established.
        if (status !== "connected" && status !== "connecting") {
          setStatus(classifyMediaError(camError));
        }
      }
    })();
  }, [cameraOn, status, emit]);

  const toggleIncoming = useCallback((): void => {
    setIncomingMuted((current) => {
      const next = !current;
      incomingMutedRef.current = next;
      // Local volume only: subscriptions keep flowing, the server
      // never learns about it — nobody else's experience changes.
      const lk = lkRoomRef.current;
      if (lk) {
        for (const p of lk.remoteParticipants.values()) {
          p.setVolume(next ? 0 : 1);
        }
      }
      return next;
    });
  }, []);

  // ------------------------------------------------------------------
  // Admin remote-mute: the broadcast tells everyone; for the target it
  // also flips the REAL local track (audio stops flowing immediately).
  // ------------------------------------------------------------------
  useEffect(() => {
    const unsub = room.onMessage(
      "voice:adminMuted",
      (payload: { userId?: string; muted?: boolean }) => {
        const isMe =
          snapshot?.players.some(
            (p) => p.userId === viewerUserId && p.userId === payload.userId,
          ) ?? false;
        if (!isMe) return;
        const mutedNow = payload.muted !== false;
        setAdminMuted(mutedNow);
        setMuted(mutedNow);
        void lkRoomRef.current?.localParticipant
          .setMicrophoneEnabled(!mutedNow, MICROPHONE_CAPTURE_OPTIONS)
          .catch(() => undefined);
      },
    );
    return unsub;
  }, [room, snapshot, viewerUserId]);

  // On media-room entry, announce the logical state so rosters agree
  // from the start (the schema default is muted=true; an engaging
  // player is not).
  useEffect(() => {
    if (status === "connected" && canSpeak && !muted && !adminMuted) {
      room.send("voice:mute", { muted: false });
    }
  }, [status, canSpeak, muted, adminMuted, room]);

  // ------------------------------------------------------------------
  // Roster: media participants joined with lobby players for names,
  // plus the server's logical mute (`voiceMuted`) for the roster dot.
  // ------------------------------------------------------------------
  const participants = useMemo<VoiceParticipant[]>(() => {
    const byUserId = new Map<string, LobbySnapshot["players"][number]>();
    for (const player of snapshot?.players ?? []) {
      byUserId.set(player.userId, player);
    }
    const bySpectatorId = new Map<
      string,
      LobbySnapshot["spectators"][number]
    >();
    for (const spectator of snapshot?.spectators ?? []) {
      bySpectatorId.set(spectator.userId, spectator);
    }
    const entries: VoiceParticipant[] = [];
    for (const identity of remoteIds) {
      if (identity === mediaRoom?.localParticipant.identity) continue;
      // Guest spectators carry a per-connection identity (`guest-<uuid>`),
      // not a platform user id: no roster entry can match them, and they
      // NEVER publish — their audio/track state is meaningless.
      const isGuest = identity.startsWith("guest-");
      const userId = isGuest ? "" : userIdFromIdentity(identity);
      const player = userId ? byUserId.get(userId) : undefined;
      const spectator = userId ? bySpectatorId.get(userId) : undefined;
      entries.push({
        sessionId: identity,
        userId,
        name: player?.name ?? spectator?.name ?? (isGuest ? "Spectateur" : "Participant"),
        speaking: speakingIds.has(identity),
        audible: player
          ? player.adminMuted !== true && player.voiceMuted !== true
          : true,
      });
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }, [remoteIds, speakingIds, snapshot, mediaRoom]);

  return {
    status,
    muted,
    incomingMuted,
    adminMuted,
    toggleVoice,
    toggleMic,
    toggleIncoming,
    stop,
    participants,
    canSpeak,
    error,
    diagnostics,
    cameraOn,
    toggleCamera,
    mediaRoom,
  };
}
