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
 * Session better-auth qui ne renonce jamais sur une PANNE réseau — et qui
 * ne confond pas une panne avec un visiteur anonyme.
 *
 * La distinction est tout l'enjeu de ce hook :
 *
 *   `GET /api/auth/get-session` → 200 `null`   visiteur non connecté.
 *                                              C'est une RÉPONSE VALIDE.
 *   `GET /api/auth/get-session` → échec fetch  panne réelle : on réessaie.
 *
 * Une version antérieure ne regardait que `session`, et traitait donc tout
 * `null` comme un échec. Conséquence sur un visiteur simplement déconnecté :
 * une requête `get-session` en boucle (1 s, 2 s, 4 s… sans jamais aboutir,
 * puisque `null` est la bonne réponse) et un header bloqué sur
 * « Reconnecting… » qui n'affichait jamais « Sign in ».
 *
 * La règle est donc : on ne réessaie que si `error` est renseignée ou si le
 * navigateur est hors-ligne. Jamais sur l'absence de session seule.
 *
 * Stratégie de reprise :
 *   - hors-ligne : aucune requête, on attend l'événement `online` du
 *     navigateur (marteler un réseau coupé ne sert à rien) ;
 *   - en ligne mais en échec : `refetch` avec un délai qui double à chaque
 *     essai (1 s, 2 s, 4 s… plafonné à 30 s), sans jamais abandonner.
 */
export function useResilientSession() {
  const { data: session, isPending, error, refetch } = useSession();
  const isOffline = useSyncExternalStore(
    subscribeOnline,
    getOfflineSnapshot,
    getOfflineServerSnapshot,
  );

  // `refetch` peut changer d'identité d'un rendu à l'autre : on la garde dans
  // une ref pour ne pas relancer le minuteur de reconnexion à chaque rendu.
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  // Une panne, c'est une requête qui a ÉCHOUÉ ou un réseau coupé — jamais
  // une réponse réussie qui dit « pas de session ».
  const hasFailed = Boolean(error) || isOffline;

  // Le compteur d'essais est une REF : le faire évoluer ne doit pas, à soi
  // seul, provoquer un rendu. Le `retryTick` à côté est un état, mais il
  // n'est incrémenté que depuis le callback du minuteur — jamais dans le
  // corps d'un effet, ce qui éviterait des rendus en cascade.
  //
  // Les deux sont nécessaires : la ref porte le délai, le tick garantit que
  // l'effet est bien replanifié après chaque tentative, y compris si
  // better-auth sert une réponse en cache sans repasser par `isPending`.
  const attempts = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (!hasFailed) {
      // Mutation de ref : aucun rendu déclenché, donc pas de cascade.
      attempts.current = 0;
      return;
    }
    // Hors-ligne : l'événement `online` relancera cet effet. Rien à planifier.
    if (isOffline) return;

    const delay = Math.min(
      FIRST_RETRY_MS * 2 ** attempts.current,
      MAX_RETRY_MS,
    );
    const timer = window.setTimeout(() => {
      attempts.current += 1;
      void Promise.resolve(refetchRef.current()).catch(() => {
        /* le tick ci-dessous replanifie un nouvel essai */
      });
      setRetryTick((value) => value + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [hasFailed, isOffline, retryTick]);

  return {
    session,
    error,
    isOffline,
    /** Une panne est en cours et on réessaie. Jamais vrai pour un anonyme. */
    isReconnecting: hasFailed,
    /** Tout premier aller-retour, avant toute réponse. */
    isLoadingSession: isPending && !session && !hasFailed,
  };
}
