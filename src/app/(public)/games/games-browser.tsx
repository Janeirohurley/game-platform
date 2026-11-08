"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Dices,
  Flame,
  Gamepad2,
  Globe,
  Joystick,
  LayoutGrid,
  Menu,
  Monitor,
  Search,
  Sparkles,
  Swords,
  Users,
  X,
} from "lucide-react";

import { useResilientSession } from "@/components/auth/use-resilient-session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "cn";

import type { GameEntry, GameCategory } from "@/lib/games/registry";

type FilterCategory = "All" | GameCategory;
type ModeFilter = "all" | "online" | "local";

interface GamesBrowserProps {
  games: GameEntry[];
  categories: GameCategory[];
}

/* ===========================================================================
 * PORTAIL DE JEUX — sur le modèle des grandes plateformes grand public.
 *
 * Cette page porte sa PROPRE chrome (barre du haut + latérale permanente) au
 * lieu de la navigation du site. C'est délibéré : un portail de jeux est une
 * application de navigation, pas une page de contenu. La recherche y est
 * centrale, les catégories toujours visibles, et la densité prime sur le
 * blanc tournant.
 *
 * Elle est SOMBRE quel que soit le thème du système. Les vignettes sont des
 * visuels saturés : posées sur du blanc, elles se battent avec la page au
 * lieu de ressortir. Le modèle de référence est sombre pour cette raison, et
 * les couleurs ci-dessous sont fixées en dur plutôt que prises aux variables
 * de thème du site — sinon la moitié de la page basculerait en clair.
 *
 * Deux affichages, choisis automatiquement :
 *   - aucun filtre → rangées éditorialisées (mosaïque + rangées défilantes),
 *     c'est une vitrine : on propose.
 *   - un filtre    → une grille plate. L'intention est précise, la découper
 *     en rangées noierait le résultat cherché.
 * ======================================================================== */

const SURFACE = {
  page: "bg-[#15141b]",
  bar: "bg-[#1d1c26]",
  panel: "bg-[#22212c]",
  hover: "hover:bg-white/[0.06]",
  border: "border-white/[0.07]",
  text: "text-white",
  muted: "text-white/45",
};

/** Une teinte par catégorie : la latérale se lit alors d'un coup d'œil. */
const CATEGORY_STYLE: Record<string, { icon: typeof Dices; tint: string }> = {
  Board: { icon: Dices, tint: "text-sky-400" },
  Strategy: { icon: Swords, tint: "text-amber-400" },
  Arcade: { icon: Joystick, tint: "text-fuchsia-400" },
  Action: { icon: Flame, tint: "text-rose-400" },
  Puzzle: { icon: Sparkles, tint: "text-emerald-400" },
};

function categoryStyle(name: string) {
  return CATEGORY_STYLE[name] ?? { icon: Gamepad2, tint: "text-violet-400" };
}

function matchesQuery(game: GameEntry, query: string) {
  if (!query) return true;
  return [game.title, game.description, game.category].some((value) =>
    value.toLowerCase().includes(query),
  );
}

function isOnline(game: GameEntry) {
  return game.status === "live" && game.playableOnline;
}

/**
 * Taille de chaque case de la mosaïque.
 *
 * Le héros occupe quatre cases (2×2). Sur une grille à quatre colonnes, il
 * reste donc une zone de 2×2 à sa droite : un nombre PAIR de tuiles la remplit
 * exactement, un nombre impair y laisse un trou. Dans ce cas, la dernière
 * tuile est élargie à deux colonnes et bouche la case manquante.
 *
 * Sans cette règle, un catalogue de quatre jeux affichait un héros flanqué de
 * trois vignettes et d'un grand vide — ce qui donne une page qui a l'air
 * cassée plutôt que peu fournie.
 */
function mosaicSpan(index: number, total: number): "hero" | "wide" | "sm" {
  if (index === 0) return "hero";
  const rest = total - 1;
  return rest % 2 === 1 && index === total - 1 ? "wide" : "sm";
}

