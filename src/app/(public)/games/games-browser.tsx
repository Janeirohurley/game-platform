"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { GameController02Icon, Search01Icon } from "@hugeicons/core-free-icons";

import Navbar from "@/components/navbar";

import type { GameEntry, GameCategory } from "@/lib/games/registry";

type FilterCategory = "All" | GameCategory;
type SortKey = "featured" | "name" | "players";

interface GamesBrowserProps {
  games: GameEntry[];
  categories: GameCategory[];
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Live first" },
  { key: "name", label: "Name" },
  { key: "players", label: "Most players" },
];

/**
 * Colonnes d'une ligne de jeu à partir de md. Le gabarit est partagé entre
 * l'en-tête et les lignes pour que tout reste aligné ; la dernière colonne a
 * une largeur FIXE (deux boutons), sinon chaque ligne se décalerait.
 */
const ROW_COLUMNS =
  "md:grid-cols-[9rem_minmax(0,1fr)_9.5rem_9rem_14rem] md:gap-x-6";

function matchesQuery(game: GameEntry, query: string) {
  if (!query) return true;
  return [game.title, game.description, game.category].some((value) =>
    value.toLowerCase().includes(query),
  );
}

export function GamesBrowser({ games, categories }: GamesBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("All");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // « / » met le focus dans la recherche, comme sur les sites où l'on cherche
  // souvent. Sans effet quand on est déjà en train de taper quelque part.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  // Jeux qui passent la recherche et l'interrupteur « en ligne ». Les
  // compteurs des onglets viennent de cette liste : un onglet affiche
  // exactement le nombre de lignes qu'on obtiendra en cliquant dessus.
  const base = useMemo(
    () =>
      games.filter(
        (game) =>
          (!onlineOnly || (game.status === "live" && game.playableOnline)) &&
          matchesQuery(game, normalizedQuery),
      ),
    [games, onlineOnly, normalizedQuery],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const game of base) {
      map.set(game.category, (map.get(game.category) ?? 0) + 1);
    }
    return map;
  }, [base]);

  const visible = useMemo(() => {
    const list =
      category === "All"
        ? [...base]
        : base.filter((g) => g.category === category);
    if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "players") {
      list.sort(
        (a, b) => b.maxPlayers - a.maxPlayers || a.title.localeCompare(b.title),
      );
    }
    return list;
  }, [base, category, sort]);

  // Tri par défaut : deux sections (jeux ouverts, puis jeux en préparation).
  // Les autres tris donnent une seule liste continue.
  const groups = useMemo(() => {
    if (sort !== "featured") {
      return [{ id: "all", title: "", games: visible }];
    }
    const live = visible.filter((g) => g.status === "live");
    const soon = visible.filter((g) => g.status !== "live");
    return [
      { id: "live", title: "Live", games: live },
      { id: "soon", title: "In development", games: soon },
    ].filter((group) => group.games.length > 0);
  }, [visible, sort]);

  const liveCount = games.filter((g) => g.status === "live").length;
  const onlineCount = games.filter(
    (g) => g.status === "live" && g.playableOnline,
  ).length;

  const filters: FilterCategory[] = ["All", ...categories];
  const hasFilters = query !== "" || category !== "All" || onlineOnly;

  function resetFilters() {
    setQuery("");
    setCategory("All");
    setOnlineOnly(false);
  }

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      {/* /games.jpg en silhouette derrière l'en-tête et les réglages : même
          traitement que sur les pages Ludo. Décor pur (alt vide, masqué aux
          lecteurs d'écran), niveaux de gris, faible opacité, bords estompés
          par un masque radial. Le masque s'éteint avant la liste des jeux :
          les lignes restent sur un fond uni, donc nettes et lisibles. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] [mask-image:radial-gradient(ellipse_60%_75%_at_78%_30%,#000_18%,transparent_76%)]"
      >
        <Image
          src="/games.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[75%_40%] opacity-[.16]  contrast-125 sm:opacity-[.2] dark:opacity-[.24]"
        />
      </div>

      <Navbar />

      <section className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <h1 className="font-(family-name:--font-playwrite) text-4xl font-normal tracking-tight sm:text-5xl">
            Games
          </h1>

          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Pick a game and join a table. {liveCount} of {games.length} games
            are live, and {onlineCount} can match you with other players online.
          </p>
        </header>

        {/* Recherche et réglages */}
        <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchField inputRef={searchRef} value={query} onChange={setQuery} />

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(event) => setOnlineOnly(event.target.checked)}
                className="size-4 rounded accent-emerald-700"
              />
              Online matchmaking only
            </label>

            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              Sort by
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-10 rounded-md border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/25 dark:border-white/15 dark:bg-zinc-900 dark:text-white"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Catégories : le trait sous l'onglet actif prolonge celui de la liste */}
        <div
          role="group"
          aria-label="Category"
          className="mt-5 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-white/10"
        >
          {filters.map((item) => {
            const active = category === item;
            const count =
              item === "All" ? base.length : (counts.get(item) ?? 0);

            return (
              <button
                key={item}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(item)}
                className={[
                  "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700",
                  active
                    ? "border-zinc-950 font-medium text-zinc-950 dark:border-white dark:text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
                ].join(" ")}
              >
                {item}
                <span className="ml-1.5 tabular-nums text-zinc-400 dark:text-zinc-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          {visible.length} {visible.length === 1 ? "game" : "games"} shown
        </p>

        {groups.length > 0 ? (
          groups.map((group, groupIndex) => (
            <section
              key={group.id}
              aria-labelledby={group.title ? `group-${group.id}` : undefined}
              className="mt-8"
            >
              {group.title && (
                <div className="mb-1 flex items-baseline gap-2 px-3 sm:px-4">
                  <h2
                    id={`group-${group.id}`}
                    className="text-base font-semibold"
                  >
                    {group.title}
                  </h2>
                  <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
                    {group.games.length}
                  </span>
                </div>
              )}

              {/* En-têtes de colonnes : une seule fois, au-dessus de la
                  première section ; les colonnes restent alignées dessous. */}
              {groupIndex === 0 && (
                <div
                  className={`hidden px-4 pb-2 pt-3 text-xs text-zinc-500 md:grid dark:text-zinc-400 ${ROW_COLUMNS}`}
                  aria-hidden
                >
                  <span className="col-span-2">Game</span>
                  <span>Players</span>
                  <span>Mode</span>
                  <span />
                </div>
              )}

              <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
                {group.games.map((game) => (
                  <GameRow key={game.slug} game={game} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <EmptyState
            query={query.trim()}
            onReset={resetFilters}
            canReset={hasFilters}
          />
        )}
      </section>
    </main>
  );
}

function SearchField({
  inputRef,
  value,
  onChange,
}: {
  // Type structurel : accepté tel quel par React 18 et React 19.
  inputRef: { current: HTMLInputElement | null };
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="relative w-full md:max-w-sm">
      <label htmlFor={id} className="sr-only">
        Search games
      </label>

      <HugeiconsIcon
        icon={Search01Icon}
        size={17}
        strokeWidth={1.8}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
      />

      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        placeholder="Search by name or category"
        autoComplete="off"
        className="h-10 w-full appearance-none rounded-md border border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/25 dark:border-white/15 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
      />

      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-emerald-700 dark:hover:text-white"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
            <path
              d="M3.5 3.5l9 9m0-9l-9 9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-300 px-1.5 text-xs leading-5 text-zinc-500 sm:block dark:border-white/20 dark:text-zinc-400"
        >
          /
        </kbd>
      )}
    </div>
  );
}

/**
 * Les sièges autour de la table : un point par place possible. Les points
 * pleins sont le minimum de joueurs requis, les cercles vides sont les places
 * en option jusqu'au maximum. On lit « 2 à 4 joueurs » sans lire de chiffre.
 */
function Seats({ min, max }: { min: number; max: number }) {
  const shown = Math.min(max, 8);
  const range = min === max ? `${min}` : `${min}\u2013${max}`;

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

      <span className="text-sm tabular-nums">
        {range}
        <span className="md:sr-only"> players</span>
      </span>
    </span>
  );
}

function Cover({ game, muted }: { game: GameEntry; muted: boolean }) {
  return (
    <div
      className={[
        "relative aspect-video w-28 overflow-hidden rounded-md bg-zinc-200 ring-1 ring-inset ring-black/10 sm:w-36 md:w-full dark:bg-zinc-800 dark:ring-white/10",
        muted ? "saturate-[.6]" : "",
      ].join(" ")}
    >
      {game.image ? (
        <Image
          src={game.image}
          alt=""
          fill
          sizes="(max-width: 768px) 144px, 144px"
          className="object-cover"
        />
      ) : (
        <div
          className={[
            "absolute inset-0 flex items-center justify-center bg-linear-to-br text-3xl font-semibold text-white",
            game.accent ?? "from-slate-400 to-slate-700",
          ].join(" ")}
        >
          {game.icon}
        </div>
      )}
    </div>
  );
}

function GameRow({ game }: { game: GameEntry }) {
  const live = game.status === "live";
  const online = live && game.playableOnline;

  const button =
    "inline-flex h-9 items-center justify-center rounded-md px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

  return (
    <li
      className={`group relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 px-3 py-4 transition-colors hover:bg-zinc-100 sm:px-4 md:items-center ${ROW_COLUMNS} dark:hover:bg-white/[0.04]`}
    >
      <Cover game={game} muted={!live} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight">
            {/* Lien étiré : toute la ligne ouvre la fiche du jeu, les
                boutons d'action restent au-dessus (z-10). */}
            <Link
              href={`/games/${game.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-emerald-700"
            >
              {game.title}
            </Link>
          </h3>

          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {game.category}
          </span>

          {!live && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">
              In development
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 max-w-prose text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {game.description}
        </p>
      </div>

      <div className="col-span-2 flex flex-wrap items-center gap-x-6 gap-y-1 md:contents">
        <Seats min={game.minPlayers} max={game.maxPlayers} />

        <span className="text-sm text-zinc-700 dark:text-zinc-300">
          {game.playableOnline ? "Online and local" : "Local only"}
        </span>
      </div>

      <div className="relative z-10 col-span-2 flex gap-2 md:col-span-1 md:justify-end">
        {online ? (
          <>
            <Link
              href={`/games/${game.slug}/play`}
              className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}
            >
              Play online
            </Link>
            <Link
              href={`/games/${game.slug}`}
              className={`${button} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/10`}
            >
              Play locally
            </Link>
          </>
        ) : (
          <Link
            href={`/games/${game.slug}`}
            className={`${button} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/10`}
          >
            View game
          </Link>
        )}
      </div>
    </li>
  );
}

function EmptyState({
  query,
  canReset,
  onReset,
}: {
  query: string;
  canReset: boolean;
  onReset: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-start gap-3 border-y border-zinc-200 px-3 py-14 sm:px-4 dark:border-white/10">
      <HugeiconsIcon
        icon={GameController02Icon}
        size={28}
        strokeWidth={1.6}
        className="text-zinc-400"
      />

      <h2 className="text-base font-semibold">
        {query
          ? `No game matches \u201C${query}\u201D`
          : "No game matches these filters"}
      </h2>

      <p className="max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Check the spelling, pick another category, or turn off the online filter
        to see every game.
      </p>

      {canReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-1 inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3.5 text-sm font-medium hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 dark:border-white/15 dark:bg-transparent dark:hover:bg-white/10"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
