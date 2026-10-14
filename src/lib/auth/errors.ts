/**
 * French, user-facing messages for the auth errors we actually expect.
 *
 * Two hard rules:
 *  - never surface a raw Better Auth message (it can leak internals);
 *  - never reveal in the INITIAL magic-link response whether the address
 *    matches an existing account. That is why `sendMagicLink` is only
 *    ever described in generic terms here, and the request itself always
 *    resolves to the same confirmation screen.
 */

/** Better Auth error codes → French copy. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN:
    "Ce lien de connexion est invalide ou a déjà été utilisé. Demande-en un nouveau.",
  EXPIRED_TOKEN: "Ce lien de connexion a expiré. Demande-en un nouveau.",
  new_user_signup_disabled:
    "La création de compte par lien est désactivée. Contacte le support.",
  failed_to_create_user:
    "Impossible de créer ton compte pour le moment. Réessaie plus tard.",
  failed_to_create_session:
    "Connexion impossible pour le moment. Réessaie plus tard.",
  user_not_found: "Connexion impossible pour le moment. Réessaie plus tard.",
  EMAIL_NOT_VERIFIED:
    "Vérifie ton adresse e-mail pour continuer.",
  USER_BANNED: "Ce compte est suspendu.",
};

/** Substrings in a raw message → French copy (fallback layer). */
const MESSAGE_HINTS: Array<{ match: RegExp; message: string }> = [
  {
    match: /expired/i,
    message: "Ce lien de connexion a expiré. Demande-en un nouveau.",
  },
  {
    match: /invalid|token/i,
    message:
      "Ce lien de connexion est invalide ou a déjà été utilisé. Demande-en un nouveau.",
  },
  {
    match: /too many|rate limit|429/i,
    message: "Trop de tentatives. Patiente une minute puis réessaie.",
  },
  {
    match: /email|smtp|send/i,
    message:
      "Impossible d'envoyer l'e-mail pour le moment. Réessaie dans un instant.",
  },
];

export const GENERIC_AUTH_ERROR_MESSAGE =
  "Une erreur est survenue. Réessaie dans un instant.";

export interface AuthErrorLike {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

/** Turn any auth error shape into safe, French copy. */
export function describeAuthError(error: unknown): string {
  if (!error) {
    return GENERIC_AUTH_ERROR_MESSAGE;
  }

  const shaped = error as AuthErrorLike;
  const code = typeof shaped.code === "string" ? shaped.code : null;

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (shaped.status === 429) {
    return "Trop de tentatives. Patiente une minute puis réessaie.";
  }

  const message = typeof shaped.message === "string" ? shaped.message : "";

  for (const hint of MESSAGE_HINTS) {
    if (hint.match.test(message)) {
      return hint.message;
    }
  }

  return GENERIC_AUTH_ERROR_MESSAGE;
}