function playerRange(game: GameEntry) {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}`
    : `${game.minPlayers}–${game.maxPlayers}`;
}

/* ------------------------------------------------------------- vignettes */

/**
 * Vignette carrée.
 *
 * L'image porte seule l'identification du jeu — c'est elle qu'on reconnaît
 * d'un coup d'œil, pas une légende. Le titre vit donc PAR-DESSUS, sur un
 * dégradé qui garantit le contraste quelle que soit l'image, et aucune
 * hauteur n'est réservée à du texte sous la case : c'est ce qui permet aux
 * vignettes de se toucher et à la grille d'être dense.
 *
 * Le `<Link>` couvre toute la tuile en absolu : tout est cliquable, et le
 * focus clavier dessine un anneau sur la tuile entière plutôt que sur un
 * titre de trois mots.
 */
function GameTile({
  game,
  span = "sm",
  priority = false,
}: {
  game: GameEntry;
  span?: "sm" | "hero" | "tall" | "wide";
  priority?: boolean;
}) {
  const live = game.status === "live";
  const big = span === "hero";

  return (
    <article
      className={cn(
        "group relative isolate overflow-hidden rounded-xl bg-white/[0.04]",
        "ring-1 ring-inset ring-white/[0.08]",
        "transition duration-200 hover:ring-white/25 focus-within:ring-white/30",
        "hover:-translate-y-0.5 focus-within:-translate-y-0.5",
        span === "hero" && "col-span-2 row-span-2",
        span === "tall" && "row-span-2",
        span === "wide" && "col-span-2",
        !live && "saturate-[.5]",
      )}
    >
      {/* `aspect-square` sur la tuile simple ; les tuiles qui s'étendent sur
          deux lignes doivent remplir la hauteur de la grille, pas imposer un
          carré — d'où `h-full` et l'absence de ratio. */}
      <div
        className={cn(
          "relative w-full",
          // En DESSOUS de `lg`, chaque tuile porte son propre ratio : les
          // lignes n'ont pas de hauteur imposée, et sans ça le héros
          // s'effondrait en mobile (à deux colonnes il occupe seul ses deux
          // lignes, aucune voisine carrée ne leur donnait de hauteur).
          //
          // À partir de `lg`, c'est la GRILLE qui fixe la hauteur des lignes
          // et les tuiles la remplissent — d'où `lg:aspect-auto lg:h-full`.
          // La hauteur de la vitrine ne dépend alors plus de la largeur des
          // colonnes : elle est voulue, pas subie.
          (span === "sm" || span === "hero") && "aspect-square",
          span === "wide" && "aspect-2/1",
          span === "tall" && "h-full",
          span !== "tall" && "lg:aspect-auto lg:h-full",
        )}
      >
        {game.image ? (
          <Image
            src={game.image}
            alt=""
            fill
            priority={priority}
            sizes={
              big
                ? "(max-width: 640px) 70vw, (max-width: 1280px) 42vw, 28rem"
                : "(max-width: 640px) 36vw, (max-width: 1280px) 21vw, 14rem"
            }
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 grid place-items-center bg-linear-to-br font-bold text-white",
              big ? "text-6xl" : "text-3xl",
              game.accent ?? "from-slate-500 to-slate-800",
            )}
          >
            {game.icon}
          </div>
        )}

        {/* Voile de lisibilité : sans lui, un titre clair sur une image claire
            devient illisible. Il ne couvre que le bas, pour ne pas ternir le
            visuel qui est l'argument de vente de la tuile. */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/85 via-black/35 to-transparent" />

        {/* Pastilles d'état, en haut à droite comme sur le modèle. */}
        <div className="absolute right-2 top-2 flex gap-1.5">
          {isOnline(game) && (
            <span
              title="Jouable en ligne"
              className="grid size-6 place-items-center rounded-md bg-black/55 text-emerald-300 backdrop-blur-sm"
            >
              <Users className="size-3.5" aria-hidden />
              <span className="sr-only">Jouable en ligne</span>
            </span>
          )}
          {!live && (
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70 backdrop-blur-sm">
              Bientôt
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3
            className={cn(
              "font-semibold leading-tight text-white drop-shadow",
              big ? "text-2xl sm:text-3xl" : "text-sm",
            )}
          >
            {game.title}
          </h3>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1.5 text-white/60",
              big ? "text-xs sm:text-sm" : "text-[11px]",
            )}
          >
            <span>{game.category}</span>
            <span aria-hidden>·</span>
            <Users className="size-3" aria-hidden />
            <span className="tabular-nums">{playerRange(game)}</span>
          </p>
          {big && (
            <p className="mt-2 hidden max-w-sm text-sm leading-6 text-white/65 sm:line-clamp-2">
              {game.description}
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/games/${game.slug}`}
        className="absolute inset-0 rounded-xl outline-none ring-emerald-400 focus-visible:ring-2"
      >
        <span className="sr-only">Ouvrir {game.title}</span>
      </Link>
    </article>
  );
}

