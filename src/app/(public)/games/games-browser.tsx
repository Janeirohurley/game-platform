"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Globe,
  LayoutGrid,
  Monitor,
  Search,
  Users,
  X,
} from "lucide-react";

import Navbar from "@/components/navbar";
import { cn } from "cn";

import type { GameEntry, GameCategory } from "@/lib/games/registry";

type FilterCategory = "All" | GameCategory;
type ModeFilter = "all" | "online" | "local";

interface GamesBrowserProps {
  games: GameEntry[];
  categories: GameCategory[];
}

/* -------------------------------------------------------------------------
 * Catalogue en galerie, sur le modèle des plateformes de jeux grand public :
 * une barre latérale persistante pour parcourir, et des rangées de vignettes
 * carrées dans la zone principale.
 *
 * Deux affichages, et le choix est automatique :
 *
 *   - AUCUN filtre actif  → les rangées éditorialisées (mise en avant, puis
 *     une rangée par catégorie). C'est une page d'accueil : on propose.
 *   - UN filtre actif     → une grille unique et plate. L'utilisateur a
 *     exprimé une intention précise ; la découper en rangées thématiques
 *     noierait le résultat qu'il cherche.
 *
 * Avec un petit catalogue, empiler des rangées presque vides donnerait une
 * page qui a l'air cassée. D'où la vignette héros en tête de la mise en
 * avant : elle occupe quatre cases et donne du poids à la première ligne
 * même quand il y a peu de jeux.
 * ---------------------------------------------------------------------- */

function matchesQuery(game: GameEntry, query: string) {
  if (!query) return true;
  return [game.title, game.description, game.category].some((value) =>
    value.toLowerCase().includes(query),
  );
}

function isOnline(game: GameEntry) {
  return game.status === "live" && game.playableOnline;
}

/* ---------------------------------------------------------------- vignette */

/**
 * Vignette carrée. L'image porte seule l'identification du jeu — c'est elle
 * qu'on reconnaît d'un coup d'œil, pas le texte — donc elle remplit la case
 * et le titre vit par-dessus, sur un dégradé qui garantit le contraste quelle
 * que soit l'image en dessous.
 *
 * Le `<Link>` est en couverture absolue : toute la tuile est cliquable, et
 * le focus clavier dessine un anneau sur la tuile entière.
 */
