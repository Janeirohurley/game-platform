/**
 * Petite persistance `localStorage` pour les parties locales (hors ligne).
 *
 * Chaque partie est rangée dans une enveloppe versionnée : si la forme du
 * moteur change un jour, une sauvegarde d'une ancienne version est simplement
 * ignorée (on repart d'une partie neuve) au lieu de planter le jeu en tentant
 * de la relire.
 *
 * Aucune de ces fonctions ne doit jeter : sans stockage disponible (navigation
 * privée, quota plein), la partie reste jouable — on perd seulement la reprise.
 * Aucune donnée sensible n'y transite : seulement l'état du plateau.
 */

interface Envelope<T> {
  /** Version de format : à incrémenter quand la forme de `state` change. */
  v: number;
  /** Horodatage du dernier enregistrement. */
  t: number;
  s: T;
}

/** Relit une partie enregistrée, ou `null` si absente/illisible/trop ancienne. */
export function loadGameState<T>(key: string, version: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || parsed.v !== version) return null;
    return parsed.s ?? null;
  } catch {
    return null;
  }
}

/** Enregistre l'état d'une partie (silencieusement ignoré sans stockage). */
export function saveGameState<T>(key: string, version: number, state: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: Envelope<T> = { v: version, t: Date.now(), s: state };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    /* sans stockage, la partie n'est simplement pas remise à plus tard */
  }
}

/** Efface une partie enregistrée (fin de partie, abandon, redémarrage). */
export function clearGameState(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* rien à faire */
  }
}
