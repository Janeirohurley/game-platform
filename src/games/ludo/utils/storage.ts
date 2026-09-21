const KEY = "ludo-save-v1";

export function saveGame(state: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    window.localStorage.removeItem(KEY);
  }
}

export function loadGame(): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(KEY);
    return null;
  }
}

export function clearSavedGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