function GameTile({
  game,
  size = "md",
  priority = false,
}: {
  game: GameEntry;
  size?: "md" | "hero";
  priority?: boolean;
}) {
  const live = game.status === "live";
  const hero = size === "hero";

  return (
    <article
      className={cn(
        "group relative isolate overflow-hidden rounded-xl",
        "bg-zinc-200 ring-1 ring-inset ring-black/10 dark:bg-zinc-800 dark:ring-white/10",
        "transition-transform duration-200 hover:scale-[1.02] focus-within:scale-[1.02]",
        hero ? "col-span-2 row-span-2" : "",
        !live && "saturate-[.55]",
      )}
    >
      <div className="relative aspect-square w-full">
        {game.image ? (
          <Image
            src={game.image}
            alt=""
            fill
            priority={priority}
            sizes={
              hero
                ? "(max-width: 640px) 66vw, (max-width: 1280px) 40vw, 26rem"
                : "(max-width: 640px) 33vw, (max-width: 1280px) 20vw, 13rem"
            }
            className="object-cover"
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 grid place-items-center bg-linear-to-br font-semibold text-white",
              hero ? "text-6xl" : "text-3xl",
              game.accent ?? "from-slate-400 to-slate-700",
            )}
          >
            {game.icon}
          </div>
        )}

        {/* Voile de lisibilité: sans lui, un titre clair sur une image claire
            devient illisible, et on ne contrôle pas les images du registre. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-black/85 via-black/45 to-transparent"
        />

        {/* Pastilles d'état, en haut: ce qui conditionne l'envie de cliquer
            (jouable en ligne ? pas encore sorti ?) doit se voir avant le
            titre. */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          {isOnline(game) ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-emerald-300 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          ) : (
            <span />
          )}

          {!live && (
            <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
              Soon
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <h3
            className={cn(
              "truncate font-semibold text-white drop-shadow",
              hero ? "text-xl sm:text-2xl" : "text-sm",
            )}
          >
            <Link
              href={`/games/${game.slug}`}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-emerald-400"
            >
              {game.title}
            </Link>
          </h3>

          <p
            className={cn(
              "mt-0.5 flex items-center gap-2 text-white/75",
              hero ? "text-sm" : "text-[11px]",
            )}
          >
            <span className="truncate">{game.category}</span>
            <span aria-hidden className="text-white/35">
              •
            </span>
            <span className="inline-flex shrink-0 items-center gap-1">
              <Users className="size-3" aria-hidden />
              {game.minPlayers === game.maxPlayers
                ? game.minPlayers
                : `${game.minPlayers}–${game.maxPlayers}`}
            </span>
          </p>

          {/* Le pitch n'a de place que sur la vignette héros. Ailleurs il
              serait tronqué à trois mots, donc inutile. */}
          {hero && (
            <p className="mt-2 line-clamp-2 max-w-md text-sm leading-6 text-white/80">
              {game.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- rangée */

/**
 * Rangée à défilement horizontal, avec des flèches qui n'apparaissent que
 * lorsqu'il reste quelque chose à voir de ce côté — une flèche qui ne fait
 * rien est un mensonge d'interface.
 *
 * Le défilement natif reste disponible (tactile, trackpad, molette), les
 * flèches ne sont qu'un raccourci pointeur. `scroll-snap` aligne les
 * vignettes pour qu'aucune ne reste coupée en fin de course.
 */
function ScrollRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    // La tolérance de 2px absorbe les arrondis sous-pixel des écrans HiDPI,
    // qui sinon laissent la flèche « suivant » allumée au bout de la course.
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h2>

        <div className="flex gap-1.5">
          {(["prev", "next"] as const).map((direction) => {
            const disabled = direction === "prev" ? atStart : atEnd;
            const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
            return (
              <button
                key={direction}
                type="button"
                onClick={() => scrollBy(direction === "prev" ? -1 : 1)}
                disabled={disabled}
                aria-label={direction === "prev" ? "Scroll left" : "Scroll right"}
                className={cn(
                  "grid size-8 place-items-center rounded-full border transition",
                  "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100",
                  "dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
                  disabled && "pointer-events-none opacity-0",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={ref}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ latérale */

function SidebarLink({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-emerald-600/10 font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {count}
        </span>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- page */

export function GamesBrowser({ games, categories }: GamesBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("All");
  const [mode, setMode] = useState<ModeFilter>("all");
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

  // Les compteurs de la latérale se calculent APRÈS la recherche et le mode,
  // mais AVANT la catégorie: un compteur doit annoncer exactement le nombre
  // de vignettes qu'on obtiendra en cliquant dessus.
  const base = useMemo(
    () =>
      games.filter((game) => {
        if (mode === "online" && !isOnline(game)) return false;
        if (mode === "local" && isOnline(game)) return false;
        return matchesQuery(game, normalizedQuery);
      }),
    [games, mode, normalizedQuery],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const game of base) {
      map.set(game.category, (map.get(game.category) ?? 0) + 1);
    }
    return map;
  }, [base]);

  const visible = useMemo(
    () =>
      category === "All" ? base : base.filter((g) => g.category === category),
    [base, category],
  );

  const hasFilters = query !== "" || category !== "All" || mode !== "all";

  // Mise en avant: les jeux jouables en ligne d'abord — c'est la promesse de
  // la plateforme —, puis les autres jeux sortis, les non sortis en dernier.
  const featured = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const rank = (g: GameEntry) =>
          isOnline(g) ? 0 : g.status === "live" ? 1 : 2;
        return rank(a) - rank(b) || a.title.localeCompare(b.title);
      }),
    [visible],
  );

  const byCategory = useMemo(
    () =>
      categories
        .map((name) => ({
          name,
          games: visible.filter((g) => g.category === name),
        }))
        .filter((row) => row.games.length > 0),
    [categories, visible],
  );

  const liveCount = games.filter((g) => g.status === "live").length;
  const onlineCount = games.filter(isOnline).length;

  function resetFilters() {
    setQuery("");
    setCategory("All");
    setMode("all");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl gap-8 px-4 pb-24 pt-6 sm:px-6 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
        {/* ------------------------------------------------ barre latérale */}
        {/* `self-start` + `sticky`: la latérale suit le défilement sans
            s'étirer sur toute la hauteur de la grille. Sous `lg`, elle
            redevient une barre horizontale défilante au-dessus du contenu. */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="Browse games">
            <p className="hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 lg:block dark:text-zinc-500">
              Browse
            </p>

            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
              <div className="shrink-0 lg:shrink lg:w-full">
                <SidebarLink
                  active={category === "All" && mode === "all"}
                  onClick={() => {
                    setCategory("All");
                    setMode("all");
                  }}
                  icon={LayoutGrid}
                  label="All games"
                  count={games.length}
                />
              </div>
              <div className="shrink-0 lg:shrink lg:w-full">
                <SidebarLink
                  active={mode === "online"}
                  onClick={() => setMode(mode === "online" ? "all" : "online")}
                  icon={Globe}
                  label="Online"
                  count={onlineCount}
                />
              </div>
              <div className="shrink-0 lg:shrink lg:w-full">
                <SidebarLink
                  active={mode === "local"}
                  onClick={() => setMode(mode === "local" ? "all" : "local")}
                  icon={Monitor}
                  label="Local only"
                  count={games.length - onlineCount}
                />
              </div>
            </div>

            <p className="mt-5 hidden px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 lg:block dark:text-zinc-500">
              Categories
            </p>

            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {categories.map((name) => (
                <div key={name} className="shrink-0 lg:shrink lg:w-full">
                  <SidebarLink
                    active={category === name}
                    onClick={() =>
                      setCategory(category === name ? "All" : name)
                    }
                    icon={Gamepad2}
                    label={name}
                    count={counts.get(name) ?? 0}
                  />
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* --------------------------------------------------- zone centrale */}
        <div className="mt-6 min-w-0 lg:mt-0">
          {/* Recherche */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games and categories"
              aria-label="Search games and categories"
              className={cn(
                "h-12 w-full rounded-full border pl-11 pr-11 text-sm outline-none transition",
                "border-zinc-300 bg-white placeholder:text-zinc-400",
                "focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20",
                "dark:border-white/10 dark:bg-white/5 dark:placeholder:text-zinc-500",
                "dark:focus:border-emerald-400/60 dark:focus:ring-emerald-400/15",
              )}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {liveCount} of {games.length} games are live, and {onlineCount} can
            match you with other players online.
          </p>

          {visible.length === 0 ? (
            <div className="mt-16 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-white/15">
              <p className="text-base font-medium">No game matches.</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {query
                  ? `Nothing for “${query}” with the current filters.`
                  : "No game in this selection yet."}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-6 inline-flex h-9 items-center rounded-md bg-emerald-700 px-4 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                Reset filters
              </button>
            </div>
          ) : hasFilters ? (
            /* Intention précise exprimée → une grille plate, sans rangées. */
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {visible.length} result{visible.length > 1 ? "s" : ""}
                </h2>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm text-zinc-500 underline-offset-4 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-white"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {visible.map((game) => (
                  <GameTile key={game.id} game={game} />
                ))}
              </div>
            </section>
          ) : (
            <>
              {/* Mise en avant: la première vignette occupe quatre cases. */}
              <section className="mt-8">
                <h2 className="mb-3 text-lg font-semibold tracking-tight sm:text-xl">
                  Top picks
                </h2>

                <div className="grid auto-rows-fr grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                  {featured.map((game, index) => (
                    <GameTile
                      key={game.id}
                      game={game}
                      size={index === 0 ? "hero" : "md"}
                      priority={index === 0}
                    />
                  ))}
                </div>
              </section>

              {/* Une rangée par catégorie non vide. */}
              {byCategory.map((row) => (
                <ScrollRow key={row.name} title={row.name}>
                  {row.games.map((game) => (
                    <div
                      key={game.id}
                      className="w-36 shrink-0 snap-start sm:w-44"
                    >
                      <GameTile game={game} />
                    </div>
                  ))}
                </ScrollRow>
              ))}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
