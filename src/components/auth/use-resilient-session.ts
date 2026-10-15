"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useSession } from "@/lib/auth-client";

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getOfflineSnapshot = () =>
  typeof navigator === "undefined" ? false : !navigator.onLine;
const getOfflineServerSnapshot = () => false;

/**
 * Session better-auth, mais qui NE renonce JAMAIS sur une erreur réseau.
 *
 * `useSession` seul laisse l'utilisateur « dans l'ombre » dès que le premier
 * appel échoue : plus d'avatar, plus de nom, et aucun signe qu'une nouvelle
 * tentative est en cours. Ici on réessaie tant qu'aucune session n'est
 * revenue :
 *   - hors-ligne : on attend l'événement `online` du navigateur (inutile de
 *     marteler le réseau alors qu'il est coupé) ;
 *   - en ligne mais en échec : on relance `refetch` avec un délai qui double
 *     à chaque essai (1 s, 2 s, 4 s… plafonné à 30 s), sans jamais abandonner.
 *
 * Le hook expose `isReconnecting` pour que l'interface puisse dire clairement
 * « Reconnecting… » au lieu de laisser croire que tout va bien.
 */
export function useResilientSession() {
  const { data: session, isPending, error, refetch } = useSession();
  const isOffline = useSyncExternalStore(
    subscribeOnline,
    getOfflineSnapshot,
    getOfflineServerSnapshot,
  );
  const attempts = useRef(0);
  // Passe à `true` dès le premier essai de reconnexion : l'interface peut
  // alors dire « Reconnecting… » au lieu de rester muette.
  const [hasRetried, setHasRetried] = useState(false);

  // `refetch` peut changer d'identité : on la garde dans une ref pour ne pas
  // relancer le minuteur de reconnexion à chaque rendu.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    // Une session existe (même après une coupure réseau) : rien à surveiller.
    if (session) {
      attempts.current = 0;
      return;
    }
    // Première réponse encore en cours, sans échec : rien à ajouter.
    if (isPending && !error && !isOffline) return;
    // Hors-ligne : on attend le retour du réseau (qui relancera l'effet).
    if (isOffline) return;

    const delay = Math.min(FIRST_RETRY_MS * 2 ** attempts.current, MAX_RETRY_MS);
    const timer = window.setTimeout(() => {
      attempts.current += 1;
      setHasRetried(true);
      void Promise.resolve(refetchRef.current()).catch(() => {
        /* l'effet suivant replanifie un nouvel essai */
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [session, isPending, error, isOffline]);

  const isReconnecting =
    !session && (isOffline || Boolean(error) || hasRetried);
  const isLoadingSession = !session && (isPending || isReconnecting);

  return {
    session,
    error,
    isOffline,
    isReconnecting,
    isLoadingSession,
  };
}