/**
 * Carte paysage 16:9 de la rangée « en vedette ».
 *
 * `grow basis-64 shrink-0` : la carte s'étire pour occuper la largeur
 * disponible tant que la rangée ne déborde pas, et refuse de passer sous
 * 16rem dès qu'il y a trop de cartes — la rangée redevient alors un
 * défilement. Une largeur fixe laissait un grand vide à droite quand le
 * catalogue est petit.
 */
function FeatureCard({ game }: { game: GameEntry }) {
  return (
    <article className="group relative isolate shrink-0 grow basis-64 snap-start overflow-hidden rounded-xl ring-1 ring-inset ring-white/[0.08] transition hover:ring-white/25">
      <div className="relative aspect-video w-full bg-white/[0.04]">
        {game.image ? (
          <Image
            src={game.image}
            alt=""
            fill
            sizes="18rem"
            className="object-cover transition duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={cn(
              "absolute inset-0 grid place-items-center bg-linear-to-br text-4xl font-bold text-white",
              game.accent ?? "from-slate-500 to-slate-800",
            )}
          >
            {game.icon}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-black/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-sm font-semibold text-white drop-shadow">
            {game.title}
          </h3>
          <p className="text-[11px] text-white/55">{game.category}</p>
        </div>
      </div>
      <Link
        href={`/games/${game.slug}`}
        className="absolute inset-0 rounded-xl outline-none ring-emerald-400 focus-visible:ring-2"
      >
        <span className="sr-only">Ouvrir {game.title}</span>
      </Link>
    </article>
  );
}

/* ------------------------------------------------------ rangée défilante */

/**
 * Rangée horizontale à défilement.
 *
 * Les flèches n'apparaissent QUE lorsqu'il y a réellement de quoi défiler, et
 * elles disparaissent une fois arrivé au bout. Un `ResizeObserver` recalcule
 * cela quand la fenêtre change : une rangée qui déborde en 1280px peut tenir
 * entière en 1920px, et une flèche qui ne fait rien est pire que pas de
 * flèche du tout.
 */
function ScrollRow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const sync = () => {
      const overflow = track.scrollWidth - track.clientWidth;
      setAtStart(track.scrollLeft <= 2);
      // 2px de marge : les largeurs fractionnaires empêchent scrollLeft
      // d'atteindre exactement le maximum, et la flèche resterait allumée.
      setAtEnd(overflow <= 2 || track.scrollLeft >= overflow - 2);
    };

    sync();
    track.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);

    return () => {
      track.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [children]);

  const nudge = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(240, track.clientWidth * 0.8),
      behavior: "smooth",
    });
  };

  const scrollable = !atStart || !atEnd;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
        {scrollable && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={atStart}
              aria-label={`Faire défiler ${title} vers la gauche`}
              className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={atEnd}
              aria-label={`Faire défiler ${title} vers la droite`}
              className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-25"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* `snap-x` pour que le défilement tactile s'arrête sur une vignette
          entière ; les barres natives sont masquées, les flèches et le geste
          suffisent. */}
      <div
        ref={trackRef}
        className="flex snap-x gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- barre latérale */

function SidebarLink({
  active,
  onClick,
  icon: Icon,
  tint,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  tint?: string;
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
          ? "bg-white/[0.09] font-semibold text-white"
          : cn("text-white/65", SURFACE.hover, "hover:text-white"),
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", tint ?? "text-white/50")} />
      <span className="truncate">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-xs tabular-nums text-white/30">
          {count}
        </span>
      )}
    </button>
  );
}

/* --------------------------------------------------------------- la page */

