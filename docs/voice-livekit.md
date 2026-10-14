# Voix et vidéo temps réel — architecture (LiveKit)

Communication vocale (et vidéo) entre participants d'une room, pour **tous
les jeux** — infrastructure générique du système de rooms, pas une
fonctionnalité Ludo.

> ⚠ **Ce document remplace l'ancien `docs/voice-webrtc.md`**, supprimé : il
> décrivait une architecture WebRTC P2P via le plugin Colyseus
> (`use-room-voice.ts`) qui **n'existe plus**. Le transport média est
> aujourd'hui **LiveKit** (un SFU), branché par
> `src/lib/livekit/*` et consommé par `useLiveKitVoice`
> (`src/lib/realtime/use-livekit-voice.ts`).

## Architecture

```
Navigateur                            Next.js (Vercel)              LiveKit (SFU)
     │                                       │                          │
     │  1. POST /api/livekit/token?roomId=…  │                          │
     │──────────────────────────────────────►│                          │
     │                                       │ 2. verifyRoomMembership  │
     │                                       │    GET /api/room-membership/:roomId
     │                                       │    (serveur-à-serveur,    │
     │                                       │     en-tête secret)       │
     │                                       │──────────────► Colyseus (Render)
     │                                       │                          │
     │  3. { token, url, room }              │                          │
     │◄──────────────────────────────────────┤                          │
     │                                                               │
     │  4. connexion WebSocket média (wss://) ────────────────────────►│
     │◄══════════ audio + vidéo ══════════════════════════════════════►│
     │                                                               │
     │  5. état de jeu (Colyseus)                                    │
     │═══════════════════════════════════════════════════════════════►│ Colyseus
```

**Deux transports, deux propriétaires, aucune confusion :**

|                      | Colyseus (`server-games`)   | LiveKit                            |
| -------------------- | --------------------------- | ---------------------------------- |
| transporte           | état de jeu, matchmaking    | **média uniquement** (audio/vidéo) |
| Qui décide qui parle | la room (rôles du snapshot) | les grants du token                |
| Dépend de l'autre    | non                         | non                                |

Une panne LiveKit dégrade la voix/vidéo **et rien d'autre** : le plateau
continue de tourner, car `src/lib/livekit/*` n'est jamais importé par le
chemin d'état de jeu. Les deux ne se rejoignent que par un **nom de room
dérivé** — aucun second système d'identifiants de room.

## Le nom de room dérivé

`livekitRoomName(gameRoomId)` (`src/lib/livekit/config.ts`) transforme l'id
Colyseus en nom de room LiveKit : `game-room-<id>`.

- Le motif d'id accepté est `^[A-Za-z0-9]{1,64}$` — volontairement
  strict : la valeur atteint un nom de room LiveKit, donc tout ce qui
  n'est pas un id opaque est **rejeté**, jamais assaini.
- Le nom dérivé est revalidé contre la grammaire LiveKit
  (`[a-zA-Z0-9-_=,.@]{1,128}`) : une défense en profondeur, sinon le
  join échoue côté serveur avec un message qui ne dit rien de la cause.
- La fonction **throw** sur un id invalide au lieu de le forcer : un id
  forcé pourrait entrer en collision avec une vraie room, ce qui est
  précisément la fuite inter-room que la route refuse.

## Qui peut obtenir un token

`GET /api/livekit/token?roomId=<id>`

| Cas                                 | Session                 | Vérification d'appartenance                      | Grants                                               |
| ----------------------------------- | ----------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Joueur connecté                     | **requise** (401 sinon) | **oui**, serveur-à-serveur contre la room réelle | `roomJoin` + publish + subscribe + data              |
| Spectateur connecté                 | requise                 | oui, rôle `spectator` renvoyé par le serveur     | `roomJoin` + subscribe **seulement**                 |
| Invité anonyme (`&scope=spectator`) | **aucune**              | **non** — le room id est le credential           | `roomJoin` + subscribe **seulement**                 |
| Identité                            | —                       | —                                                | dérivée de l'user id (`user-<id>`) ou `guest-<uuid>` |

L'ordre de la route est : **configuration** (fail closed 500) →
**validation du `roomId`** (400) → **cas invité** (200) →
**authentification** (401) → **autorisation** (503 ou 403) → **jeton**.

Le token ne porte **que** `roomJoin` sur cette room. Personne n'obtient
`roomCreate`, `roomList`, `roomRecord`, `roomAdmin`, `hidden`,
`recorder` ni `agent` — voir `grantsForRole`
(`src/lib/livekit/grants.ts`), module **pur** et donc testable sans
LiveKit ni base de données.

`LIVEKIT_API_SECRET` ne quitte jamais le processus : lu par
`readLiveKitServerCredentials()` (module serveur, jamais de
`NEXT_PUBLIC_*`), utilisé pour signer, jamais renvoyé.

