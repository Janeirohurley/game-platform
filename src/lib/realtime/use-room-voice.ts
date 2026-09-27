"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room } from "@colyseus/sdk";
import { WebRTCClient } from "@colyseus/webrtc/client";

import type { LobbySnapshot } from "./types";

/**
 * Room voice — generic infrastructure shared by every game (WebRTC).
 *
 * Transport: peer-to-peer audio over WebRTC, coordinated by the room's
 * official signaling plugin (`colyseus/plugins/webrtc` server-side,
 * `@colyseus/webrtc/client` here). Colyseus relays SDP/ICE only — the
 * audio itself never touches a server.
 *
 * Rules (voice spec sections 3, 11 and 15):
 *   - seated players: may speak and listen — the OFFICIAL client with a
 *     real microphone, requested ONLY when the user enables voice;
 *   - spectators (including anonymous guests): listen-only — they join
 *     the same mesh with recvonly transceivers, so no getUserMedia call
 *     is ever made for them and no audio leaves their device;
 *   - logical mic state is mirrored server-side (`player.voiceMuted`)
 *     through the `voice:mute` message, which the server validates.
 *
 * Everything is cleaned up on toggle-off, leave and unmount: tracks
 * stopped, PeerConnections closed, listeners unbound, audio elements
 * removed (section 13).
 */

/** The voice connection, as the user experiences it. */
export type VoiceStatus =
  | "off" // voice not engaged — nothing requested, nothing flowing
  | "requesting" // getUserMedia in flight — waiting for the user's answer
  | "connecting" // permission granted / mesh negotiating
  | "connected" // at least one live remote audio stream, or mic live
  | "denied" // permission refused — the match goes on without voice
  | "unavailable" // no microphone / browser cannot provide one
  | "error"; // anything else that aborted the setup

export interface VoiceParticipant {
  /** Colyseus session id — the WebRTC peer id. */
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
  /** True when the ADMIN muted THIS player: their own unmute is
   * refused server-side until the admin lifts it. */
  adminMuted: boolean;
  /** Toggle: engage/disengage voice, or flip the mic while engaged. */
  toggleMic: () => void;
  /** Tear everything down (leave, unmount, room close). */
  stop: () => void;
  /** Others currently in the voice mesh, with speaking state. */
  participants: VoiceParticipant[];
  /** True when this viewer may ever speak (seated player). */
  canSpeak: boolean;
  error: string | null;
}

const FAILURE_REASON = {
  denied: "Autorisation microphone refusée. La partie continue sans voix.",
  unavailable: "Aucun microphone disponible sur cet appareil.",
  error: "La voix n'a pas pu démarrer sur cet appareil.",
  /** The browser never answered getUserMedia — the prompt is buried,
   * or the page runs in a context that blocks the mic (embedded
   * webviews do). Actionable, and the flow aborts so retry is possible. */
  unanswered:
    "Le navigateur n'a pas répondu à la demande de micro. Vérifie la fenêtre d'autorisation ; si tu es dans un aperçu intégré, ouvre la page dans un onglet normal.",
} as const;

interface UseRoomVoiceOptions {
  room: Room;
  /** Mirrored lobby snapshot — roles are read from it, never claimed. */
  snapshot: LobbySnapshot | null;
  /** Platform user id of the local viewer ("" for anonymous guests). */
  viewerUserId: string;
  /**
   * ICE configuration. Defaults to public Google STUN (same as the
   * official client); TURN credentials would come from env at build
   * time, never hardcoded (section 18).
   */
  iceServers?: RTCIceServer[];
}

/* ------------------------------------------------------------------ */
/* Speaking detection — no audio library (section 25).                 */
/* ------------------------------------------------------------------ */

/**
 * Detect speech with an AnalyserNode per remote stream: RMS over the
 * time-domain data, thresholded. One AudioContext is shared by every
 * stream (section 24: rooms of 2–6 players).
 */
