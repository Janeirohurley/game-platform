# Mises en jeu sur le portefeuille — architecture & intégration

> Statut : **proposition à valider**. Ce document décrit comment relier le
> portefeuille existant (`docs/wallet.md`) aux parties, de façon que gagnant,
> perdant, quittant et égalité produisent des mouvements comptables corrects.
> Il ne décrit aucun changement déjà fait : c'est un plan.

## 1. Objet & périmètre

Permettre de jouer « avec une mise » :

- deux joueurs (ou N) posent chacun une mise avant le départ (`stake`) ;
- la somme des mises forme le **pot**, gardé en séquestre (`escrow`) ;
- à la fin, un règlement unique et atomique :
  - **gagnant** : encaisse le pot moins la commission plateforme (`rake`) ;
  - **perdant** : perd sa mise (déjà prélevée) ;
  - **quittant / abandon** : sa mise va à l'adversaire (forfait) ou est
    remboursée selon la règle du jeu ;
  - **égalité (draw)** : chaque mise est remboursée à son propriétaire ;
- si la partie n'a pas lieu (jamais lancée, annulée en salon), les mises sont
  **remboursées** (séquestre vidé).

Hors périmètre : dépôts/retraits (déjà couverts par `docs/wallet.md`),
tournois à plusieurs tours, cotes/cotes dynamiques.

## 2. État des lieux (ce qui existe déjà, à réutiliser)

| Brique | Fichier | Rôle |
| --- | --- | --- |
| Portefeuilles | `src/lib/db/schema/wallet.ts` (`wallets`) | une ligne par `(user, currency)`, solde **dérivé** |
| Transactions | idem (`wallet_transactions`) | `type ∈ deposit/withdrawal/payment/refund/reversal`, `provider` **nullable** |
| Grand livre | idem (`ledger_entries`) | écritures signées, **somme = 0**, append-only |
| Comptes | `src/lib/wallet/ledger.ts` | `wallet`, `external:<id>`, `fees:platform`, `fees:provider` |
| Moteur | `src/lib/wallet/engine.ts` | idempotence, verrous `FOR UPDATE`, machine à états |
| Portefeuille | `src/lib/wallet/wallet.ts` | `ensureWallet`, `assertWalletOperable` |
| Résultat de partie | `server-games/src/rooms/base-game-room.ts` (`finishMatch`) | `state.winnerUserId` → outcome `win/loss/draw` par joueur |
| Reporting signé | `server-games/src/profile/profile-reporting.ts` | HMAC `REALTIME_TOKEN_SECRET` → `/api/profile/match-results` |
| Ingestion | `src/app/api/profile/match-results/route.ts` + `src/lib/profile/queries.ts` | dédup `(roomId, userId)`, écrit stats/XP/rating |
| Vocabulaire interne inutilisé | `docs/wallet.md` §Cas limites | `PAYMENT` et `TRANSFER` déclarés mais jamais utilisés |
| Type `payment` | `src/lib/wallet/constants.ts` | présent dans l'énum, **aucun usage** |

**Conclusion** : le socle comptable est prêt (double entrée, unités mineures,
idempotence, verrous). Il manque **un mouvement interne sans provider** et la
**notion de séquestre de partie**.

## 3. Décisions retenues (validées)

1. **On réutilise le portefeuille existant** — pas de second système d'argent.
   Tout passe par `wallets` / `wallet_transactions` / `ledger_entries` et le
   moteur `src/lib/wallet/engine.ts`.
2. **Une devise dédiée à la mise**, logée dans le portefeuille existant
   (`ensureWallet(userId, "<DEVISE>")`). Au départ ce sera un **jeton
   play-money non retirable** (aucun provider, donc aucun dépôt/retrait
   possible) : la mécanique est validée sans responsabilité réglementaire. Le
   passage à une devise réelle devient un **flag sur l'actif** (« retirable ou
   non »), pas une réécriture.
   - `CURRENCIES` (`src/lib/wallet/currencies.ts`) est une **liste fermée** :
     ouvrir un jeton = **une entrée** (ex. `JET`, `exponent: 0`). Comme
     `defaultWalletCurrency()` reste `BIF`, la devise de mise est toujours
     passée **explicitement** par l'appelant, jamais prise par défaut.
3. **Commission (rake) = 0 % pour commencer** (`rake_bps = 0`). Le champ reste
   présent et configurable par jeu ; le gagnant encaisse tout le pot.
