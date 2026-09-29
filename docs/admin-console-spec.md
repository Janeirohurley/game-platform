# Console d'administration — cahier des charges & état

Référentiel qualité : skill **professional-admin-console** (`.agents/skills/professional-admin-console`).
Priorités du skill : information réelle → actions → tables → recherche/filtres → tri → pagination →
vues de détail → permissions → statistiques → états opérationnels → états de chargement → polish.

Règle transversale : **aucune donnée inventée** — zéros et empty states honnêtes ; actions uniquement
si le backend les supporte réellement ; autorisation revérifiée **côté serveur** à chaque action
(`requireAdminSession`, plugin admin Better Auth), le masquage UI n'est jamais la sécurité.

## État des phases

| Phase | Contenu | État | Livré où |
|---|---|---|---|
| 0 | Audit initial (rôles, registre, audit trail) | ✅ fait | audit de départ |
| 1 | Socle : plugin admin Better Auth, migrations, gate 2 niveaux, shell | ✅ fait | `lib/auth.ts`, `(admin)/layout.tsx` |
| 2 | Dashboard overview (tendance 7/30/90 j, tuiles hebdo, matchs récents) | ✅ fait | `admin/page.tsx` |
| 3 | Utilisateurs (table serveur, recherche, CSV, actions admin) | ✅ fait | `admin/users` |
| 4 | Gamers (table + fiche drill-down `/admin/gamers/[username]`) | ✅ fait | `admin/gamers` |
| 5 | Jeux (table du registre + agrégats `game_stats`/`game_matches`) | ✅ fait | `admin/games` |
| 6 | Matchs (audit trail filtrable jeu/résultat, pagination serveur) | ✅ fait | `admin/matches` |
| 7 | Rooms Colyseus (live via `api_admin_rooms`, secret partagé) | ✅ fait | `admin/rooms` |
| 8 | LiveKit (état média via `RoomServiceClient` officiel) | ✅ fait | `admin/livekit` |
| 9 | Actions administratives (ban/unban/rôle/révocation, confirmations) | ✅ fait | `lib/admin/actions.ts`, menus contextuels |
| **10** | **Statistiques** | **✅ couvert — voir justification** | dashboard + tables existantes |
| **11** | **Modération : audit log** (table append-only, écriture succès/échec, console paginée) | ✅ fait | `db/schema/audit.ts`, `lib/admin/audit.ts`, `/admin/audit` |

## Phase 10 « Statistiques » — justification de clôture

**Décision : ne PAS construire d'écran `/admin/statistics` dédié.** La phase est couverte par
l'existant, et un écran de plus violerait le référentiel (pas de cartes décoratives, pas de
graphique sans insight, « tables > graphiques »).

### Les exemples de statistiques du skill sont déjà répondus

| Question du skill | Réponse existante | Où |
|---|---|---|
| users over time / matches over time | séries 7/30/90 j zéro-remplies + deltas réels vs période précédente (`null` si pas de base) | dashboard |
| matches today, new users, active players, games played | tuiles hebdo + actifs 7 j + totaux | dashboard |
| games by usage | **table** par jeu : joueurs distincts, matchs, bilan V/D/N, rating moyen, temps cumulé | `/admin/games` |
| match duration | durée par match (m:ss) + temps cumulé par jeu et par gamer | dashboard, fiches |
| active users / active matches / online players (live) | rooms Colyseus + canaux LiveKit en direct | `/admin/rooms`, `/admin/livekit` |

### Pourquoi un écran dédié serait du bruit, pas de la valeur

1. **Duplication** : les mêmes requêtes rendues ailleurs. Le skill interdit de remplir l'admin
   « parce que les templates admin ont des pages de stats ».
2. **Pas de nouveau insight** : aucun graphique additionnel ne répond à une question opérationnelle
   que les tables/dashboard ne répondent pas déjà.
3. **Volume réel absent** : depuis la purge des comptes de test, `game_matches` est vide ; des
   métriques dérivées supplémentaires seraient des écrans vides ou du remplissage.

### Ce qui manque *réellement* (reporté, avec critères de déclenchement)

1. **Audit log des actions admin** (le seul manque statistique vrai, prérequis de la phase 11) —
   table + écriture dans les server actions existantes + vue console paginée. Déclencheur :
   dès que la modération s'active en continu.
2. **Métriques dérivées au volume** (joueurs actifs distincts/jour, durée moyenne par jeu) —
   possible depuis `game_matches`, à construire **quand le volume réel le justifiera** (table ou
   tuile, pas graphique décoratif). Déclencheur : quelques centaines de matchs réels.
3. *(Optionnel)* Deux nombres live sur le dashboard (rooms actives, joueurs en ligne) depuis le
   client `realtime-rooms.ts` déjà écrit — commodité, la page Rooms les affiche déjà.

---

*Document maintenu avec le code : toute nouvelle phase met à jour ce tableau.*
