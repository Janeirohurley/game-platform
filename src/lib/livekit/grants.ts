/**
 * LiveKit token grants per application role.
 *
 * The application's OWN rules are authoritative (no invented role
 * semantics): a SPECTATOR watches and listens but never publishes —
 * the game server already refuses `voice:mute` from anyone who is not
 * a seated player, so the media grant must mirror that, not widen it.
 * A PLAYER (the admin is a seated player too) may publish mic and
 * camera.
 *
 * Kept PURE (no env, no server-only imports) so it is unit-testable
 * without any LiveKit or database dependency.
 */

/** Role the realtime server reports for a room member. */
export type RoomMembershipRole = "player" | "spectator";

/** The LiveKit video grant shape we set (subset of the SDK's type). */
export type MediaGrant = {
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  room: string;
};

/**
 * The media grants for one application role, scoped to `room`.
 *
 * - player  → publish + subscribe + data (spec phase 4 defaults)
 * - spectator → subscribe ONLY: no mic, no camera, no data publish
 *
 * Deliberately absent (nobody gets them): roomCreate, roomList,
 * roomRecord, roomAdmin, hidden, recorder, agent.
 */
export function grantsForRole(
  role: RoomMembershipRole,
  room: string,
): MediaGrant {
  if (role === "spectator") {
    return {
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
      room,
    };
  }
  return {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    room,
  };
}
