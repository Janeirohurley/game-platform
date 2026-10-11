"use client";

import { useCallback, useRef } from "react";

export type TetrisSound =
  | "start"
  | "clear"
  | "fall"
  | "gameover"
  | "rotate"
  | "move";

/**
 * Les 6 sons sont découpés dans UN seul fichier (`music.mp3`) : [début, durée]
 * en secondes. Valeurs reprises de `unit/music.js` du Tetris d'origine.
 */
const SPRITES: Record<TetrisSound, readonly [number, number]> = {
  clear: [0, 0.7675],
  fall: [1.2558, 0.3546],
  rotate: [2.2471, 0.0807],
  move: [2.9088, 0.1437],
  start: [3.7202, 3.6224],
  gameover: [8.1276, 1.1437],
};

const SOUND_URL = "/tetris/music.mp3";

/**
 * Lecteur de sons Web Audio. Le contexte audio et le fichier ne sont créés
 * qu'au premier son demandé : les navigateurs n'autorisent l'audio qu'après
 * un geste de l'utilisateur, et ce premier son part toujours d'un appui.
 * Toute erreur (fichier absent, audio indisponible) est avalée : le jeu
 * continue simplement sans son.
 */
export function useTetrisSound(enabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<Promise<AudioBuffer | null> | null>(null);

  const load = useCallback((): Promise<AudioBuffer | null> => {
    if (bufferRef.current) return bufferRef.current;

    bufferRef.current = (async () => {
      try {
        const AudioContextClass = window.AudioContext;
        if (!AudioContextClass) return null;
        contextRef.current = new AudioContextClass();
        const response = await fetch(SOUND_URL);
        if (!response.ok) return null;
        return await contextRef.current.decodeAudioData(await response.arrayBuffer());
      } catch {
        return null;
      }
    })();

    return bufferRef.current;
  }, []);

  return useCallback(
    (name: TetrisSound) => {
      if (!enabled) return;
      void load().then((buffer) => {
        const context = contextRef.current;
        if (!buffer || !context) return;
        void context.resume();
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        const [offset, duration] = SPRITES[name];
        source.start(0, offset, duration);
      });
    },
    [enabled, load],
  );
}