class SpeakingMonitor {
  private context: AudioContext | null = null;
  private entries = new Map<
    string,
    {
      source: MediaStreamAudioSourceNode;
      analyser: AnalyserNode;
      data: Uint8Array<ArrayBuffer>;
    }
  >();
  /** Session ids currently above the speaking threshold. */
  active = new Set<string>();

  watch(sessionId: string, stream: MediaStream): void {
    try {
      this.context ??= new AudioContext();
      if (this.context.state === "suspended") void this.context.resume();
      const source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 512;
      // Analysis only — never connected to the destination (no echo).
      source.connect(analyser);
      this.entries.set(sessionId, {
        source,
        analyser,
        data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      });
    } catch {
      // A failed analyser must never break the audio itself.
    }
  }

  /** Recompute `active`; returns true when the set changed. */
  sample(): boolean {
    const next = new Set<string>();
    for (const [sessionId, entry] of this.entries) {
      entry.analyser.getByteTimeDomainData(entry.data);
      let sum = 0;
      for (let i = 0; i < entry.data.length; i++) {
        const v = (entry.data[i] - 128) / 128;
        sum += v * v;
      }
      // ~0.015 RMS ≈ a normal speaking voice near a laptop mic.
      if (Math.sqrt(sum / entry.data.length) > 0.015) next.add(sessionId);
    }
    const changed =
      next.size !== this.active.size ||
      [...next].some((id) => !this.active.has(id));
    this.active = next;
    return changed;
  }

  drop(sessionId: string): void {
    const entry = this.entries.get(sessionId);
    if (!entry) return;
    entry.source.disconnect();
    entry.analyser.disconnect();
    this.entries.delete(sessionId);
    this.active.delete(sessionId);
  }

  dispose(): void {
    for (const sessionId of [...this.entries.keys()]) this.drop(sessionId);
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.active = new Set();
  }
}

/* ------------------------------------------------------------------ */
/* Remote audio output — one hidden <audio> per peer (section 14).     */
/* ------------------------------------------------------------------ */

/**
 * The official client hands us remote MediaStreams but does not play
 * them. This tiny sink attaches each stream to exactly one hidden
 * <audio> element, created when the peer connects and removed when it
 * leaves — never a pool of orphaned elements.
 */
class RemoteAudioSink {
  private elements = new Map<string, HTMLAudioElement>();
  /** Set when some play() was refused — retried on the next click. */
  private blocked = false;
  private retryBound = false;

  attach(sessionId: string, stream: MediaStream): void {
    this.detach(sessionId);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = false;
    audio.srcObject = stream;
    audio.setAttribute("aria-hidden", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);
    void audio.play().catch(() => {
      // Autoplay policy refused (rare: the mic-permission gesture usually
      // covers it). Retry on the user's next interaction instead of
      // failing silently forever — the classic "I can't hear them" bug.
      this.blocked = true;
      this.bindRetry();
    });
    this.elements.set(sessionId, audio);
  }

  private bindRetry(): void {
    if (this.retryBound) return;
    this.retryBound = true;
    const retry = (): void => {
      if (!this.blocked) return;
      this.blocked = false;
      for (const audio of this.elements.values()) {
        void audio.play().then(() => {
          document.removeEventListener("pointerdown", retry);
          document.removeEventListener("keydown", retry);
        }).catch(() => {
          this.blocked = true;
        });
      }
    };
    document.addEventListener("pointerdown", retry);
    document.addEventListener("keydown", retry);
  }

  detach(sessionId: string): void {
    const audio = this.elements.get(sessionId);
    if (!audio) return;
    audio.srcObject = null;
    audio.remove();
    this.elements.delete(sessionId);
  }

  dispose(): void {
    for (const sessionId of [...this.elements.keys()]) this.detach(sessionId);
  }
}

/* ------------------------------------------------------------------ */
/* Listen-only signaling — same official messages, no microphone.      */
/* ------------------------------------------------------------------ */

/**
 * Spectator peer: joins the SAME mesh via `webrtc:join` but negotiates
 * recvonly audio transceivers. This mirrors the official client's
 * signaling (newcomer initiates to every listed peer) with two
 * differences: no getUserMedia call, and remote streams are handed to
 * callbacks for the sink/monitor to consume.
 */