export function GamesBrowser({ games, categories }: GamesBrowserProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FilterCategory>("All");
  const [mode, setMode] = useState<ModeFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { session, isLoadingSession } = useResilientSession();

  // « / » met le focus dans la recherche, comme sur les sites où l'on cherche
  // souvent. Sans effet quand on est déjà en train de taper quelque part.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
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
  // mais AVANT la catégorie : un compteur doit annoncer exactement le nombre
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

  // Mise en avant : les jeux jouables en ligne d'abord — c'est la promesse de
  // la plateforme —, puis les autres jeux sortis, les non sortis en dernier.
  const ranked = useMemo(
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
        // Au moins deux jeux : une « rangée » d'une seule vignette n'est pas
        // une rangée, c'est une vignette avec un titre au-dessus. La latérale
        // mène déjà à cette catégorie, la ligne n'ajoute rien et donne une
        // page en escalier.
        .filter((row) => row.games.length > 1),
    [categories, visible],
  );

  const onlineCount = games.filter(isOnline).length;
  const localCount = games.length - onlineCount;

  function resetFilters() {
    setQuery("");
    setCategory("All");
    setMode("all");
  }

  const sidebar = (
    <nav aria-label="Parcourir les jeux" className="space-y-6">
      <div className="space-y-0.5">
        <SidebarLink
          active={category === "All" && mode === "all" && query === ""}
          onClick={resetFilters}
          icon={LayoutGrid}
          tint="text-violet-400"
          label="Tous les jeux"
          count={games.length}
        />
        <SidebarLink
          active={mode === "online"}
          onClick={() => setMode(mode === "online" ? "all" : "online")}
          icon={Globe}
          tint="text-emerald-400"
          label="Multijoueur"
          count={onlineCount}
        />
        <SidebarLink
          active={mode === "local"}
          onClick={() => setMode(mode === "local" ? "all" : "local")}
          icon={Monitor}
          tint="text-sky-400"
          label="Hors ligne"
          count={localCount}
        />
      </div>

      <div className={cn("space-y-0.5 border-t pt-5", SURFACE.border)}>
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Catégories
        </p>
        {categories.map((name) => {
          const style = categoryStyle(name);
          return (
            <SidebarLink
              key={name}
              active={category === name}
              onClick={() => setCategory(category === name ? "All" : name)}
              icon={style.icon}
              tint={style.tint}
              label={name}
              count={counts.get(name) ?? 0}
            />
          );
        })}
      </div>

      <div className={cn("space-y-0.5 border-t pt-5", SURFACE.border)}>
        {[
          { href: "/how-it-works", label: "Comment ça marche" },
          { href: "/community", label: "Communauté" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm text-white/55 transition-colors hover:text-white",
              SURFACE.hover,
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );

  return (
    <div className={cn("min-h-screen", SURFACE.page, SURFACE.text)}>
      {/* ------------------------------------------------- barre du haut */}
      <header
        className={cn(
          "sticky top-0 z-40 border-b",
          SURFACE.bar,
          SURFACE.border,
        )}
      >
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menuOpen}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg text-white/70 transition hover:text-white lg:hidden",
              SURFACE.hover,
            )}
          >
            {menuOpen ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Menu className="size-5" aria-hidden />
            )}
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2 pr-2">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-black">
              <Gamepad2 className="size-5" aria-hidden />
            </span>
            <span className="hidden text-base font-extrabold tracking-tight sm:block">
              Game Arena
            </span>
          </Link>

          {/* Recherche centrée : c'est la tâche principale d'un portail. */}
          <div className="mx-auto w-full max-w-md">
            <label htmlFor="games-search" className="sr-only">
              Rechercher un jeu ou une catégorie
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/35"
                aria-hidden
              />
              <input
                id="games-search"
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un jeu, une catégorie…"
                className={cn(
                  "h-10 w-full rounded-full pl-9 pr-9 text-sm text-white placeholder:text-white/35",
                  "ring-1 ring-inset ring-white/10 outline-none transition",
                  "focus:ring-2 focus:ring-emerald-400/70",
                  SURFACE.panel,
                )}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLoadingSession ? (
              <div
                className="size-9 animate-pulse rounded-full bg-white/10"
                role="status"
                aria-label="Chargement de la session"
              />
            ) : session ? (
              <>
                <Link
                  href="/wallet"
                  aria-label="Notifications et portefeuille"
                  className={cn(
                    "hidden size-9 place-items-center rounded-full text-white/60 transition hover:text-white sm:grid",
                    SURFACE.hover,
                  )}
                >
                  <Bell className="size-4" aria-hidden />
                </Link>
                <Link href="/profile" aria-label="Ouvrir ton profil">
                  <Avatar className="size-9 ring-1 ring-white/15 transition hover:ring-emerald-400">
                    {session.user.image ? (
                      <AvatarImage
                        className="object-cover"
                        src={session.user.image}
                        alt=""
                      />
                    ) : (
                      <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
                        {session.user.name?.charAt(0).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </Link>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex h-9 items-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ------------------------------------------------ barre latérale */}
        {/* Permanente à partir de `lg`, tiroir en dessous : elle porte toute
            la navigation du portail, la cacher sur grand écran obligerait à
            rouvrir un menu à chaque changement de catégorie. */}
        <aside
          className={cn(
            "hidden border-r px-3 py-5 lg:block",
            SURFACE.border,
            "lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto",
          )}
        >
          {sidebar}
        </aside>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Fermer le menu"
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <aside
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r px-3 py-5 lg:hidden",
                SURFACE.bar,
                SURFACE.border,
              )}
            >
              {sidebar}
            </aside>
          </>
        )}

        {/* ------------------------------------------------------ contenu */}
        {/* Pleine largeur, sans borne ni centrage : le contenu occupe tout
            l'espace laissé par la latérale, comme le portail de référence.
            Les vignettes grandissent donc avec l'écran plutôt que de laisser
            deux marges vides sur les côtés. */}
        <main className="min-w-0 px-4 pb-24 pt-6 sm:px-6">
          {visible.length === 0 ? (
            <div
              className={cn(
                "rounded-2xl border border-dashed px-6 py-16 text-center",
                SURFACE.border,
              )}
            >
              <p className="text-sm font-medium text-white/80">
                Aucun jeu ne correspond
              </p>
              <p className={cn("mt-1.5 text-xs", SURFACE.muted)}>
                Essaie un autre mot, ou enlève les filtres.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-5 inline-flex h-9 items-center rounded-full bg-white/10 px-4 text-sm font-medium text-white transition hover:bg-white/20"
              >
                Tout afficher
              </button>
            </div>
          ) : hasFilters ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold tracking-tight">
                  {category === "All" ? "Résultats" : category}
                </h1>
                <span className={cn("text-sm", SURFACE.muted)}>
                  {visible.length} jeu{visible.length > 1 ? "x" : ""}
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-xs font-medium text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  <X className="size-3.5" aria-hidden />
                  Effacer les filtres
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {ranked.map((game, index) => (
                  <GameTile key={game.id} game={game} priority={index < 4} />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* MOSAÏQUE — la tuile héros occupe quatre cases. Avec un petit
                  catalogue, une grille uniforme donnerait une page qui a l'air
                  vide ; le héros donne du poids à la première ligne et une
                  hiérarchie claire à l'œil qui arrive. */}
              <section>
                <h1 className="mb-3 text-xl font-bold tracking-tight">
                  Sélection pour toi
                </h1>
                {/* Deux colonnes, puis quatre. Pas de palier à trois ni à
                    cinq : le héros en occupe deux, donc seul un nombre PAIR
                    de colonnes laisse la place restante se paver proprement.
                    À trois colonnes, la zone à droite du héros n'en fait
                    qu'une et la mosaïque se disloque. */}
                {/* Hauteur de ligne fixée en `lg` : la vitrine occupe
                    l'essentiel du premier écran au lieu de dépendre de la
                    largeur des colonnes. Deux lignes font donc ~2/3 de la
                    fenêtre, bornées pour rester lisibles sur un portable
                    comme sur un 4K. Une ligne de plus ajoute sa hauteur au
                    lieu d'écraser les autres. */}
                <div className="grid grid-cols-2 gap-3 lg:auto-rows-[clamp(190px,32vh,380px)] lg:grid-cols-4">
                  {ranked.map((game, index) => (
                    <GameTile
                      key={game.id}
                      game={game}
                      span={mosaicSpan(index, ranked.length)}
                      priority={index < 3}
                    />
                  ))}
                </div>
              </section>

              {ranked.length > 1 && (
                <ScrollRow title="En vedette">
                  {ranked.map((game) => (
                    // Pas d'enveloppe : c'est l'ENFANT DIRECT du conteneur
                    // flex qui porte `grow`/`basis`. Glissé dans un <div>
                    // neutre, l'étirement de la carte n'avait aucun effet.
                    <FeatureCard key={game.id} game={game} />
                  ))}
                </ScrollRow>
              )}

              {byCategory.map((row) => (
                <ScrollRow key={row.name} title={row.name}>
                  {/* Même logique que les cartes en vedette, mais plafonnée :
                      une vignette carrée étirée à 400px dans une rangée de
                      deux jeux écraserait la mosaïque au-dessus. */}
                  {row.games.map((game) => (
                    <div
                      key={game.id}
                      className="max-w-52 shrink-0 grow basis-36 snap-start sm:basis-40"
                    >
                      <GameTile game={game} />
                    </div>
                  ))}
                </ScrollRow>
              ))}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
