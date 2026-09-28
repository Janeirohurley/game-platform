"use client";

import { Track, type RemoteParticipant, type RemoteTrackPublication } from "livekit-client";
import {
  VideoTrack,
  useLocalParticipant,
  useRemoteParticipants,
} from "@livekit/components-react";

/**
 * LiveKitStage — the video tiles above the board (VISUALS only).
 *
 * Rendered INSIDE the LiveKit `RoomContext`, so the official hooks work.
 * Remote AUDIO is deliberately NOT handled here: the stage early-returns
 * when nobody publishes a camera, and audio must never depend on video
 * — it is mounted unconditionally by the match screen while the media
 * room is connected (see `RoomAudioRenderer` there).
 */
export function LiveKitStage() {
  const { localParticipant, cameraTrack: localCamera } =
    useLocalParticipant();
  const remotes = useRemoteParticipants();

  const remoteCameras: Array<{
    participant: RemoteParticipant;
    publication: RemoteTrackPublication;
  }> = [];
  for (const participant of remotes) {
    const publication = participant.getTrackPublication(Track.Source.Camera);
    if (publication?.isSubscribed) {
      remoteCameras.push({ participant, publication });
    }
  }

  const localVideo = localCamera?.videoTrack ?? null;
  if (remoteCameras.length === 0 && !localVideo) {
    return null; // no camera anywhere — the board owns the screen
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2">
      {remoteCameras.map(({ participant, publication }) => (
        <div
          key={participant.identity}
          className="h-24 w-32 overflow-hidden rounded-lg border border-white/15 bg-black/70 shadow-lg"
        >
          <VideoTrack
            trackRef={{
              participant,
              publication,
              source: Track.Source.Camera,
            }}
            className="h-full w-full object-cover"
          />
        </div>
      ))}
      {localVideo && (
        <div className="h-24 w-32 overflow-hidden rounded-lg border border-cyan-400/40 bg-black/70 shadow-lg">
          <VideoTrack
            trackRef={{
              participant: localParticipant,
              publication: localCamera as RemoteTrackPublication,
              source: Track.Source.Camera,
            }}
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
