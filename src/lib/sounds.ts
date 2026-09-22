import { Howl } from "howler";

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
};

export const playSound = (soundName: keyof typeof sounds) => {
  try {
    sounds[soundName].play();
  } catch (error) {
    console.warn("Could not play sound:", soundName, error);
  }
};