TTL du token : **10 minutes** (`LIVEKIT_TOKEN_TTL_SECONDS`). Court par
choix — un token est émis juste avant la connexion ; assez long pour
survivre à un rafraîchissement de page en plein match.

## Rôles et permissions médias

| Rôle           | Micro / vidéo | Écoute | Données | Déclenche `getUserMedia`    |
| -------------- | ------------- | ------ | ------- | --------------------------- |
| Joueur (assis) | oui           | oui    | oui     | **oui, au clic uniquement** |
| Spectateur     | **non**       | oui    | non     | **jamais**                  |
| Invité anonyme | **non**       | oui    | non     | **jamais**                  |

L'interdiction de publier est portée par le **token** (`canPublish: false`),
pas seulement par l'UI : un spectateur ne peut pas microstructure, même
en forgeant une requête.

## La vérification d'appartenance — le point sensible

`verifyRoomMembership(roomId, userId)`
(`src/lib/livekit/room-membership.ts`) est l'étape d'**autorisation**.
L'authentification seule ne donne accès à rien : c'est ce qui empêche un
client de changer le `roomId` de sa requête pour atteindre le canal média
d'un autre match.

- **Source de vérité** : le serveur Colyseus, pas la base du plateforme.
  Une room est un état vivant ; qui est assis et qui regarde n'existe
  que dedans. Un seul `GET /api/room-membership/:roomId?userId=…`, sur
  les métadonnées que `refreshMetadata` publient déjà à chaque changement
  de rôle — aucune table nouvelle.
- **En-tête secret** `x-realtime-token-secret`, valeur partagée avec
  `server-games`. Sans lui l'endpoint répond 403 ; le secret est donc
  aussi un garde-fou contre l'énumération des rooms.
- **Réponse volontairement binaire** : room inconnue et utilisateur
  absent répondent tous deux `{ member: false }` — impossible de sonder
  une room privée.
- **Budget 3 s** (`MEMBERSHIP_TIMEOUT_MS`) : ce contrôle est dans une
  requête utilisateur, un serveur lent ne doit pas retenir le join
  média. Ouvrir le contrôle est hors de question, on déclare donc
  « indisponible ».
- Module `server-only` : il touche une credential par le réseau, il ne
  doit jamais finir dans un bundle client.

⚠ **Conséquence de déploiement** : cette vérification est le **seul** point
du chemin vocal qui fait un appel HTTP serveur-à-serveur. Ni LiveKit, ni
`/api/realtime/token` (qui signe un JWT localement) ne contactent le
serveur de jeux. Si le jeu marche en production et que la voix renvoie
503, le problème est là, et seulement là.

## Variables d'environnement

| Variable                                     | Lu par                               | Rôle                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`     | `src/lib/livekit/config.ts`          | Signature des tokens. **Serveur seul.**                                                                                                                                                                                                                               |
| `NEXT_PUBLIC_LIVEKIT_URL`                    | `src/lib/livekit/config.ts`          | `wss://` du serveur média. **Public par nature** (c'est une adresse, pas une credential) — et **jamais** un nom d'hôte Docker interne (`ws://livekit:7880`), qui ne résout que dans le réseau compose.                                                                |
| `REALTIME_SERVER_URL`                        | `src/lib/livekit/room-membership.ts` | Adresse **serveur-à-serveur** du serveur Colyseus. Volontairement distincte de `NEXT_PUBLIC_REALTIME_URL` : le navigateur et le plateforme nomment le même serveur différemment (LAN en local, public en prod). **Obligatoire en production**, sinon le module throw. |
| `REALTIME_TOKEN_SECRET`                      | idem                                 | Secret partagé avec `server-games`. **16 caractères minimum.**                                                                                                                                                                                                        |
| `WALLET_DEFAULT_CURRENCY`, `DATABASE_URL`, … | —                                    | sans rapport avec la voix.                                                                                                                                                                                                                                            |

`.env.exemple` ne contient **aucune** de ces variables voix : elles
doivent être ajoutées à la main.

## Diagnostic — `503 "Vérification de la room impossible — réessaie."`

Ce 503 est le symptôme générique de « la vérification n'a pas pu être
faite ». Chaque cause est désormais journalisée **côté serveur** avec sa
`cause` et son `detail` — jamais renvoyée au client.

