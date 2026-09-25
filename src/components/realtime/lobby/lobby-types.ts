import type { LobbySnapshot, RoomPhase } from "@/lib/realtime/types";

/** Props shared by the generic lobby building blocks. */
export interface LobbyViewProps {
  snapshot: LobbySnapshot;
  /** Platform user id of the local viewer. */
  viewerUserId: string;
  /** Absolute invite URL, ready to copy. */
  inviteUrl: string;
  onCopyInvite: () => void;
  onLeave: () => void;
  onStart: () => void;
  /** True while the start request is in flight. */
  starting?: boolean;
}

export type { LobbySnapshot, RoomPhase };