class ListenOnlyPeer {
  private peers = new Map<string, RTCPeerConnection>();
  private unbind: Array<() => void> = [];

  constructor(
    private readonly room: Pick<Room, "send" | "onMessage">,
    private readonly iceServers: RTCIceServer[],
    private readonly onStream: (sessionId: string, stream: MediaStream) => void,
    private readonly onPeerDown: (sessionId: string) => void,
    private readonly onMeshUp: () => void,
  ) {}

  /** Join the mesh as a receive-only participant. */
  start(): void {
    this.unbind.push(
      this.room.onMessage("webrtc:peers", (peerIds: string[]) => {
        // The ack itself (even an empty list) means the server accepted
        // us into the mesh — say so even when no player has a mic on.
        if (!this.meshAnnounced) {
          this.meshAnnounced = true;
          this.onMeshUp();
        }
        for (const peerId of peerIds) void this.connectTo(peerId);
      }),
      this.room.onMessage(
        "webrtc:offer",
        async (data: { peerId: string; sdp: RTCSessionDescriptionInit }) => {
          const pc = this.getOrCreate(data.peerId);
          await pc.setRemoteDescription(data.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          this.room.send("webrtc:answer", {
            targetId: data.peerId,
            sdp: pc.localDescription,
          });
        },
      ),
      this.room.onMessage(
        "webrtc:answer",
        async (data: { peerId: string; sdp: RTCSessionDescriptionInit }) => {
          const pc = this.peers.get(data.peerId);
          if (pc) await pc.setRemoteDescription(data.sdp);
        },
      ),
      this.room.onMessage(
        "webrtc:ice-candidate",
        async (data: {
          peerId: string;
          candidate: RTCIceCandidateInit;
        }) => {
          const pc = this.peers.get(data.peerId);
          if (pc) await pc.addIceCandidate(data.candidate).catch(() => undefined);
        },
      ),
      this.room.onMessage("webrtc:peer-left", (peerId: string) => {
        this.removePeer(peerId);
      }),
    );
    this.room.send("webrtc:join");
  }

  private getOrCreate(peerId: string): RTCPeerConnection {
    const existing = this.peers.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peers.set(peerId, pc);
    // Receive audio, transmit nothing — the essence of listen-only.
    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.room.send("webrtc:ice-candidate", {
          targetId: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) this.onStream(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        this.removePeer(peerId);
      } else if (pc.connectionState === "connected") {
        // First established peer connection means the listen-only
        // participant is genuinely on the mesh — even if nobody is
        // talking yet, so the UI never hangs on "connecting".
        if (!this.meshAnnounced) {
          this.meshAnnounced = true;
          this.onMeshUp();
        }
      }
    };
    return pc;
  }

  private meshAnnounced = false;

  private async connectTo(peerId: string): Promise<void> {
    const pc = this.getOrCreate(peerId);
    await pc.setLocalDescription(await pc.createOffer());
    this.room.send("webrtc:offer", {
      targetId: peerId,
      sdp: pc.localDescription,
    });
  }

  private removePeer(peerId: string): void {
    const pc = this.peers.get(peerId);
    if (!pc) return;
    pc.close();
    this.peers.delete(peerId);
    this.onPeerDown(peerId);
  }

  stop(): void {
    for (const unbind of this.unbind) unbind();
    this.unbind = [];
    for (const peerId of [...this.peers.keys()]) this.removePeer(peerId);
  }
}

/* ------------------------------------------------------------------ */
/* The hook                                                            */
/* ------------------------------------------------------------------ */

export function useRoomVoice(options: UseRoomVoiceOptions): RoomVoiceController {
  const { room, snapshot, viewerUserId, iceServers } = options;

  const [status, setStatus] = useState<VoiceStatus>("off");
  const [muted, setMuted] = useState(true);
  /** Admin-imposed mute on THIS player (server-enforced). */
  const [adminMuted, setAdminMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());

  // Imperative resources with their own listeners — refs, not state.
  // React only mirrors what the UI needs.
  const clientRef = useRef<WebRTCClient | null>(null);
  const listenRef = useRef<ListenOnlyPeer | null>(null);
  const monitorRef = useRef<SpeakingMonitor | null>(null);
  const sinkRef = useRef<RemoteAudioSink | null>(null);

  // ------------------------------------------------------------------
  // Role resolution — from the SERVER state, never from a client claim.
  // ------------------------------------------------------------------
  const canSpeak = useMemo(() => {
    if (!snapshot) return false;
    return snapshot.players.some((player) => player.userId === viewerUserId);
  }, [snapshot, viewerUserId]);

  // ------------------------------------------------------------------
  // Roster: mesh peers joined with lobby players for names, plus the
  // server's logical mute (`voiceMuted`) for the roster dot.
  // ------------------------------------------------------------------
  const participants = useMemo<VoiceParticipant[]>(() => {
    const bySession = new Map<string, LobbySnapshot["players"][number]>();
    for (const player of snapshot?.players ?? []) {
      if (player.sessionId) bySession.set(player.sessionId, player);
    }
    return peerIds
      .map((sessionId) => {
        const player = bySession.get(sessionId);
        return {
          sessionId,
          userId: player?.userId ?? "",
          name: player?.name ?? "Participant",
          speaking: speakingIds.has(sessionId),
          // Server-enforced state wins: an admin mute or the player's
          // own logical mute both mean "no audio expected".
          audible: player
            ? player.adminMuted !== true && player.voiceMuted !== true
            : true,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [peerIds, speakingIds, snapshot]);

  // ------------------------------------------------------------------
  // Voice-activity sampling while the mesh is live (4 Hz is plenty).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (status !== "connected" && status !== "connecting") return;
    const monitor = monitorRef.current;
    if (!monitor) return;

    let stopped = false;
    const sample = (): void => {
      if (stopped) return;
      if (monitor.sample()) setSpeakingIds(new Set(monitor.active));
      window.setTimeout(sample, 250);
    };
    sample();
    return () => {
      stopped = true;
    };
  }, [status, peerIds]);

  // ------------------------------------------------------------------
  // Teardown — idempotent; used by toggle-off, leave and unmount.
  // ------------------------------------------------------------------
  const stop = useCallback((): void => {
    listenRef.current?.stop();
    listenRef.current = null;
    clientRef.current?.leave();
    clientRef.current = null;
    monitorRef.current?.dispose();
    monitorRef.current = null;
    sinkRef.current?.dispose();
    sinkRef.current = null;
    setPeerIds([]);
    setSpeakingIds(new Set());
    setStatus("off");
    setMuted(true);
    setError(null);
  }, []);

  // Room swap or unmount: full cleanup (section 13).
  useEffect(() => stop, [stop]);

  // ------------------------------------------------------------------
  // Engage voice. Seated players use the OFFICIAL client (real mic).
  // Spectators take the recvonly path — no microphone, ever.
  // ------------------------------------------------------------------
  const engage = useCallback((): void => {
    setError(null);
    /**
     * If the browser never answers getUserMedia (permission prompt
     * dismissed without a decision, embedded webview blocking the mic),
     * abort with an actionable message instead of hanging forever.
     */
    let unanswered = true;
    const unansweredTimer = setTimeout(() => {
      // Only when still waiting on the prompt — connected/connecting
      // paths clear this flag as soon as the browser answers.
      if (unanswered) {
        unanswered = false;
        setError(FAILURE_REASON.unanswered);
        stop();
      }
    }, 15_000);

    const clearUnanswered = (): void => {
      if (unanswered) {
        unanswered = false;
        clearTimeout(unansweredTimer);
      }
    };

    const monitor = new SpeakingMonitor();
    const sink = new RemoteAudioSink();
    monitorRef.current = monitor;
    sinkRef.current = sink;

    const handleStream = (sessionId: string, stream: MediaStream): void => {
      monitor.watch(sessionId, stream);
      sink.attach(sessionId, stream);
      setPeerIds((current) =>
        current.includes(sessionId) ? current : [...current, sessionId],
      );
      setStatus("connected");
    };
    const handlePeerDown = (sessionId: string): void => {
      monitor.drop(sessionId);
      sink.detach(sessionId);
      setPeerIds((current) => {
        const next = current.filter((id) => id !== sessionId);
        if (next.length === 0) setStatus("connecting");
        return next;
      });
    };

    if (!canSpeak) {
      // Spectator / guest: receive-only, no microphone permission.
      clearUnanswered(); // no prompt will ever block this path
      const listen = new ListenOnlyPeer(
        room,
        iceServers ?? [],
        handleStream,
        handlePeerDown,
        () => setStatus("connected"),
      );
      listenRef.current = listen;
      try {
        listen.start();
      } catch {
        setStatus("error");
        setError(FAILURE_REASON.error);
        stop();
      }
      return;
    }

    // Seated player: the official client with a real microphone.
    setStatus("requesting");
    const client = new WebRTCClient(room, { iceServers });
    clientRef.current = client;
    client.onLocalStream = () => {
      clearUnanswered(); // the browser answered — prompt resolved
      setMuted(false);
      // Mic granted and mesh joined — the voice connection is UP even
      // if nobody speaks yet (or the only other player hasn't enabled
      // their mic). Never hang on "connecting".
      setStatus("connected");
    };
    client.onPeerConnected = (peerId, stream) => handleStream(peerId, stream);
    client.onPeerDisconnected = handlePeerDown;
    client.join({ audio: true, video: false }).catch((joinError: unknown) => {
      const name =
        joinError instanceof DOMException
          ? joinError.name
          : joinError instanceof Error
            ? joinError.name
            : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("denied");
        setError(FAILURE_REASON.denied);
      } else if (
        name === "NotFoundError" ||
        name === "OverconstrainedError" ||
        name === "NotReadableError" ||
        name === "AbortError"
      ) {
        setStatus("unavailable");
        setError(FAILURE_REASON.unavailable);
      } else {
        setStatus("error");
        setError(FAILURE_REASON.error);
      }
      stop();
    });
  }, [canSpeak, room, iceServers, stop]);

  // ------------------------------------------------------------------
  // Public toggle.
  //   off        → engage (permission prompt for players, silent for
  //                spectators)
  //   engaged    → real mute flip: the audio track is enabled/disabled
  //                (audio genuinely stops/starts flowing) AND the server
  //                is told so rosters agree — never just an icon swap
  //   listen-only → disengage entirely (there is no mic to flip)
  // ------------------------------------------------------------------
  const toggleMic = useCallback((): void => {
    if (status === "off") {
      engage();
      return;
    }

    if (!canSpeak) {
      stop();
      return;
    }

    const nextMuted = !muted;
    // Server-enforced: an admin-imposed mute refuses this unmute, so
    // the local track must not flip either — only the admin lifts it.
    if (adminMuted && nextMuted === false) return;
    for (const track of clientRef.current?.localStream?.getAudioTracks() ?? []) {
      track.enabled = !nextMuted;
    }
    setMuted(nextMuted);
    room.send("voice:mute", { muted: nextMuted });
  }, [status, canSpeak, muted, adminMuted, engage, room, stop]);

  // Admin remote-mute: the broadcast tells everyone; for the target it
  // also flips the REAL local track (audio stops flowing immediately).
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
        for (const track of clientRef.current?.localStream?.getAudioTracks() ??
          []) {
          track.enabled = !mutedNow;
        }
      },
    );
    return unsub;
  }, [room, snapshot, viewerUserId]);

  // On mesh entry, announce the logical state so rosters agree from the
  // start (the schema default is muted=true; an engaging player is not).
  useEffect(() => {
    if (status === "connected" && canSpeak) {
      room.send("voice:mute", { muted });
    }
  }, [status, canSpeak, muted, room]);

  return {
    status,
    muted,
    adminMuted,
    toggleMic,
    stop,
    participants,
    canSpeak,
    error,
  };
}