4. **Règlement par jeu** — chaque jeu déclare ses propres règles de partie et
   donc sa politique de règlement (§3.1). Le socle monétaire est commun ; la
   lecture de l'issue (`winnerUserId`) est propre à chaque room.

### 3.1 Politique de règlement, par jeu

L'issue (`win` / `loss` / `draw`) est décidée par le **room du jeu**, jamais
par un client (§8). La platform en déduit le règlement via une petite politique
déclarée par jeu (`SettlementPolicy`), pour gérer ce qui **diffère d'un jeu à
l'autre** :

| Paramètre | Question | Ex. Tetris | Ex. Dames | Ex. Rally | Ex. Ludo |
| --- | --- | --- | --- | --- | --- |
| `tableSize` | combien de sièges | 2+ | 2 | 2 | 2–6 |
| `stakeModel` | mise par joueur ou pot partagé | `per-seat` (winner-takes-all) | `per-seat` | `per-seat` | `per-seat` |
| `allowsDraw` | l'égalité existe-t-elle ? | non | oui | non | non |
| `forfeit` | que devient la mise d'un quittant ? | reversée au(x) restant(s) | idem | idem | idem |
| `multiWinner` | plusieurs gagnants (ex. nulle à deux) | possible | non | non | non |

Décisions par défaut proposées (à confirmer jeu par jeu) :

- **winner-takes-all** : la somme des mises (le pot) va au(x) gagnant(s).
- Si `allowsDraw` et égalité → **remboursement** de chaque mise.
- Si plusieurs gagnants → **partage égal** du pot (`pot / n`, arrondi géré :
  le reliquat éventuel reste au séquestre puis est reversé à `fees:platform`
  ou au premier gagnant — à figer).

> Corollaire technique : la devise de mise doit être **isolée** du cash
> retirable. On ne convertit jamais silencieusement (règle déjà posée par
> `docs/wallet.md` : un wallet n'a qu'une devise).

## 4. Modèle comptable — nouveaux comptes & postings

Le grand livre ne change pas de principe ; on **ajoute des comptes**.

Nouveau compte de séquestre (par partie) :

```
escrow:<roomId>    # passif : argent des joueurs gelé le temps de la partie
```

