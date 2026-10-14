"use client";

import { useEffect, useRef } from "react";

const W = 600;
const H = 140;
const GROUND = 118;
const SIZE = 20;
const PLAYER_X = 48;
const JUMP = -10.5;
const GRAVITY = 0.6;
const HI_KEY = "game-arena:404-hi";

// Mêmes couleurs que le CSS (--ga-*). Modifie-les ensemble.
const COLORS = {
  player: "#3de8ff",
  eye: "#120a2a",
  obstacle: "#ff3d81",
  ground: "#6b5aa8",
  text: "#e8e4ff",
  warn: "#ffc53d",
};

type Obstacle = { x: number; w: number; h: number };
type State = "idle" | "run" | "over";

export default function RunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let state: State = "idle";
    let y = GROUND - SIZE;
    let vy = 0;
    let score = 0;
    let speed = 5;
    let frame = 0;
    let nextSpawn = 60;
    let obstacles: Obstacle[] = [];
    let hi = 0;
    let raf = 0;

    try {
      hi = Number(localStorage.getItem(HI_KEY)) || 0;
    } catch {
      /* stockage indisponible : on ignore */
    }

    const reset = () => {
      y = GROUND - SIZE;
      vy = 0;
      score = 0;
      speed = 5;
      frame = 0;
      nextSpawn = 60;
      obstacles = [];
    };

    const jump = () => {
      if (state !== "run") {
        reset();
        state = "run";
        vy = JUMP;
        return;
      }
      if (y >= GROUND - SIZE) vy = JUMP;
    };

    const gameOver = () => {
      state = "over";
      const final = Math.floor(score);
      if (final > hi) {
        hi = final;
        try {
          localStorage.setItem(HI_KEY, String(hi));
        } catch {
          /* ignore */
        }
      }
    };

    const update = () => {
      frame++;
      vy += GRAVITY;
      y = Math.min(y + vy, GROUND - SIZE);
      if (y === GROUND - SIZE) vy = 0;

      speed = 5 + score / 400;
      score += speed / 30;

      if (--nextSpawn <= 0) {
        obstacles.push({
          x: W,
          w: 14 + Math.floor(Math.random() * 12),
          h: 16 + Math.floor(Math.random() * 22),
        });
        nextSpawn = 45 + Math.random() * 45;
      }

      obstacles = obstacles
        .map((o) => ({ ...o, x: o.x - speed }))
        .filter((o) => o.x + o.w > 0);

      const hit = obstacles.some(
        (o) =>
          PLAYER_X + SIZE - 3 > o.x &&
          PLAYER_X + 3 < o.x + o.w &&
          y + SIZE - 3 > GROUND - o.h
      );
      if (hit) gameOver();
    };

    const pad = (n: number) => String(Math.floor(n)).padStart(4, "0");

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const font = getComputedStyle(canvas).fontFamily;

      // sol
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, GROUND, W, 2);
      for (let i = 0; i < 14; i++) {
        const gx = (i * 48 - (state === "run" ? frame * speed : 0)) % W;
        ctx.fillRect(gx < 0 ? gx + W : gx, GROUND + 8, 14, 2);
      }

      // obstacles
      ctx.fillStyle = COLORS.obstacle;
      obstacles.forEach((o) => ctx.fillRect(o.x, GROUND - o.h, o.w, o.h));

      // joueur
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(PLAYER_X, y, SIZE, SIZE - 4);
      const step = y >= GROUND - SIZE && Math.floor(frame / 5) % 2 === 0;
      ctx.fillRect(PLAYER_X + 2, y + SIZE - 4, 5, step ? 4 : 2);
      ctx.fillRect(PLAYER_X + SIZE - 7, y + SIZE - 4, 5, step ? 2 : 4);
      ctx.fillStyle = COLORS.eye;
      ctx.fillRect(PLAYER_X + 11, y + 4, 3, 5);
      ctx.fillRect(PLAYER_X + 16, y + 4, 3, 5);

      // score
      ctx.textAlign = "right";
      ctx.fillStyle = COLORS.text;
      ctx.font = `12px ${font}`;
      ctx.fillText(`HI ${pad(hi)}   ${pad(score)}`, W - 12, 20);

      // messages
      ctx.textAlign = "center";
      if (state === "idle") {
        ctx.fillStyle = COLORS.warn;
        ctx.font = `14px ${font}`;
        ctx.fillText("ESPACE POUR JOUER", W / 2, 60);
      } else if (state === "over") {
        ctx.fillStyle = COLORS.obstacle;
        ctx.font = `20px ${font}`;
        ctx.fillText("GAME OVER", W / 2, 56);
        ctx.fillStyle = COLORS.warn;
        ctx.font = `10px ${font}`;
        ctx.fillText("ESPACE POUR REJOUER", W / 2, 82);
      }
    };

    const loop = () => {
      if (state === "run") update();
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const t = e.target;
      if (t !== document.body && t !== canvas) return;
      e.preventDefault();
      if (!e.repeat) jump();
    };

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("pointerdown", jump);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointerdown", jump);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="block h-auto w-full cursor-pointer touch-manipulation border-y-2 border-dashed border-[#3a2c6b] [image-rendering:pixelated] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3de8ff]"
      width={W}
      height={H}
      tabIndex={0}
      role="img"
      aria-label="Mini-jeu de course : appuie sur Espace pour sauter par-dessus les obstacles"
    />
  );
}
