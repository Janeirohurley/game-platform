"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getSnapshot(): boolean {
  return document.visibilityState !== "hidden";
}

/** Côté serveur, l'onglet est considéré visible (aucun état à rendre). */
function getServerSnapshot(): boolean {
  return true;
}

/**
 * Vrai tant que l'onglet est visible, faux dès que la page passe en
 * arrière-plan (bascule d'onglet, téléphone qui sonne, fenêtre minimisée…).
 *
 * Sert à geler une boucle de jeu temps réel quand on ne la regarde pas, plutôt
 * que de la laisser tourner à vide : le jeu reprend au retour, sans rien
 * perdre. Lu via `useSyncExternalStore` pour rester synchrone avec le DOM et
 * éviter un setState dans un effet.
 */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
