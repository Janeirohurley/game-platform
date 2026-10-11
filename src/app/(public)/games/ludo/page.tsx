import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getGameBySlug } from "@/lib/games/registry";
import Navbar from "@/components/navbar";
import { LudoEntryActions } from "./ludo-entry-actions";

/**
 * Les chiffres viennent du registre, pas d'une phrase écrite à la main : si
 * le jeu passe à 6 joueurs, la description et la fiche suivent sans qu'on y
 * touche. (L'ancienne phrase figée disait « 2 à 4 joueurs ».)
 */
export function generateMetadata(): Metadata {
  const game = getGameBySlug("ludo");
  const players = game ? `${game.minPlayers} à ${game.maxPlayers}` : "2 à 4";

  return {
    title: "Ludo | Game Arena",
    description: `Le classique jeu de plateau Ludo : joue en local ou rejoins des salles en ligne en temps réel, de ${players} joueurs.`,
  };
}

/** Durée indicative d'une partie. */
const DURATION = "15 à 30 minutes";

const RULES = [
  {
    title: "Lance le dé",
    body: "Un 6 sort un pion de la base et te donne un lancer bonus. En ligne, c'est le serveur qui tire le dé : personne ne peut le truquer.",
  },
  {
    title: "Avance et capture",
    body: "Si tu atterris sur un pion adverse, il retourne à sa base. Les étoiles et les cases de départ sont des cases sûres.",
  },
  {
    title: "Rentre tes quatre pions",
    body: "Il faut le chiffre exact pour entrer à la maison. Le premier qui rentre ses quatre pions gagne.",
  },
];

/**
 * Les sièges autour de la table : un point par place possible. Points pleins
 * = minimum de joueurs, cercles vides = places en option jusqu'au maximum.
 * Même motif que dans le catalogue des jeux.
 */
function Seats({ min, max }: { min: number; max: number }) {
  const shown = Math.min(max, 8);

  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden className="flex items-center gap-[3px]">
        {Array.from({ length: shown }, (_, index) => (
          <span
            key={index}
            className={[
              "size-2 rounded-full",
              index < min
                ? "bg-zinc-900 dark:bg-zinc-100"
                : "border border-zinc-400 dark:border-zinc-500",
            ].join(" ")}
          />
        ))}
      </span>

      <span className="tabular-nums">
        {min === max ? min : `${min} à ${max}`} joueurs
      </span>
    </span>
  );
}

/**
 * Page d'entrée de Ludo : de quoi décider vite (fiche du jeu, règles en trois
 * lignes) et les deux façons de jouer, en ligne ou en local, dans
 * `LudoEntryActions`. Le flux de création de salle reste dans ce composant.
 */
export default async function LudoPage() {
  const game = getGameBySlug("ludo");
  if (!game) return null;

  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      {/* Le plateau, en silhouette derrière la page : décor pur (alt vide,
          masqué aux lecteurs d'écran). Niveaux de gris et faible opacité pour
          rester un fantôme, et un masque radial qui estompe tous les bords :
          aucun rectangle d'image ne se devine, et le texte garde un contraste
          confortable. Le centre du masque est à droite, côté vide de la page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-184 mask-[radial-gradient(ellipse_60%_72%_at_78%_38%,#000_18%,transparent_76%)]"
      >
        <Image
          src="/ludo.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_40%] opacity-[.16]  contrast-125 sm:opacity-[.2] dark:opacity-[.24]"
        />
      </div>

      <Navbar />

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Fil d'Ariane">
          <ol className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li>
              <Link
                href="/games"
                className="underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:hover:text-white"
              >
                Jeux
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-zinc-950 dark:text-white">
              {game.title}
            </li>
          </ol>
        </nav>

        <div className="mt-8 max-w-xl">
          <div>
            <h1 className="font-(family-name:--font-playwrite) text-5xl font-normal tracking-tight sm:text-6xl">
              {game.title}
            </h1>

            <p className="mt-5 max-w-prose text-base leading-7 text-zinc-600 dark:text-zinc-400">
              {game.description} Sors tes pions de la base, évite les captures
              et sois le premier à rentrer les quatre pions à la maison.
            </p>

            {/* Actions : jouer en ligne ou en local */}
            <div className="mt-8">
              <LudoEntryActions
                signedIn={Boolean(session?.user)}
                playableOnline={game.playableOnline}
              />
            </div>

            {/* Fiche du jeu, comme le dos d'une boîte */}
            <dl className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200 text-sm dark:divide-white/10 dark:border-white/10">
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Joueurs</dt>
                <dd>
                  <Seats min={game.minPlayers} max={game.maxPlayers} />
                </dd>
              </div>

              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Plateau</dt>
                <dd>Une couleur et quatre pions par joueur, un seul dé.</dd>
              </div>

              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">Durée</dt>
                <dd>{DURATION}</dd>
              </div>

              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">En ligne</dt>
                <dd>
                  {game.playableOnline
                    ? "Salles en temps réel. Le serveur tire le dé."
                    : "Pas encore disponible."}
                </dd>
              </div>

              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-zinc-500 dark:text-zinc-400">En local</dt>
                <dd>Tous sur le même écran, sur un plateau en 3D.</dd>
              </div>
            </dl>
          </div>

        </div>

        {/* Règles : c'est une vraie suite d'étapes, d'où la numérotation */}
        <section
          aria-labelledby="regles"
          className="mt-20 grid gap-6 border-t border-zinc-200 pt-10 lg:grid-cols-[14rem_minmax(0,1fr)] dark:border-white/10"
        >
          <h2 id="regles" className="text-xl font-semibold tracking-tight">
            Comment jouer
          </h2>

          <ol className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
            {RULES.map((rule, index) => (
              <li
                key={rule.title}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-5 sm:grid-cols-[2.5rem_13rem_minmax(0,1fr)] sm:gap-x-6"
              >
                <span
                  aria-hidden
                  className="font-(family-name:--font-playwrite) text-2xl leading-none text-zinc-400 dark:text-zinc-500"
                >
                  {index + 1}
                </span>

                <h3 className="text-base font-semibold">{rule.title}</h3>

                <p className="col-start-2 text-sm leading-6 text-zinc-600 sm:col-start-3 dark:text-zinc-400">
                  {rule.body}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}