(Le compte est un simple `text` dans `ledger_entries.account` : **aucune
migration** n'est requise pour les comptes.)

### Postings (construits par des builders purs, comme `depositPosting`)

**Mise (hold)** — un joueur pose S (type `stake`) :

```
wallet:<joueur>   −S
escrow:<roomId>   +S
```

**Règlement gagnant** — pot P, commission R (type `payout`) :

```
escrow:<roomId>   −P
wallet:<gagnant>  +(P − R)
fees:platform     +R
```

**Remboursement** — mise S rendue (égalité, partie non lancée) (type `refund`) :

```
escrow:<roomId>   −S
wallet:<joueur>   +S
```

**Forfait (quittant)** — traité comme un règlement : la mise du quittant part
à l'adversaire (via le pot). Aucun posting spécial : c'est le **règlement**
qui décide qui touche le pot.

Chaque posting reste **équilibré** (`assertBalanced`, somme = 0).

## 5. Nouvelle capacité du moteur — mouvement interne sans provider

Aujourd'hui `createOperation` **exige** un provider (dépôt/retrait). Le chemin
interne est symétrique mais sans rail externe (|implémenté — Phase 0) :

```ts
// src/lib/wallet/engine.ts
export interface InternalMovementInput {
  type: "stake" | "payout" | "refund";
  /** Wallet « ancre » : en-tête de la transaction (walletId est NOT NULL). */
  walletId: string;
  currency: string;
  /** Posting DÉJÀ équilibré (builders §4). */
  posting: Posting;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export async function postInternalMovement(
  input: InternalMovementInput,
): Promise<{ transaction: TransactionRow; duplicate: boolean }>;
```

Règles internes (dans une seule `db.transaction`) :

1. **Équilibre** : `assertBalanced(posting)` **avant** toute écriture.
2. **Idempotence** : `onConflictDoNothing(idempotency_key)` → rejeu = même
   ligne, `duplicate: true`, **aucun second posting**. Une requête *différente*
   sur la même clé → `idempotency_conflict`.
3. **Verrous** : `SELECT … FOR UPDATE` sur les `wallets` impliqués, **triés par
   id** (ordre stable = pas d'interblocage).
4. **Contrôles** : chaque wallet existe, `status = active`, même devise que le
   posting ; **pas de découvert** — aucun wallet, **ni le compte escrow**, ne
   peut être tiré sous zéro (vérifié sous verrou).
5. **Écriture** : une ligne `wallet_transactions` (`provider = null`,
   `status = 'succeeded'` immédiat, frais à 0), puis `postLedger`.
   `grossAmount = netAmount = |mouvement du wallet ancre|` (le montant vu par
   ce wallet) ; pot/rake/roomId vont dans `metadata`.
6. Aucun appel réseau : pas de `expiresAt`, pas de `expectedRailAmount`.

`WALLET_TRANSACTION_TYPES` est étendu avec `stake` et `payout` (migration
`0013` **appliquée**). Les builders `stakePosting` / `payoutPosting` /
`stakeRefundPosting` (§4) refusent tout posting déséquilibré et tout pot qui
ne se referme pas exactement.

## 6. Modèle de données — la partie à mise

Deux tables nouvelles (drizzle + migration) :

```
match_stakes                       # une ligne par partie à enjeu
  id              text pk
  room_id         text unique      # lien avec Colyseus + dédup règlement
  game_id         text             # validé registre
  currency        text             # 3 car. (ex. "JET" ou "BIF")
  stake_minor     bigint           # mise par joueur
  rake_bps        int              # commission en points de base (0..10000)
  status          text             # open|funded|playing|settled|void
  winner_user_id  text null        # null = égalité
  pot_minor       bigint           # Σ mises au moment du gel
  created_at / started_at / settled_at

match_stake_holds                  # une ligne par siège
  match_stake_id  text  → match_stakes(cascade)
  user_id         text  → user(cascade)
  amount_minor    bigint           # S
  transaction_id  text  → wallet_transactions   # la retenue (stake)
  status          text             # held|released|forfeited|paid
  pk (match_stake_id, user_id)
```

Index : `match_stakes(room_id)` unique ; `match_stake_holds(user_id,status)`.
CHECK sur `status` (vocabulaire construit depuis des constantes TS, comme
`money`/`profiles`).

## 7. Cycle de vie d'une partie à mise

```
        (1) create                 (2) fund                 (3) play
  Room ───────────► match_stakes ────────► holds HELD ────────► status=playing
  (+mise)           OPEN          chaque joueur              (tous les sièges
                                   POST /hold                 financés)
                                                                   │
                       (5) void / annulé              (4) finishMatch
                       refund tous les holds          gagnant / perdant /
                       ◄── status=void                quittant / draw
                                                                    │
                                                                    ▼
                                          settle (1 transaction) : status=settled
                                  pot → gagnant(−rake) ; rake → fees:platform
                                  ou refund (draw / jamais parti)
```

Détail des issues (outcome dérivé du room, `winnerUserId`) :

| Issue | `winnerUserId` | Postings |
| --- | --- | --- |
| Gagnant / perdant | = gagnant | pot − rake → gagnant ; rake → `fees:platform` |
| Égalité (draw) | vide | chaque mise → son joueur (`refund`) |
| Quittant (forfait) | = restant | comme gagnant/perdant (le forfait est déjà dans `winnerUserId`) |
| Partie annulée avant départ | — | tous les holds → `refund`, statut `void` |

**Point clé** : le forfait est déjà transformé en `win/loss` par
`BaseGameRoom.reportMatchOutcome()` (règles de partie au serveur). Le règlement
n'a donc **pas** de cas spécial « quittant » : il suit le gagnant. Ce qui doit
être ajouté côté room, c'est de **rembourser** une mise quand un joueur quitte
**le salon avant le départ** (pas un forfait de partie).

## 8. Points d'intégration

### 8.1 Platform (autorité de l'argent)

- **Création** : `POST /api/internal/match-stakes` (HMAC) appelé par le room
  quand l'hôte fixe la mise → crée `match_stakes` (OPEN).
- **Retenue** (consentement + fonds) : `POST /api/wallet/games/hold`
  (session utilisateur) `{ roomId, amountMinor, currency, idempotencyKey }`
  → `postInternalMovement(stake)` → hold HELD.
- **Remboursement salon** : `POST /api/wallet/games/:roomId/cancel` → refund.
- **Règlement** : **réutiliser le funnel existant**. La route
  `/api/profile/match-results` (déjà signée, dédup `(roomId,userId)`) appelle,
  après l'ingestion profil, `settleStakes(roomId, outcomes)` :
  - `SELECT … FOR UPDATE` sur `match_stakes` ;
  - si `status = settled|void` → no-op (idempotent) ;
  - sinon, dans **la même transaction** : postings du §4, statut `settled`,
    `winner_user_id`, `settled_at`.

  Un seul point d'entrée alimente **profils + argent** : cohérent et dédupliqué.

### 8.2 server-games (autorité du jeu)

- `GameDefinition` / `LobbySettingsInput` : ajouter `stakeMinor?`, `currency?`,
  `rakeBps?`.
- `BaseGameRoom` :
  - état `stake` dans le snapshot lobby (montant, devise) ;
  - **garde de démarrage** : `startMatch` refusé tant que tous les sièges ne
    sont pas financés (le room lit l'état via un `GET` interne signé, ou les
    clients remontent `stake:ready` après le hold, le room confirme via HMAC) ;
  - `onLeave` **en salon** (avant PLAYING) → `cancel hold` du partant ;
  - `finishMatch` → le reporting existant déclenche le règlement (aucun code
    argent dans le room).
- Nouveau `src/match-stakes/match-stakes-client.ts` (calqué sur
  `profile-reporting.ts` : HMAC `REALTIME_TOKEN_SECRET`, retries bornés,
  fire-and-forget).

## 9. Idempotence & concurrence

- Clés : `match:<roomId>:hold:<userId>` (retenue), le règlement est gardé par
  l'**état** `match_stakes` sous `FOR UPDATE` (une seule transition
  `funded|playing → settled`).
- Toutes les écritures monétaires dans **une** transaction : tout ou rien.
- Rejeu d'un webhook/rapport : dédup `(roomId, userId)` (profil) + état
  `settled` (argent) → **aucun double paiement**.

## 10. Cas limites

1. **Un seul siège financé** et départ qui n'arrive jamais → TTL → `void` +
   remboursements.
2. **Joueur déconnecté en partie** : grâce de reconnexion (30 s déjà en place)
   puis forfait → `finishMatch` → règlement normal.
3. **Room fermé par l'admin avant PLAYING** → `void` + remboursements.
4. **Platform indisponible à la fin** : retries (3) ; filet = **balayeur de
   réconciliation** qui règle les `match_stakes` bloqués (`playing` avec
   un `settled_at` attendu dépassé) à partir des `game_matches` déjà ingérés.
5. **Partie nulle unanime** vs annulée : `draw` (remboursement) ≠ `void`
   (remboursement) — mêmes postings, statuts distincts pour l'audit.
6. **Fonds insuffisants à la retenue** → `insufficient_funds` (code existant) ;
   le siège n'est pas marqué financé, la partie ne démarre pas.
7. **Devises différentes entre joueurs** → refusé : une partie = une devise
   (le wallet ne convertit jamais).

## 11. Anti-abus & équité

- **Pré-financement obligatoire** : aucune mise à crédit.
- **Une connexion par utilisateur** par room (déjà en place) → pas d'auto-jeu.
- **L'issue vient du serveur** (`winnerUserId`), jamais d'un client.
- Min/max de mise, plafonds journaliers (jeu responsable), et pour l'argent
  réel : détection de collusion (mêmes IP/appareil, comptes liés).
- `rake` configurable par jeu (0 par défaut en jetons).

## 12. Conformité (argent réel uniquement — à documenter avant activation)

Licence d'exploitation, KYC/AML, 18+, géo-blocage, limites de dépôt/perte +
auto-exclusion, fonds clients ségrégués, CGU/CGV dédiées, classification
légale par jeu, reporting régulateur. **À traiter comme un projet séparé.**

## 13. Surface API (récapitulatif)

| Méthode | Route | Auth | Rôle |
| --- | --- | --- | --- |
| POST | `/api/internal/match-stakes` | HMAC | room → crée la mise |
| GET | `/api/wallet/games/:roomId` | session | mon état de mise |
| POST | `/api/wallet/games/hold` | session | je pose ma mise |
| POST | `/api/wallet/games/:roomId/cancel` | session | je récupère ma mise (salon) |
| POST | `/api/profile/match-results` | HMAC | **existant** → +`settleStakes` |
| POST | `/api/internal/match-stakes/:roomId/void` | HMAC | annulation → remboursements |

## 14. UI / UX (indicatif)

- **Salon** : sélecteur de mise (hôte), badge *financé / fonds insuffisants*
  par siège, bouton *Démarrer* désactivé tant que tous ne sont pas financés,
  affichage du **pot**.
- **Portefeuille** (`src/app/(protected)/wallet`) : section « parties » —
  retenues en cours, historique gagné/perdu/remboursé (filtre `type`).
- **HUD partie** : pot à l'écran.

> **Vigilance signe — ✅ corrigé** : `signedMoney`
> (`src/components/wallet/wallet-shared.tsx`) ne créditait que `deposit`. Or
> `payout` et un remboursement de mise **créditent**, tandis qu'un `refund` de
> **dépôt** débite : le signe ne se déduit donc pas du seul `type`.
> Désormais le signe est lu depuis le **grand livre** : la liste des
> transactions expose `walletDeltaMinor` (somme des écritures du wallet pour la
> transaction, sous-requête dans `queries.ts`), et le détail le recalcule depuis
> ses écritures. Le type ne sert plus que de repli pour les anciennes lignes.
> Test unitaire : `src/components/wallet/wallet-shared.test.tsx`.
> Étiquettes `stake`/`payout` ajoutées à `typeLabel`.

## 15. Plan par phases

- **Phase 0** — moteur : `postInternalMovement`, builders de postings,
  extension des types + migration, tests unitaires (équilibre, idempotence,
  découvert interdit). **✅ Fait** : `JET` (`currencies.ts`), builders
  `stakePosting`/`payoutPosting`/`stakeRefundPosting` (`ledger.ts` + tests
  purs), `postInternalMovement` (`engine.ts` + `internal-movement-db.test.ts`),
  types `stake`/`payout` + migration `0013` appliquée.
- **Phase 1** — modèle `match_stakes`/holds + routes hold/cancel/void +
  `settleStakes` branché sur `match-results`. Tests d'intégration (dédup,
  gagnant/perdant/draw/forfait/void). **✅ Fait** : schéma
  `match_stakes`/`match_stake_holds` + migration `0014` appliquée ; service
  `src/lib/wallet/match-stakes.ts` (`createMatchStake`, `holdStake`,
  `cancelHold`, `voidStakes`, `settleStakes`, `getStakeStateForUser`) ;
  routes `/api/internal/match-stakes` + `/:roomId/void` (HMAC via
  `src/lib/realtime/request-signature.ts`, partagé avec `match-results`/bots),
  `/api/wallet/games/hold`, `/api/wallet/games/:roomId` (GET), `/:roomId/cancel`
  (session) ; `settleStakes` branché dans `/api/profile/match-results` ;
  tests d'intégration `src/lib/wallet/__tests__/match-stakes.test.ts` (6).
  **✅ Fait (durcissement)** : `settleStakes`/`voidStakes`/`cancelHold` tournent
  en **une seule transaction** avec `SELECT … FOR UPDATE` sur `match_stakes`
  (`postInternalMovementInTx` exporté par `engine.ts`).
- **Phase 2** — intégration room sur **un** jeu pilote, choisi selon ses règles
  (partie, issue, forfait/égalité) : mise en salon, garde de financement,
  remboursement au départ. On figera sa `SettlementPolicy` (§3.1) en même temps.
- **Phase 3** — les autres jeux, **un par un selon leurs règles**, + UI
  (salon + portefeuille).
- **Phase 4** — mode argent réel + conformité (projet séparé).

## 16. Ce qu'il ne faut PAS faire

- **Pas de solde stocké** : toujours `SUM(ledger_entries)`.
- **Ne pas mélanger** jetons et cash dans la même devise/solde retirable.
- **Ne pas régler depuis le room** : le room constate l'issue, la **platform**
  seule écrit l'argent.
- **Pas de découvert** ni de mise à crédit.
- **Ne pas créer de « paiement » provider** pour un mouvement interne :
  utiliser `postInternalMovement` (pas de rail, pas de webhook).
- **Ne pas réécrire** une seconde fois le funnel de résultat : étendre
  `/api/profile/match-results`, ne pas ajouter un chemin parallèle.
