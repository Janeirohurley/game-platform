# Voix temps réel (WebRTC) — architecture

Communication vocale entre participants d'une room, pour **tous les jeux**
(infrastructure générique du système de rooms, pas une fonctionnalité Ludo).

## Architecture

```
Next.js ──Colyseus SDK──► Colyseus server (server-games)
                             │  rooms/matchs, joueurs, spectateurs,
                             │  permissions, reconnexion
                             │  + signalisation WebRTC (plugin officiel)
                             ▼
                        WebRTC (P2P) ── audio micro ◄──► audio micro
```

- **Transport audio** : WebRTC pair-à-pair. L'audio ne transite **jamais**
  par le serveur.
- **Signalisation** : le plugin officiel `colyseus/plugins/webrtc` (serveur,
  activé une fois sur `BaseGameRoom`, donc hérité par Ludo, Checkers et
  Rally) relaie SDP/ICE via la room. Côté client, le paquet officiel
  `@colyseus/webrtc/client` (`WebRTCClient`) encapsule l'échange.
- **Messages de signalisation** : `webrtc:join`, `webrtc:peers`,
  `webrtc:peer-joined`, `webrtc:offer`, `webrtc:answer`,
  `webrtc:ice-candidate`, `webrtc:peer-left`.

## Rôles et permissions

Le serveur est la source de vérité (roles lus dans le snapshot de la room,
jamais revendiqués par le client) :

| Rôle | Peut parler | Peut écouter | Micro demandé |
|---|---|---|---|
| Joueur (assis) | oui | oui | oui, au clic uniquement |
| Spectateur | non | oui | **jamais** (transceivers `recvonly`) |
| Invité anonyme | non | oui | **jamais** |

- `voice:mute { muted }` : message logique validé côté serveur — seuls les
  joueurs assis peuvent le définir (voir `handleVoiceMute` dans
  `BaseGameRoom`). Les joueurs synchronisent ce champ dans le schema
  (`player.voiceMuted`) pour les listes de participants.
- Le mute **réel** est double : la piste audio locale est désactivée
  (`track.enabled = false` — plus aucun octet ne part) **et** le serveur est
  informé.

## Microphone

- Demande via `navigator.mediaDevices.getUserMedia({ audio: true })`,
  **uniquement au clic** sur « Activer le micro » (jamais au chargement).
- Les spectateurs et invités ne déclenchent **aucun** getUserMedia : ils
  rejoignent la même mesh avec des transceivers `recvonly`
  (`ListenOnlyPeer` dans `use-room-voice.ts`).
- États gérés : permission refusée (`denied`), micro absent/indisponible
  (`unavailable`), erreur générique (`error`) — aucun crash React, la
  partie continue sans voix.

## Reconnexion

- L'identité reste celle de Colyseus (`sessionId`/`userId` du système de
  rooms existant, aucune identité parallèle).
- Un joueur déconnecté garde son siège 30 s (grâce `onDrop`/`onReconnect`
  existante). À la reconnexion, il repart avec une **nouvelle** `sessionId`
  → nouvelle identité WebRTC. Les pairs détectent l'ancienne via
  `webrtc:peer-left` (déclenché par le plugin) et négocient avec la
  nouvelle automatiquement.
- Le hook fait un nettoyage complet au `leave`/unmount : pistes arrêtées,
  PeerConnections fermées, listeners détachés, éléments `<audio>` retirés
  (sections 13/14 de la spec).

## STUN / TURN

Configuration ICE dans `use-room-voice.ts` (option `iceServers`, sinon
défaut Google STUN côté client officiel) :

```ts
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  // TURN (quand nécessaire) :
  // {
  //   urls: "turn:turn.exemple.com:3478?transport=udp",
  //   username: process.env.NEXT_PUBLIC_TURN_USERNAME,
  //   credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL, // ⚠ public
  // },
];
```

⚠ **TURN** : les credentials passent forcément côté client (le navigateur
doit s'authentifier). Utilise des **credentials éphémères** (HMAC signé
serveur, style Coturn REST) plutôt qu'un secret statique — à mettre en
place si des joueurs derrière NAT strict ne se connectent pas. STUN seul ne
couvre pas tous les réseaux (symétrique/UDP bloqué).

## Lancer en développement

Terminal 1 (serveur Colyseus) :
```bash
cd server-games
npm start          # tsx watch src/index.ts → ws://localhost:2567
```

Terminal 2 (Next.js) :
```bash
cd game-platform
npm run dev        # next dev --experimental-https → https://localhost:3000
```

Le HTTPS est **requis** par le navigateur pour `getUserMedia` — la config
expérimentale existante du projet couvre ce besoin (micro indisponible sur
`http://localhost` sauf exemption `localhost` pour Chrome, à vérifier).

## Tester deux joueurs localement

1. Ouvrir deux navigateurs (ou un onglet normal + un onglet privé) sur
   `https://localhost:3000/games/ludo/play` — comptes différents.
2. Le compte A crée une table ; le compte B demande à jouer ; A accepte.
3. Chacun clique « Activer le micro » → accepter la permission.
4. Vérifier : pastille d'activité quand l'autre parle, bouton passe
   « Micro actif », mute désactive réellement le son chez l'autre.
5. Spectateur : ouvrir un 3ᵉ onglet en anonyme → « Regarder » → il voit
   le badge « Écoute seule » et entend sans jamais déclencher de demande
   de permission micro.

## Cas limites à connaître

- **Autoplay** : les éléments `<audio>` distants démarrent via le geste
  utilisateur du clic micro. Si un navigateur refuse malgré tout, la
  pastille d'activité reste fonctionnelle.
- **Chrome/Safari même machine** : plusieurs onglets partageant le même
  micro fonctionnent, mais l'écho local peut apparaître (pas de
  suppression d'écho inter-onglets). Tester avec un casque.
- **Limite mesh** : P2P maillé = O(n) connexions par client. Dimensionné
  pour 2–6 joueurs ; passer à un SFU (LiveKit, mediasoup) si besoin de
  rooms plus larges.
