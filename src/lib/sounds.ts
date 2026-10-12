import { Howl, Howler } from "howler";

export const sounds = {
  diceRoll: new Howl({
    src: ["/sounds/dice-roll.mp3"],
    volume: 0.5,
  }),
  pieceMove: new Howl({
    src: ["/sounds/piece-move.mp3"],
    volume: 0.3,
  }),
  capture: new Howl({
    src: ["/sounds/capture.mp3"],
    volume: 0.7,
  }),
  win: new Howl({
    src: ["/sounds/win.mp3"],
    volume: 0.8,
  }),
  buttonClick: new Howl({
    src: ["/sounds/click.mp3"],
    volume: 0.2,
  }),
  matchingNotification: new Howl({
    src: ["/sounds/matching-notification.mp3"],
    volume: 0.35,
  }),
  message: new Howl({
    src: ["/sounds/message.mp3"],
    volume: 0.3,
  }),
  userDisconnected: new Howl({
    src: ["/sounds/user-deconnected.mp3"],
    volume: 0.25,
  }),
  startGame: new Howl({
    src: ["/sounds/start-game.mp3"],
    volume: 0.45,
  }),
};

export const playSound = (soundName: keyof typeof sounds) => {
  if (muted) return;
  try {
    sounds[soundName].play();
  } catch (error) {
    console.warn("Could not play sound:", soundName, error);
  }
};

/*
 * Global mute.
 *
 * Sounds fire from many places (dice, captures, chat, match events) and an
 * unexpected blip is jarring — all the more so at full volume. One persisted
 * switch, honoured by `playSound` and mirrored to every subscriber, so a
 * toggle in one screen silences the whole app and survives a reload.
 */
const MUTE_STORAGE_KEY = "game-arena:sound-muted";

let muted = false;

if (typeof window !== "undefined") {
  try {
    muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    Howler.mute(muted);
  } catch {
    muted = false;
  }
}

const muteListeners = new Set<() => void>();

export const subscribeMuted = (listener: () => void) => {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
};

export const isMuted = () => muted;

export const setMuted = (value: boolean) => {
  if (value === muted) return;
  muted = value;
  try {
    Howler.mute(value);
  } catch {
    // Howler not ready yet — the `muted` flag still gates `playSound`.
  }
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
    }
  } catch {
    // Ignore storage failures (private mode, quota).
  }
  for (const listener of muteListeners) listener();
};

export const toggleMuted = () => {
  setMuted(!muted);
};
