/**
 * Compact playtester net messages. Same JSON on WebRTC datachannel and WS relay.
 */

import type { PlayerSlot } from "@/components/Playtester/constants";
import type { FogView } from "@/components/Playtester/session/fogView.logic";
import type { SessionAction } from "@/components/Playtester/session/sessionActions.logic";
import type { FlipFlyMode } from "@/components/Playtester/constants";

export const PLAY_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export const PLAY_ICE_TIMEOUT_MS = 8000;

export type SignalPayload =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit };

/** Zones named from the actor's seat — peer maps them onto opp* DOM refs. */
export type PlayFxZone =
  | "library"
  | "hand"
  | "trashyard"
  | "dismantled"
  | "battlefield"
  | "stockpile"
  | "pilot";

/**
 * UI-only peer animations. State still travels via fog/intent; this is chrome
 * so the other client can mirror shuffle / tuck / fly / etc.
 */
export type PlayFx =
  | { kind: "shuffle" }
  | { kind: "tuck"; n: number }
  | { kind: "draw"; n: number }
  | { kind: "degrade"; n: number }
  | { kind: "bottom" }
  /** Spent accumulate card — peer reveals face, then tucks face-down under deck. */
  | {
      kind: "accumulate";
      name: string;
      /** Absolute/signed media URL for <img src> on the peer. */
      artUrl: string | null;
    }
  | {
      kind: "fly";
      mode: FlipFlyMode;
      from: PlayFxZone;
      to: PlayFxZone;
      n?: number;
      /** Force card-back art (private / unknown printing). */
      faceDown?: boolean;
    };

export type PlayNetMessage =
  | { type: "intent"; action: SessionAction }
  | { type: "event"; action: SessionAction }
  | { type: "fog"; view: FogView }
  | { type: "snapshot" }
  | { type: "signal"; payload: SignalPayload }
  /** UI-only peer chrome (fog hands have no shared ids; library is a boolean lift). */
  | { type: "hover"; zone: "hand"; index: number | null }
  | { type: "hover"; zone: "library"; active: boolean }
  /** Immediate selection chrome — not stored on `card.selected`. */
  | { type: "selection"; ids: string[]; seat?: PlayerSlot }
  | { type: "fx"; fx: PlayFx }
  | {
      type: "welcome";
      code: string;
      seat: PlayerSlot;
      host: boolean;
      peer?: {
        seat: PlayerSlot;
        deckId: number | null;
        connected: boolean;
        user_id: number;
      } | null;
    }
  | { type: "peer-joined"; seat: PlayerSlot; user_id: number }
  | { type: "peer-left"; seat: PlayerSlot | null }
  | { type: "seat-deck"; seat: PlayerSlot; deckId: number | string | null }
  | { type: "join"; deckId: number };

export type PlayTransport = "connecting" | "p2p" | "relay";

export function iceServersFromEnv(): RTCIceServer[] {
  const turn = (import.meta.env.VITE_TURN_URL as string | undefined)?.trim();
  if (!turn) return PLAY_ICE_SERVERS;
  const username =
    (import.meta.env.VITE_TURN_USERNAME as string | undefined) ?? "";
  const credential =
    (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) ?? "";
  return [...PLAY_ICE_SERVERS, { urls: turn, username, credential }];
}

export function isPlayNetMessage(raw: unknown): raw is PlayNetMessage {
  if (!raw || typeof raw !== "object") return false;
  const type = (raw as { type?: unknown }).type;
  return typeof type === "string";
}

const ACTOR_SEAT_TAGS = new Set<SessionAction["t"]>([
  "mv",
  "dr",
  "sh",
  "dg",
  "rdy",
  "lf",
  "ma",
  "tb",
  "ro",
  "pg",
  "tk",
  "sel",
]);

/** Host-side: guest may only touch their seat and their instance ids. */
export function intentAllowed(
  action: SessionAction,
  actor: PlayerSlot,
  ownerOf?: (id: string) => PlayerSlot | undefined,
): boolean {
  if (
    "seat" in action &&
    ACTOR_SEAT_TAGS.has(action.t) &&
    action.seat !== actor
  ) {
    return false;
  }
  if (!ownerOf || !("i" in action) || !Array.isArray(action.i)) return true;
  const ids = action.i.map((item) =>
    typeof item === "string" ? item : item.id,
  );
  return ids.every((id) => {
    const owner = ownerOf(id);
    return owner == null || owner === actor;
  });
}