| `cause` journalisée | Signification                                                           | Correctif                                           |
| ------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| `secret_missing`    | `REALTIME_TOKEN_SECRET` absent ou < 16 car.                             | Renseigner la variable                              |
| `url_missing`       | `REALTIME_SERVER_URL` absent en production                              | Renseigner la variable                              |
| `network`           | requête jamais aboutie : DNS, connexion refusée, TLS, IP privée bloquée | **pointer vers l'adresse publique**                 |
| `timeout`           | pas de réponse en 3 s                                                   | instance trop lente / trop loin                     |
| `http_status`       | le serveur a répondu non-2xx                                            | `403` ⇒ **secret divergent** entre Vercel et Render |
| `invalid_payload`   | 2xx mais corps inattendu (page d'erreur de proxy)                       | vérifier le TLS / le reverse proxy                  |

Le `detail` contient l'**origine résolue** (`origin=`), le statut HTTP et
la durée. C'est exactement ce qu'il faut lire pour diagnosing un
déploiement hébergé : le cas le plus fréquent est une plateforme qui
pointe encore sur une **adresse LAN** qu'elle ne peut pas joindre.

Pour un état lisible sans code, la console admin interroge le même
serveur avec le même secret et affiche un message : `/admin/rooms`
(aussi `src/lib/admin/realtime-rooms.ts`).

## Reconnexion — deux plans à ne pas confondre

|                         | Reconnexion **état de jeu** (Colyseus)                              | Reconnexion **média** (LiveKit) |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------- |
| Qui la gère             | `colyseus.js` (backoff exponentiel, 15 tentatives) + `server-games` | le SDK LiveKit                  |
| Ce qui la rend possible | la room existe **encore** côté serveur                              | un nouveau token valide         |
| Fenêtre                 | `RECONNECTION_GRACE_SECONDS = 30` dans `server-games`               | TTL du token = 10 min           |

`base-game-room.ts` appelle `allowReconnection(client, 30)` : une reconnexion
n'est possible que **pendant la fenêtre de grâce**, et seulement si la
room existe toujours. Passé 30 s, le siège est libellé puis **REAPÉ**.

⚠ **Sur un hébergeur à instance éphémère (offre gratuite type Render),
la reconnexion ne peut jamais aboutir** : l'instance est recyclée après
inactivité, et tout l'état en mémoire (matchmaker, rooms, sièges tenus)
disparaît. Le `roomId` et le `sessionId` que le navigateur conserve
désignent alors une room qui n'existe plus, et les 15 tentatives
échouent toutes. Les logs côté navigateur montrent alors une boucle
`[Colyseus reconnection] … attempt N of 15` sans fin, **et** une coupure
initiale `The connection to wss://… was interrupted while the page was
loading` — c'est le redémarrage de l'instance, pas « un réseau lent ».

La voix, elle, est **indépendante** : elle survit à la perte du canal de
jeu tant que le token media est valide.

## Lancer en développement

Terminal 1 (serveur Colyseus) :

```bash
cd server-games
npm start          # tsx watch src/index.ts → ws://localhost:2567
```

Terminal 2 (Next.js) :

```bash
cd game-platform
npm run dev        # → https://localhost:3000
```

Le HTTPS est **requis** par le navigateur pour `getUserMedia` — la config
expérimentale HTTPS du projet couvre ce besoin.

En local, les deux variables pointent vers la même machine mais restent
deux variables distinctes :

```ts
// .env — navigateur
NEXT_PUBLIC_REALTIME_URL=http://10.83.223.127:2567
// .env — plateforme (serveur-à-serveur)
REALTIME_SERVER_URL=http://10.83.223.127:2567
```

## Tester deux joueurs localement

1. Ouvrir deux navigateurs (ou un onglet normal + un onglet privé) sur
   `https://localhost:3000/games/ludo/play` — comptes différents.
2. Le compte A crée une table ; le compte B demande à jouer ; A accepte.
3. Chacun clique « Activer le micro » → accepter la permission.
4. Vérifier : la pastille d'activité s'allume quand l'autre parle, le
   bouton passe « Micro actif », le mute coupe réellement le son chez
   l'autre.
5. Spectateur : ouvrir un 3ᵉ onglet en anonyme → « Regarder » → il voit
   le badge « Écoute seule » et entend **sans jamais** déclencher de
   demande de permission micro.
6. Vérifier les logs `[livekit-membership] …` en cas de 503 (voir le
   tableau de diagnostic).

## Cas limites à connaître

- **Autoplay** : les éléments `<audio>` distants démarrent via le geste
  utilisateur du clic micro. Si un navigateur refuse, la pastille
  d'activité reste fonctionnelle.
- **Chrome/Safari même machine** : plusieurs onglets partagent le même
  micro, l'écho local peut apparaître (pas de suppression d'écho
  inter-onglets). Tester avec un casque.
- **Deux joueurs, trois screens** : le mesh LiveKit est dimensionné pour
  quelques participants ; bien que le SFU gère le fan-out, les salons
  très larges restent à surveiller.
- **Route et serveur média font deux allers-retours** avant le premier
  octet d'audio : `/api/livekit/token` puis l'ouverture du WebSocket
  média. Un 503 sur le premier se voit immédiatement, une latence sur le
  second non.
- **`NEXT_PUBLIC_LIVEKIT_URL` doit être le `wss://` public**, jamais
  l'adresse interne du conteneur.
- **`REALTIME_SERVER_URL` n'est pas un `wss://`** : c'est une
  adresse HTTP(S) d'API, pas un WebSocket.

---

_Document maintenu avec le code : toute modification des grants, de la
route de token ou de la vérification d'appartenance met à jour les
sections concernées._
