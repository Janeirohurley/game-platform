"use client";

import Link from "next/link";
import { useRef, type KeyboardEvent } from "react";
import RunnerGame from "./RunnerGame";
import { pixel, terminal } from "./fonts";

const MENU = [
  { href: "/", label: "Retour à l'accueil" },
  { href: "/games", label: "Explorer les jeux" },
  { href: "/community", label: "Rejoindre la communauté" },
];

export default function NotFoundScreen() {
  const menuRef = useRef<HTMLElement>(null);

  // Navigation clavier façon menu de console : ↑ / ↓ déplacent le curseur.
  const onMenuKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []
    );
    const i = items.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      e.key === "ArrowDown"
        ? items[(i + 1) % items.length]
        : items[(i - 1 + items.length) % items.length];
    e.preventDefault();
    next?.focus();
  };

  return (
    <main
      className={`${terminal.className} grid min-h-[100dvh] place-items-center p-[clamp(12px,4vw,40px)] text-[#e8e4ff] bg-[radial-gradient(ellipse_at_50%_0%,#3a1d7a55,transparent_60%),linear-gradient(#0a0618,#150b30)]`}
    >
      {/* ---------- Console ---------- */}
      <div>

        {/* ---------- Écran CRT ---------- */}
        <div >
          {/* lignes de balayage */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(to_bottom,transparent_0_2px,#00000030_2px_3px)]"
          />
          {/* vignettage */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,#000a_100%)]"
          />

          <header
            className={`${pixel.className} flex justify-between text-[10px] text-[#9d90cc]`}
          >
            <span>Erreur</span>
            <span>Niveau ??</span>
          </header>

          {/* ---------- Titre ---------- */}
          <section className="text-center">
            <h1
              data-text="404"
              className={`${pixel.className} relative m-0 inline-block text-[length:clamp(64px,17vw,140px)] leading-none text-[#e8e4ff] [text-shadow:4px_4px_0_#ff3d81,-4px_-4px_0_#3de8ff] before:absolute before:inset-0 before:content-[attr(data-text)] before:text-[#3de8ff] before:[text-shadow:none] before:animate-[glitch-a_3.2s_steps(1)_infinite] after:absolute after:inset-0 after:content-[attr(data-text)] after:text-[#ff3d81] after:[text-shadow:none] after:animate-[glitch-b_3.2s_steps(1)_infinite] motion-reduce:before:animate-none motion-reduce:after:animate-none`}
            >
              404
            </h1>
            <p
              className={`${pixel.className} mb-2.5 mt-[18px] text-[length:clamp(12px,2.6vw,18px)] leading-relaxed text-[#ffc53d]`}
            >
              Niveau introuvable
            </p>
            <p className="mx-auto max-w-[46ch] text-[length:clamp(20px,3.2vw,26px)] leading-[1.2] text-[#9d90cc]">
              Cette page a quitté la partie ou n&apos;a jamais existé. Retourne
              au lobby pour relancer une session.
            </p>
          </section>

          {/* ---------- Mini-jeu ---------- */}
          <section aria-label="Mini-jeu" className="flex flex-col gap-2">
            <RunnerGame />
            <p className="m-0 text-center text-xl text-[#9d90cc]">
              En attendant, bats ton record : Espace ou toucher pour sauter.
            </p>
          </section>

          {/* ---------- Menu ---------- */}
          <nav
            ref={menuRef}
            aria-label="Navigation"
            onKeyDown={onMenuKeyDown}
            className="flex flex-col items-center gap-1"
          >
            {MENU.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group inline-flex items-center gap-3 px-3.5 py-1.5 text-[length:clamp(22px,3.6vw,30px)] no-underline outline-none hover:text-[#ffc53d] focus-visible:text-[#ffc53d] ${
                  i === 0 ? "text-[#3de8ff]" : "text-[#e8e4ff]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="invisible w-[1em] text-[0.7em] text-[#ff3d81] group-hover:visible group-hover:animate-[blink_0.8s_steps(1)_infinite] group-focus-visible:visible group-focus-visible:animate-[blink_0.8s_steps(1)_infinite] motion-reduce:animate-none"
                >
                  ▶
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </main>
  );
}
