# Portefeuille (wallet) — architecture & ajout de providers

Ce document décrit le fonctionnement réel du portefeuille tel qu'il est implémenté dans `src/lib/wallet/`, `src/app/api/wallet/` et `src/lib/db/schema/wallet.ts`, puis la marche à suivre pour brancher un nouveau moyen de paiement.

**Règle de fond : aucune donnée inventée.** Tout ce qui suit est vérifié dans le code. Les endroits où le code et ses propres commentaires divergent sont signalés explicitement plutôt que lissés, dans [Cas limites à connaître](#cas-limites-à-connaître).

---

## Architecture

```
   Navigateur (React Server + Client)
        │  walletApi (src/lib/wallet/api-client.ts — seul interlocuteur du navigateur)
        ▼
   Routes HTTP  src/app/api/wallet/**
        │  session → rate limit → validation (zod) → service → réponse
        │  toute erreur traverse walletErrorResponse → toWalletErrorBody
        ▼
   Services (provider-agnostiques)
        ├── engine.ts          dépôt / retrait / refund / annulation / vérification / expiration
        ├── events.ts          ingestion des webhooks (vérifier → normaliser → appliquer)
        ├── provider-config.ts fusion adaptateur (code) ∩ provider_configs (base)
        ├── provider-accounts.ts comptes externes rattachés à un portefeuille
        ├── reconciliation.ts  comparaison interne ↔ provider, et ENREGISTREMENT des écarts
        └── queries.ts         lecture paginée pour l'UI et l'API
        │
        ├──────────────────────┴──────────────────────┐
        ▼                                             ▼
   Registre d'adaptateurs                     PostgreSQL
   providers/registry.ts (singleton)           ledger_entries   (seule source de vérité du solde)
   providers/base.ts     (gates capacités)    wallet_transactions
   providers/sandbox-momo.ts (référence)      provider_events
        │                                     reconciliation_records
        ▼                                     provider_configs / providers
   Webhook provider  ────────────────────────────────┘
        │  corps brut + en-têtes, JAMAIS de session
        ▼
   POST /api/wallet/webhooks/[provider]
```

Le noyau ne connaît **que** l'interface `PaymentProvider`. Ajouter un rail ne touche ni l'engine, ni les routes, ni l'UI.

---

## Les cinq invariants

Le docblock de `src/lib/wallet/engine.ts` énonce les règles que l'implémentation respecte :

1. **Création idempotente** — la clé d'idempotence du client mappe vers exactement une ligne (index unique). Un rejeu renvoie la transaction d'origine et **n'appelle jamais le provider**.
2. **Les retraits réservent les fonds** — le débit est comptabilisé dans la *même* transaction base de données que la création, sous verrou de la ligne `wallets`. Un échec / annulation / expiration poste une **contre-écriture compensatrice** : rien n'est jamais supprimé.
3. **Les dépôts n'est crédit qu'après succès vérifié** — l'écriture de crédit n'existe que dans `applyProviderOutcomeInTx`, après recoupement de la devise et du montant attendu.
4. **Chaque changement de statut passe sous `SELECT … FOR UPDATE`**.
5. **Les appels provider hors transaction** — aucun verrou n'est tenu pendant l'appel réseau, et toute réponse inconnue devient `processing`, un état réconciliable, jamais une supposition.

---

## Modèle de données

`src/lib/db/schema/wallet.ts` (868 lignes). Ordre de dépendance des tables :
`wallets → provider_accounts → wallet_transactions → ledger_entries → reconciliation_records`.

| Table | Rôle | Points clés |
|---|---|---|
| `wallets` | Un portefeuille par `(user_id, currency)`. | PK `id`, unique `(user_id, currency)`, `status ∈ active/frozen/closed`, CHECK `char_length(currency) = 3`. **Aucune colonne de solde.** |
| `provider_accounts` | Compte externe rattaché (numéro mobile money, IBAN…). | unique `(wallet_id, provider, provider_account_id)` ; `status ∈ active/disconnected/expired/error` ; `account_type ∈ mobile_money/bank/card/digital_wallet/other`. |
| `wallet_transactions` | Une opération de portefeuille. | unique `idempotency_key` ; unique `(provider, provider_transaction_id)` ; CHECK `gross_amount > 0`, `net_amount >= 0`, frais ≥ 0 ; `type ∈ deposit/withdrawal/payment/refund/reversal`, `status ∈` 9 valeurs. |
| `ledger_entries` | Écritures en partie double. | `amount_minor <> 0` (CHECK) ; **aucun index unique** sur `(transaction, account, wallet)` — délibéré (voir ci-dessous). |
| `provider_events` | Journal des webhooks reçus. | unique `(provider, provider_event_id)` = garde anti-doublon ; `payload` = projection normalisée, **jamais le corps brut**. |
| `reconciliation_records` | Écarts constatés, avec `dedupe_key` unique. | `issue_type` (8 valeurs), `severity ∈ info/warning/critical`, `status ∈ open/acknowledged/resolved`. |
| `providers`, `provider_assets`, `provider_credentials` | Registre de marques (Phase 14). | **Jamais importés par le code applicatif** — voir plus bas. |
| `provider_configs` | Configuration effective par provider. | PK `provider` (l'id du registre d'adaptateurs), FK `provider_id → providers.id`. |

### Pourquoi il n'y a pas de solde stocké

`wallets` n'a pas de colonne de balance. Le solde est **toujours** `SUM(ledger_entries.amount_minor)` :

```ts
// src/lib/wallet/ledger.ts
const rows = await tx.select({
  total: sql<string>`coalesce(sum(${ledgerEntries.amountMinor}), 0)::bigint`,
}).from(ledgerEntries).where(eq(ledgerEntries.walletId, walletId));
```

Une colonne de solde ne pourrait être qu'un cache de ce calcul.

### Pourquoi `ledger_entries` n'a aucun index unique

Commentaire du schéma (`wallet.ts:305-311`) :

> une écriture compensatrice (annulation / expiration / échec d'un retrait) poste les **mêmes** jambes en **sens inverse** sur la **même** transaction et le **même** compte — un tel index la rejetterait. La vraie garde contre un double comptage est le changement de statut effectué sous `FOR UPDATE` dans l'engine.

La migration `drizzle/0007_drop_ledger_account_uq.sql` existe précisément pour retirer cet index.

### Comptes du grand livre

| Compte | Sens | Signification |
|---|---|---|
| `wallet` | dépend du sens | Le portefeuille de l'utilisateur (ligne avec `wallet_id`). |
| `external:<providerId>` | opposé au portefeuille | Compte de clearing du provider. |
| `fees:platform` | positif | Frais plateforme. |
| `fees:provider` | positif | Frais du rail. |

Invariant vérifié par `assertBalanced()` **avant** la base et **encore** dans `postLedger()` : la somme des `amountMinor` doit valoir exactement `0`, et **aucune jambe à zéro n'est autorisée** (d'où les gardes `> 0` qui omettent les jambes de frais nulles).

### Le registre `providers` est actuellement inerte

Les tables `providers`, `provider_assets`, `provider_credentials` et `provider_types` sont exportées par `src/lib/db/schema/index.ts` mais **importées par zéro fichier applicatif ou test**. Seul `providerConfigs` est lu, par `provider-config.ts`. Le registre existe (schéma + migrations `0008_add_provider_registry.sql` / `0009_backfill_provider_registry.sql`, ce dernier sémant le sandbox-momo), mais le code ne le consomme pas encore : la source de vérité des métadonnées de marque reste l'adaptateur lui-même.

---

## L'argent en unités mineures

**Aucun montant n'est un flottant.** Tout est stocké en `bigint` d'unités mineures et manipulé en `BigInt` / concaténation de chaînes.

| Devise | `exponent` | Exemple |
|---|---|---|
| `BIF`, `RWF`, `UGX` | `0` | 10 000 BIF → `10000` |
| `USD`, `EUR`, `GBP`, `KES`, `TZS`, `NGN`, `ZAR` | `2` | 19,99 USD → `1999` |

`currencies.ts` expose `CURRENCIES`, `normalizeCurrency`, `isSupportedCurrency`, `currencyExponent` et `defaultWalletCurrency()` (variable d'environnement `WALLET_DEFAULT_CURRENCY`, sinon `BIF`).

`money.ts` :

- `parseMajorToMinor(input, currency)` — supprime espaces et apostrophes, convertit la **première** virgule en point, rejette plus de décimales que l'exposant n'en autorise, puis concatène entier et fraction. Zéro, négatif et débordement sont refusés.
- `minorToMajorString(minor, currency)` — l'inverse exact, sans séparateur de milliers.
- `formatMoney(minor, currency, locale = "fr-FR")` — ne passe à `Intl` **que la partie entière** (`maximumFractionDigits: 0`) puis recolle la fraction en texte : aucune perte de précision.
- `MAX_AMOUNT_MINOR = 9_000_000_000_000_000`, `isAmountMinor`, `assertAmountMinor`, `sumMinor`, `isCurrencyCode`.

⚠ **Le portefeuille ne convertit jamais de devise.** Un utilisateur a un portefeuille par devise ; une autre devise est un autre portefeuille.

---

## Les frais

`fees.ts` calcule en `BigInt`, arrondi **half-up** (les demi-valeurs montent), sans flottant :

```ts
function bpsOf(amount: bigint, bps: bigint): bigint {
  const product = amount * bps;
  return (product + BPS_DIVISOR / BigInt(2)) / BPS_DIVISOR; // BPS_DIVISOR = 10_000n
}
```

| Champ | Formule |
|---|---|
| `providerFee` | `round_half_up(gross × providerBps / 10 000) + providerFixedMinor` |
| `platformFee` | `round_half_up(gross × platformBps / 10 000) + platformFixedMinor` |
| `totalFee` | `providerFee + platformFee` |

Les composantes fixes s'ajoutent **après** l'arrondi des bps, et les deux frais sont arrondis **indépendamment** : `totalFee` n'est pas ré-arrondi. Aucun plafonnement, aucun frais sur frais.

`parseFeeSchedule(raw)` valide le JSON de `provider_configs.fees` : `null`/`undefined` → schedule vide (frais nuls), champs inconnus **ignorés** (compatibilité ascendante), valeurs invalides **rejetées** — une configuration corrompue ne doit jamais tarifer silencieusement de l'argent. `bps > 10 000` est refusé.

---

## Le moteur — `src/lib/wallet/engine.ts`

### Sémantique des montants

C'est le tableau le plus important du système :

| Type | `netAmount` (côté portefeuille) | Montant chez le rail (`expectedRailAmount`) |
|---|---|---|
| `deposit` | `gross` — **crédité** au succès | `gross + providerFee + platformFee` — **collecté** |
| `withdrawal` | `gross + totalFee` — **débité** à la création | `gross` — **délivré** |
| `refund` | `gross` — débité à la création | `gross` — retourné |

`expectedRailAmount()` (`ledger.ts:275-290`) est la **définition unique** utilisée à la fois par le recoupement de l'engine et par la réconciliation, pour que les deux comparent toujours la même attente.

### `createOperation(input)`

```ts
createOperation(input: {
  userId: string;
  type: "deposit" | "withdrawal";
  provider: string;
  amountMinor: number;
  currency: string;
  providerAccountId?: string;
  destinationRef?: string;
  idempotencyKey: string;   // OBLIGATOIRE
}): Promise<{ transaction: TransactionRow; duplicate: boolean }>
```

Déroulé :

1. **Garde** — `requireActiveProvider()` avec la capacité `DEPOSIT` ou `WITHDRAWAL`, calcul des frais, lecture de `expirySeconds` (défaut 900, borné `[60, 86 400]`) et `timeoutMs` (défaut 15 000, borné `[1 000, 60 000]`), `ensureWallet()`, `assertWalletOperable()`. Si un `providerAccountId` est fourni, il doit appartenir **à ce portefeuille et à ce provider**, sinon `validation`.
2. **Une transaction base de données** — verrou `FOR UPDATE` sur `wallets`, contrôle `status === "active"`, insertion avec `onConflictDoNothing({ target: idempotency_key })`. Pour un retrait : contrôle de solde **puis** poste immédiatement le débit (réservation). Un rejeu identique renvoie la ligne existante avec `duplicate: true` **et retourne avant d'appeler le provider**. La même clé avec un champ différent (portefeuille, type, devise, montant, provider) donne `idempotency_conflict` (409).
3. **L'appel provider, hors transaction**, sous `withTimeout(...)`. Le `reference` transmis est **notre id de transaction interne** : c'est ce que le webhook résoudra.
4. **Réponse `pending`/`processing`** — `UPDATE` conditionnel `WHERE status = 'created'`, stockage de `providerTransactionId`, `expiresAt`, `instructions` et `paymentUrl` dans `metadata`. Si la ligne a bougé entre-temps (balayage d'expiration, annulation), l'état courant est relu et renvoyé plutôt que deviné.
5. **Réponse terminale immédiate** — passe par `applyProviderOutcomeInTx` avec `source: "provider-response"`.
6. **Erreurs** — deux comportements distincts :
   - **timeout** (`provider_timeout`) → la ligne passe en `processing` (réconciliable) et l'appel **lève quand même** un `WalletError` portant `transactionId` ;
   - **rejet définitif** → sous `FOR UPDATE`, contre-écriture de la réservation si retrait, `status = "failed"`, `failureReason` assaini, puis `WalletError` levé.

⚠ Sur le chemin `provider-response`, **aucun recoupement de montant ni de devise n'est effectué** : `createOperation` ne transmet pas `eventAmountMinor` / `eventCurrency`. Le recoupement n'a lieu que sur les données de webhook et de vérification.

### `applyProviderOutcomeInTx(tx, input)` — le seul point de mutation

```ts
applyProviderOutcomeInTx(tx: DbTx, input: {
  transactionId: string;
  outcome: "succeeded" | "failed" | "cancelled" | "expired"
          | "reversed" | "processing" | "pending";
  source: "webhook" | "verification" | "provider-response" | "admin";
  providerId?: string;
  providerTransactionId?: string;
  eventAmountMinor?: number;   // déclenche le recoupement
  eventCurrency?: string;      // déclenche le recoupement
  failureReason?: string;
}): Promise<{ applied: boolean; reason?: string; status?: WalletTransactionStatus }>
```

Toujours appelé **dans** une transaction, toujours **après** `FOR UPDATE`. Ordre des étapes :

| Étape | Action | En cas d'échec |
|---|---|---|
| A | Verrou `FOR UPDATE` sur la transaction | `not_found` |
| B | Recoupement devise (`eventCurrency ≠ row.currency`) | issue `currency_mismatch` **critical**, rien ne change |
| C | Recoupement montant (`eventAmountMinor ≠ expectedRailAmount(row)`) | issue `amount_mismatch` **critical**, rien ne change |
| D | Adoption du `providerTransactionId`, avec garde anti-doublon sur le même provider | issue `duplicate_transaction` **critical**, `duplicate_provider_reference` |
| E | `processing` / `pending` | avance de statut pure, **aucun mouvement d'argent** |
| F | `succeeded` | dépôt → **seul endroit du code qui crédite un dépôt** ; retrait/refund en cours → finalisation sans écriture (le débit était déjà réservé) ; sinon conflit terminal → issue `status_mismatch` **critical** |
| G | `failed` / `cancelled` / `expired` / `reversed` | si la ligne est déjà `succeeded`/`refunded`/`reversed` → `terminal_conflict` + issue `warning` ; sinon **contre-écriture** `invert(postingForTransaction(...))` pour les retraits et refunds |

La garde anti-double-crédit est la combinaison `FOR UPDATE` + `if (row.status === "succeeded") return already_succeeded`. Un succès tardif et autoritatif (après un timeout ou un échec interne) est donc deliberately accepté : c'est exactement le cas d'existence des webhooks.

### Les autres opérations

| Fonction | Règle notable |
|---|---|
| `verifyAndSettle({ transactionId, source, timeoutMs? })` | Utilise `allowDisabled: true` : **le règlement doit continuer à fonctionner pour les opérations existantes** même après désactivation du provider. Si `verifyTransaction` répond `verified: false`, la ligne n'est **pas** touchée (`recognized: false`). Passe `eventAmountMinor` + `eventCurrency` → le recoupement s'exécute. |
| `cancelOperation({ userId, transactionId })` | Double garde `isCancellable` (avant et sous verrou). Un dépôt déjà accepté par le rail est **non annulable** (`invalid_state`). Un retrait dont le provider ne sait pas annuler remonte `capability_not_supported` ; l'utilisateur doit attendre le règlement ou l'expiration. |
| `confirmDepositOperation({ userId, transactionId, confirmation? })` | Idempotent : sur une transaction déjà `succeeded` renvoie `{ settled: true, recognized: true }`. Se termine **toujours** par `verifyAndSettle`. |
| `expireStaleOperations(limit = 20)` | Sélection : `expiresAt ≤ now` **et** statut ∈ `{created, pending}` **et** (`type = deposit` **ou** `status = created`). Conséquences : un dépôt en `processing` n'est **jamais** expiré par ce balayage, et un retrait n'est expiré que tant qu'il n'a **pas** été accepté. |
| `refundDeposit({ userId, transactionId, idempotencyKey })` | Crée une transaction `type: "refund"` **distincte**, liée par `originalTransactionId`. Les frais ne sont **pas** re-facturés (miroirés pour l'écriture). Le portefeuille est **débité à la création** du refund ; les fonds ne reviennent qu'en cas d'échec. Son expiration est codée en dur à 900 s, volontairement hors du `expirySeconds` configurable. |

### La machine à états

`constants.ts` définit le vocabulaire canonique (module pur, sans drizzle, partagé par le schéma, l'engine, l'API et le navigateur) :

```
  created ─► pending ─► processing ─► succeeded ─► refunded / reversed
      └──────────┴──────────┴──► failed / cancelled / expired
```

`state.ts` expose la table `TRANSITIONS` ainsi que `canTransition`, `assertTransition`, `isTerminal`, `isSettled`, `isPendingState`, `isCancellable`, `allStatuses`.

⚠ Le tableau `TRANSITIONS` **n'est pas consulté par l'engine** : `canTransition` et `assertTransition` ne sont référencés que dans `state.test.ts`. Le seul import réel est `isCancellable` (`engine.ts:54`). L'application effective des transitions passe par `FOR UPDATE` + `NON_FINAL` + les vérifications de terminaison écrites à la main dans `applyProviderOutcomeInTx`. Une arête ajoutée à `TRANSITIONS` serait donc silencieusement ignorée en production — et les tests passeraient quand même.

---

## Les webhooks — `src/lib/wallet/events.ts`

```
Provider → corps brut → handleWebhook (signature + normalisation)
        → provider_events (dédupe UNIQUE, dans la MÊME transaction que le règlement)
        → resolveTransactionForEvent → applyProviderOutcomeInTx → ledger_entries
```

Les garanties :

- **Signature d'abord** — rien n'est parsé ni persisté avant que l'adaptateur ne réponde `valid`. Chaque adapter possède la vérification de son provider.
- **Idempotent** — l'insertion de l'event échoue en cas de doublon : on répond succès, aucun argent touché. Un traitement en échec **rollback** l'event, ce qui laisse au provider la possibilité de réessayer.
- **Aucune fuite de payload** — l'engine ne voit que l'event normalisé ; la colonne `payload` stocke `eventProjection(event)`, jamais le corps brut.

`processProviderWebhook({ providerId, rawBody, headers })` renvoie `{ outcome: "processed" | "duplicate" | "ignored" | "unresolved"; applied: boolean; transactionId?: string; reason?: string }`.

| Étape | Résultat |
|---|---|
| Provider inconnu | `WalletError("not_found")` → 404, sans rien divulguer |
| `valid: false` | `walletErrorResponse` → **401** `webhook_verification_failed` |
| `valid: true` sans event (type non modélisé, mais bien signé) | `ignored`, **HTTP 200** — on acquitte pour arrêter les retries du provider, sans rien persister |
| Doublon `(provider, provider_event_id)` déjà `processed`/`ignored` | `duplicate`, 200, aucun argent touché |
| Doublon dont la tentative précédente est `failed` | on **réutilise** la ligne et on retente |
| `reference` / `providerTransactionId` non résolue | event marqué `failed` (**commité**, pas rollbacké) → `unresolved`, d'où la branche de retry ci-dessus |
| Résolu | `applyProviderOutcomeInTx(..., source: "webhook", eventAmountMinor, eventCurrency)` puis event marqué `processed` |

⚠ **Le routage vient de `event.status`, pas de `event.type`.** `ProviderEventType` (`deposit.succeeded`, `withdrawal.reversed`…) est stocké pour l'audit et la réconciliation, mais c'est le statut normalisé qui fait avancer la machine à états.

Résolution de référence : `reference` exact d'abord (avec le suffixe `:refund` qui cible la transaction `refund` la plus récente liée à l'original), puis repli sur `(provider, providerTransactionId)`.

`simulateProviderSettlement(...)` est un crochet **sandbox** à quatre gardes : environnement `sandbox`, implémentation de `simulateSettlement`, sinon `forbidden` / `capability_not_supported`. Le corps qu'il produit est **réellement signé**, puis repassé dans `processProviderWebhook` : la vérification de signature n'est jamais contournée.

---

## La configuration effective d'un provider

Formule unique de `provider-config.ts` :

> **`effective = déclarations de l'adaptateur ∩ configuration base de données`**

La configuration peut **rétrécir** (désactiver, retirer des capacités, restreindre les devises, poser des bornes et des frais), **jamais accorder** une capacité non déclarée. Activer ou désactiver un provider = retourner un booléen en base, sans code ni déploiement.

```ts
export interface EffectiveProviderConfig {
  id: string;
  name: string;                        // displayName de la config, sinon nom de l'adaptateur
  description?: string;
  environment: ProviderEnvironment;
  enabled: boolean;                    // provider_configs.enabled
  available: boolean;                  // checkAvailability() de l'adaptateur
  unavailableReason?: string;
  adapterCapabilities: readonly ProviderCapability[];  // déclaré
  capabilities: readonly ProviderCapability[];         // autorisé (intersection)
  supportedCurrencies: readonly string[];              // intersection
  supportedCountries?: readonly string[];
  minimumAmount: number | null;
  maximumAmount: number | null;
  fees: FeeSchedule;                   // parseFeeSchedule(row.fees)
  configuration: Record<string, unknown>;  // timeoutMs, expirySeconds, webhookUrl…
}
```

Règles de fusion :

- `provider_configs.capabilities === NULL` → **toutes** les capacités de l'adaptateur. Un tableau explicite — même vide — restreint à ce tableau.
- `provider_configs.supported_currencies` est uppercasé puis filtré par `/^[A-Z]{3}$/` ; si la liste filtrée est vide, la liste de l'adaptateur est conservée.
- `timeoutMs` et `expirySeconds` ne sont **pas** des champs de l'interface : ils vivent dans `configuration` et se lisent via `readConfigInt(config, key, fallback, min, max)`, qui borne l'entier dans `[min, max]`.
- `checkAvailability()` est appelé **séquentiellement** (l'attribution d'erreur reste évidente) et ne doit jamais lever : un `try/catch` le transforme en `{ available: false, reason }`.

### `requireActiveProvider()` — l'ordre des gardes

Chaque étape lève un `WalletError` distinct, dans cet ordre :

| # | Condition | Erreur | HTTP |
|---|---|---|---|
| 1 | Provider non enregistré, ou pas de config effective | `provider_unavailable` | 503 |
| 2 | `!enabled` et `allowDisabled` non passé | `provider_unavailable` | 503 |
| 3 | `!available` | `provider_unavailable` (details `reason`) | 503 |
| 4 | Capacité absente de l'intersection | `capability_not_supported` | 422 |
| 5 | Devise absente de l'intersection | `validation` | 400 |
| 6 | `amountMinor < minimumAmount` | `validation` (+ `minimumAmount`) | 400 |
| 7 | `amountMinor > maximumAmount` | `validation` (+ `maximumAmount`) | 400 |

`allowDisabled: true` n'est utilisé qu'à trois endroits, tous destinés à **terminer** des opérations déjà en vol : `verifyAndSettle`, `cancelOperation`, `confirmDepositOperation`.

`quoteFees(...)` passe par exactement les mêmes gardes (capacité + montant) avant de renvoyer `{ provider, providerName, type, currency, grossAmount, providerFee, platformFee, totalFee, netAmount, totalAmount }`.

`mapProviderError(error)` traduit un `ProviderError` en `WalletError` :

| `ProviderError.code` | → `WalletError.code` |
|---|---|
| `capability_not_supported` | `capability_not_supported` |
| `unavailable` | `provider_unavailable` |
| `timeout` | `provider_timeout` |
| `invalid_request` | `validation` |
| `not_found` | `not_found` |
| `verification_failed` | `amount_mismatch` |
| `provider_error` | `provider_error` |

Un `WalletError` traverse tel quel ; tout le reste devient `provider_error`.

---

## Ajouter un nouveau provider — pas à pas

Le checklist canonique est dans le docblock de `src/lib/wallet/providers/index.ts` : implémenter `PaymentProvider`, enregistrer le constructeur, configurer. **Ni l'engine, ni les routes, ni l'UI ne changent.**

### 1. Créer l'adaptateur

Un fichier `src/lib/wallet/providers/<mon-rail>.ts`, qui étend `BasePaymentProvider`. Les capacités doivent être déclarées **honnêtement** : le wallet rejette une opération non déclarée **avant** tout appel réseau.

```ts
import { ProviderError } from "./types";
import { BasePaymentProvider } from "./base";
import type {
  ProviderCreateDepositInput,
  ProviderInfo,
  ProviderOperationResult,
  ProviderTransactionStatus,
} from "./types";

export const MON_RAIL_ID = "mon-rail";

export class MonRailProvider extends BasePaymentProvider {
  getProviderInfo(): ProviderInfo {
    return {
      id: MON_RAIL_ID,                       // /^[a-z0-9][a-z0-9-]*$/
      name: "Mon Rail",
      description: "Paiements mobiles via l'API Mon Rail.",
      environment: "production",            // ou "sandbox" pour activer /simulate
      capabilities: [
        "DEPOSIT",
        "WITHDRAWAL",
        "WEBHOOK",
        "TRANSACTION_STATUS",
        "BALANCE_CHECK",
        "RECONCILIATION",                  // seulement si listTransactions existe
      ],
      supportedCurrencies: ["BIF", "USD"],
      supportedCountries: ["BI"],
    };
  }

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    if (!process.env.MON_RAIL_API_KEY) {
      return { available: false, reason: "MON_RAIL_API_KEY is not configured" };
    }
    return { available: true };
  }

  async createDeposit(
    input: ProviderCreateDepositInput,
  ): Promise<ProviderOperationResult> {
    // 1. valider les montants (entier positif) et la devise
    // 2. réutiliser la clé d'idempotence côté provider
    // 3. créer l'opération, retourner l'id provider + instructions
    throw new ProviderError("provider_error", "Not implemented");
  }

  // … createWithdrawal, getTransactionStatus, verifyTransaction,
  //     handleWebhook, refundTransaction, listTransactions…
}
```

Ce que `BasePaymentProvider` fournit déjà : `supports(capability)`, `requireCapability(capability)` (rejet typé **avant** toute I/O), `notImplemented(operation)` (déclaré mais non surchargé → `provider_error` non rejouable, convention de bug attrapé par la suite de contrat) et `checkAvailability()` par défaut à `{ available: true }`.

### 2. Enregistrer l'adaptateur

Une seule ligne dans `src/lib/wallet/providers/index.ts` :

```ts
const BUILTIN: (() => PaymentProvider)[] = [
  () => new SandboxMobileMoneyProvider(),
  () => new MonRailProvider(),      // ← ici
];
```

`ensureBuiltinProviders()` est idempotent (garde `initialized` + test `has(id)`), et l'enregistrement à l'import du module est déjà en place. Un `id` dupliqué lève une erreur ; un `id` mal formé aussi (`/^[a-z0-9][a-z0-9-]*$/`).

### 3. Implémenter `handleWebhook`

L'ordre est-security-critical :

1. `requireCapability("WEBHOOK")`
2. secret configuré ? sinon `{ valid: false, reason: "..." }`
3. en-tête de signature présent et au bon format ? sinon `valid: false`
4. **comparaison à temps constant** sur les octets exacts du corps → sinon `valid: false`
5. `JSON.parse` → sinon `valid: false`
6. formes du payload → sinon `valid: false`
7. type d'événement non modélisé mais correctement signé → `{ valid: true, reason: "Unsupported event type" }` **sans event** (acquittement, rien persisté)
8. renvoyer un `NormalizedProviderEvent`

Le payload brut du provider **ne franchit jamais** `handleWebhook`.

### 4. Déclarer les capacités conditionnelles dans la base

```sql
INSERT INTO provider_configs (
  provider, enabled, environment, capabilities,
  supported_currencies, minimum_amount, maximum_amount,
  fees, configuration
) VALUES (
  'mon-rail', true, 'sandbox',
  ARRAY['DEPOSIT','WITHDRAWAL','WEBHOOK','TRANSACTION_STATUS','BALANCE_CHECK'],
  ARRAY['BIF','USD'], 100, 5_000_000,
  '{"providerBps":150,"platformBps":50}'::jsonb,
  '{"timeoutMs":15000,"expirySeconds":900,"webhookUrl":"https://…/api/wallet/webhooks/mon-rail"}'::jsonb
)
ON CONFLICT ("provider") DO UPDATE SET …;
```

Rappel : `capabilities: NULL` = toutes les capacités de l'adaptateur ; un tableau restreint. Les secrets **ne vont jamais** dans ces lignes — ils sont lus par l'adaptateur dans l'environnement.

### 5. Variables d'environnement et secret de webhook

```
MON_RAIL_API_KEY=…
MON_RAIL_WEBHOOK_SECRET=…      # 16 caractères minimum, comme pour le sandbox
```

Le secret n'est vérifié qu'au moment de l'usage ; `checkAvailability()` doit refléter sa présence pour que l'UI affiche le provider comme indisponible.

### 6. Tester

- **Unitaire** — étendre la suite existante (`bun test`) : cycle de vie, idempotence provider, vérification de signature (en-tête manquant, mauvais secret, corps altéré, JSON invalide), `verifyTransaction` autoritatif, remboursements.
- **Intégration base** — `src/lib/wallet/engine-db.test.ts` fournit déjà le harnais : il règle les transactions via le **chemin webhook signé**, jamais en contournant.
- **Restriction de config** — le test « provider config can NARROW an adapter but never widen it » est le modèle.

### 7. Ce qu'il ne faut pas faire

- Ne pas ajouter de méthode au `PaymentProvider` sans mettre à jour `base.ts` **et** la suite de contrat.
- Ne pas déclarer une capacité qu'on ne sait pas servir (`base.test.ts` le vérifie : déclaré mais non surchargé = `provider_error`).
- Ne pas stocker de credentials dans `provider_configs`, `metadata`, `instructions` ou `failureReason`.
- Ne pas faire confiance au `payload` d'un webhook pour autre chose que le recoupement montant/devise.
- Ne pas transformer un outcome inconnu en `failed` : `processing` est réconciliable, `failed` est une affirmation.

### 8. Câblage déjà en place

| Élément | Endroit | À faire |
|---|---|---|
| Webhook entrant | `POST /api/wallet/webhooks/mon-rail` | automatique (route paramétrée par `provider`) |
| Affichage UI | `GET /api/wallet/providers` | automatique (`listEffectiveProviders()`) |
| Devis de l'opération | `POST /api/wallet/deposits` / `withdrawals` | automatique |
| Activation / désactivation | `src/app/(admin)/admin/providers` | automatique si la ligne `provider_configs` existe |
| Simulation | `POST /api/wallet/simulate` | automatique si `environment = 'sandbox'` **et** `simulateSettlement` existe |
| Réconciliation « manquant d'un côté » | `runReconciliation` | automatique si `listTransactions` existe |

---

## La réconciliation — `src/lib/wallet/reconciliation.ts`

> **ne corrige jamais l'histoire financière** : corriger de l'argent est une décision humaine, prise depuis le dossier.

`runReconciliation({ provider, from?, to? })` (fenêtre par défaut : les 7 derniers jours) enchaîne :

| # | Issue | Sévérité | Détection |
|---|---|---|---|
| 1 | `ledger_imbalance` | `critical` | `sum(amount_minor) <> 0` sur une transaction |
| 2 | `negative_balance` | `critical` | somme d'un portefeuille `< 0` |
| 3 | `duplicate_transaction` | `critical` | `count(*) > 1` sur `(provider, providerTransactionId)` |
| 4 | `missing_ledger_transaction` | `critical` | côté provider sans correspondance interne (nécessite `listTransactions`) |
| 5 | `amount_mismatch` | `warning` | montant provider ≠ `expectedRailAmount` |
| 6 | `currency_mismatch` | `warning` | devise provider ≠ devise interne |
| 7 | `status_mismatch` | `warning` | « succeeded » d'un côté seulement |
| 8 | `missing_provider_transaction` | `critical` | succeeded en interne, absent de la fenêtre provider |

Les checks 1-3 sont toujours exécutés ; les checks 4-8 **seulement** si l'adaptateur implémente `listTransactions` (capacité `RECONCILIATION`). Les checks 5-7 sont écrits sans sévérité explicite, donc ils valent `warning`.

`buildDedupeKey` = `[issueType, provider, transactionId ?? "-", providerTransactionId ?? "-"]`, avec un `onConflictDoNothing` sur la colonne unique : un même écart ne s'empile pas à chaque run.

L'engine enregistre aussi des issues à chaud, via `recordIssueInTx`, pour `currency_mismatch`, `amount_mismatch`, `duplicate_transaction` et `status_mismatch`.

---

## L'API HTTP

15 fichiers, 16 handlers. Chaque route suit la même plomberie (`http.ts`) :

```
session → rate limit → validation (zod) → appel service → réponse
```

Toute valeur levée passe par `walletErrorResponse` → `toWalletErrorBody`. Une erreur inconnue s'effondre en `500 { "error": { "code": "internal", "message": "An unexpected error occurred. Please try again." } }` : les fragments de payload du provider ne fuient jamais.

| Route | Méthode | Limite | Service |
|---|---|---|---|
| `/api/wallet` | GET | — | `getWalletOverview` + `expireStaleOperations(5)` (balayage advisory) |
| `/api/wallet/balance` | GET | — | `getWalletOverview` |
| `/api/wallet/providers` | GET | — | `listEffectiveProviders().map(toPublicProvider)` |
| `/api/wallet/quote` | POST | — | `quoteFees` |
| `/api/wallet/deposits` | POST | `depositLimiter` | `createOperation` → **201** / **200** si `duplicate` |
| `/api/wallet/withdrawals` | POST | `withdrawalLimiter` | `createOperation` (idem) |
| `/api/wallet/simulate` | POST | — | `simulateProviderSettlement` |
| `/api/wallet/accounts` | GET | — | `listProviderAccountsForUser` + `toPublicAccount` |
| `/api/wallet/accounts` | POST | `connectLimiter` | `connectProviderAccount` → **201** |
| `/api/wallet/accounts/[id]` | DELETE | — | `disconnectProviderAccount` |
| `/api/wallet/transactions` | GET | — | `listTransactionsForUser` (`page`, `pageSize`, `type`, `status`, `provider`, `currency`, `search`) |
| `/api/wallet/transactions/[id]` | GET | — | `getTransactionDetailForUser` (transaction + ledger + events) |
| `/api/wallet/transactions/[id]/cancel` | POST | — | `cancelOperation` |
| `/api/wallet/transactions/[id]/confirm` | POST | — | `confirmDepositOperation` |
| `/api/wallet/transactions/[id]/refund` | POST | — | `refundDeposit` → **201** / **200** |
| `/api/wallet/webhooks/[provider]` | POST | `webhookLimiter` (par IP) | `processProviderWebhook` — **sans session** |

Il n'y a **aucune route API d'administration** : les mutations admin sont des server actions (`src/lib/admin/wallet-actions.ts`).

### Taxonomie d'erreurs

| Code | HTTP |
|---|---|
| `unauthorized` | 401 |
| `webhook_verification_failed` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `validation` | 400 |
| `idempotency_conflict` | 409 |
| `insufficient_funds` | 409 |
| `invalid_state` | 409 |
| `currency_mismatch` | 409 |
| `amount_mismatch` | 409 |
| `capability_not_supported` | 422 |
| `rate_limited` | 429 |
| `provider_error` | 502 |
| `provider_timeout` | 504 |
| `provider_unavailable` | 503 |
| `internal` | 500 |

### Le webhook

```
Provider Webhook → corps brut + en-têtes → normalisé par l'adaptateur
   → provider_events → Engine → Ledger

401 = signature invalide
404 = endpoint de provider inconnu
200 = événement traité, dupliqué, ignoré, ou non résolu
```

Le corps brut est lu **en première instruction** de la route (`await request.text()`), parce que la signature HMAC couvre exactement ces octets. Le rate limit est appliqué par `webhook:<provider>:<ip>`. La déduplication est **en base**, dans la même transaction que le règlement.

### Comptes externes masqués

```ts
export function maskAccountRef(ref: string): string {
  const trimmed = ref.trim();
  if (trimmed.length <= 7) return `••••${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-3)}`;
}
```

La projection publique `toPublicAccount` remplace `providerAccountId` par sa version masquée **tout en conservant l'`id` de la ligne** — c'est cet id qu'il faut renvoyer pour ouvrir une opération. `displayName` est déjà masqué au moment de l'écriture. La déconnexion est un **basculement de statut** (`active → disconnected`), jamais une suppression : l'historique qui référence le compte doit rester lisible. Aucun secret n'est stocké : ni credential, ni CVV, ni token, ni PIN.

---

## La console d'administration

`src/app/(admin)/layout.tsx` vérifie session + rôle `admin` côté serveur (écran d'interdiction explicite, jamais une redirection silencieuse).

| Fichier | Rôle |
|---|---|
| `admin/wallets/page.tsx` | Liste de tous les portefeuilles avec le solde **vivant** dérivé du grand livre |
| `admin/transactions/page.tsx` | Transactions de la plateforme, filtres validés contre les constantes |
| `admin/transactions/[id]/page.tsx` | Piste d'audit complète : propriétaire, montants + frais explicites, chaque jambe du ledger, chaque event provider, les constats de réconciliation, et l'action « Vérifier auprès du fournisseur » |
| `admin/providers/page.tsx` | Vue **effective** de chaque provider (adaptateur ∩ base), activation/désactivation auditée |
| `admin/reconciliation/page.tsx` | Console de réconciliation : lancer un run borné, examiner et résoudre les constats |
| `src/lib/admin/wallet-queries.ts` | `listWalletsAdmin`, `listTransactionsAdmin`, `getTransactionDetailAdmin` |
| `src/lib/admin/wallet-actions.ts` | `setProviderEnabledAction`, `runReconciliationAction`, `resolveReconciliationIssueAction`, `verifyTransactionAction` |

Les règles maison de `wallet-actions.ts` : revérifier `admin` côté serveur, valider contre le registre ou la couche service, écrire une ligne d'audit **même en cas d'erreur**, et renvoyer le vrai `{ ok, message }` — le succès n'est jamais simulé.

**Volontairement absent** : toute action qui déplace de l'argent pour le compte d'un utilisateur. La console peut inspecter, vérifier (demander au rail), activer/désactiver un provider et résoudre un constat. Le règlement ne vient que d'events provider vérifiés.

---

## Variables d'environnement

| Variable | Lue dans | Rôle |
|---|---|---|
| `DATABASE_URL` | `src/lib/db/index.ts` | Postgres. Requise par toute lecture/écriture wallet ; `engine-db.test.ts` se **skip** sans elle. |
| `WALLET_DEFAULT_CURRENCY` | `currencies.ts` | Devise par défaut des portefeuilles créés paresseusement. Retombe sur `BIF` si absente ou non supportée. |
| `SANDBOX_MOMO_WEBHOOK_SECRET` | `providers/sandbox-momo.ts` | Secret HMAC-SHA256 du rail sandbox. **16 caractères minimum** ; sinon le provider se déclare indisponible et les webhooks sont rejetés en 401. |
| `SANDBOX_MOMO_LATENCY_MS` | `providers/sandbox-momo.ts` | Latence artificielle (bornée à 30 000 ms) pour exercer le chemin timeout → `processing`. |

`provider-config.ts` ne lit **aucune** variable d'environnement.

⚠ `.env.exemple` ne contient **aucune** des trois variables wallet (`WALLET_DEFAULT_CURRENCY`, `SANDBOX_MOMO_WEBHOOK_SECRET`, `SANDBOX_MOMO_LATENCY_MS`). Il faut les ajouter à la main pour qu'un nouveau déploiement démarre avec un sandbox utilisable.

La migration `0009_backfill_provider_registry.sql` insère une ligne `provider_credentials` dont `webhook_secret` est un **placeholder committé**, sans rapport avec la vraie variable d'environnement. Sans secret réel dans l'environnement, le sandbox reste indisponible.

---

## Tests

```bash
bun test src/lib/wallet
```

| Fichier | Couvre |
|---|---|
| `engine-db.test.ts` (673 l.) | Intégration **base réelle** : création de portefeuille, dépôt crédité une seule fois au règlement, idempotence client, règlement via le chemin webhook signé, réservation/dé-réservation d'un retrait, annulation, fonds insuffisants, **retraits concurrents sous verrou**, signature invalide, webhook menteur sur la devise, refunds, restriction de config, solde final exact |
| `state.test.ts` | Table de transitions et prédicats |
| `fees.test.ts` | Arrondi half-up, composantes fixes, validation du schedule |
| `money.test.ts` | Parse/format/gardes en unités mineures |
| `rate-limit.test.ts` | Limiteur à fenêtre fixe avec horloge injectée |
| `providers/base.test.ts` | Gating de capacités, cas « déclaré mais non surchargé » |
| `providers/registry.test.ts` | Catalogue : ids malformés, pas de double enregistrement, `require()` typé |
| `providers/sandbox-momo.test.ts` | Cycle de vie, signature, crochet `simulateSettlement`, retraits et refunds |

Les tests wallet sont **colocalisés** dans `src/lib/wallet/` — il n'y a pas de dossier `tests/`. Le runner est `bun test` (`bun run test`). `bun run validate` ne lance **pas** les tests : c'est `typecheck` + `lint` + `db:check`.

---

## Cas limites à connaître

1. **`TRANSITIONS` n'est pas appliqué par l'engine.** `canTransition` / `assertTransition` ne sont testés que dans `state.test.ts` ; seul `isCancellable` est importé par le moteur. Une arête ajoutée au tableau serait ignorée en production, et les tests passeraient.
2. **Les réponses immédiates du provider ne sont pas recoupées.** Le chemin `provider-response` de `createOperation` ne transmet ni montant ni devise : seul le webhook et la vérification serveur déclenchent `amount_mismatch` / `currency_mismatch`.
3. **Le routage des events se fait sur `status`, pas sur `type`.**
4. **`provider_events.status` n'atteint jamais `"ignored"`**, bien que la contrainte CHECK l'autorise : un event non résolu est écrit `failed` (commité), ce qui alimente la branche de retry.
5. **Le state du sandbox est en mémoire, par process.** Les records et les clés d'idempotence disparaissent au redémarrage et ne sont pas partagés entre instances. C'est une limite assumée du sandbox, pas de l'architecture : un vrai adaptateur garde l'état chez son provider et le relit en HTTP.
6. **`PAYMENT` et `TRANSFER` existent dans le vocabulaire `PROVIDER_CAPABILITIES` mais ne sont ni utilisés par l'engine ni déclarés par le sandbox.**
7. **Asymétrie `reversed`.** `toOperationResult`, `toStatusResult` et `listTransactions` ramènent `reversed` à `failed`, mais `handleWebhook` laisse passer `status: "reversed"`, que `outcomeToStatus` accepte en interne. Une lecture directe ne peut donc jamais rapporter `reversed` ; un webhook si.
8. **`listProviderAccountsForUser` renvoie des lignes non masquées.** Le masquage est appliqué à la frontière de sérialisation par `toPublicAccount`, dans la route. Un nouveau consommateur doit faire pareil.
9. **`EffectiveProviderConfig.supportedCountries` est déclaré mais jamais affecté** — il vaut toujours `undefined` à l'exécution. C'est le vestige de la correction de `supportedCurrencies`.
10. **`provider-config.ts` ne lit aucune ligne du registre `providers`.** Les paramètres `_slugRow` / `_slugRow2` de `toEffective` reçoivent tous deux `undefined` aux deux sites d'appel ; seul le premier est utilisé comme repli de nom.
11. **`providers` / `providerAssets` / `providerCredentials` / `providerTypes` ne sont importés par aucun fichier applicatif ou test.** Le registre est, en l'état, un schéma plus des migrations — pas une source de vérité consommée.
12. **`base.ts` mentionne « la suite de contrat partagée » que la CI attraperait** — elle n'existe pas, et le seul workflow CI (`.github/workflows/docker-publish.yml`) ne lance aucun test.
13. **`CHANGELOG.md` (section `0.3.0`, la version courante) annonce des actions d'administration de providers qui n'existent pas** : `src/app/api/providers/` est absent, et aucun `createProviderAction` / `updateProviderAction` / `testConnectionAction` n'existe dans `src/`.
14. **`POST /api/wallet/transactions/[id]/confirm` n'utilise pas `parseJsonBody`** : un corps malformé est silencieusement traité comme `{}`.
15. **Le docblock de `docs/admin-console-spec.md` s'arrête à la Phase 11** alors que les cinq pages wallet se décrivent comme « Phase 12 » (et `admin-shell.tsx:88-91` leur attribue `phase: 12`).
16. **L'expiration d'un refund est codée en dur à 900 s** et ignore volontairement `configuration.expirySeconds`.
17. **Un dépôt en `processing` n'est jamais expiré** par `expireStaleOperations`, et un retrait n'est expiré que tant qu'il est resté `created` : un retrait accepté est réglé par son webhook ou signalé par la réconciliation.

---

*Document maintenu avec le code : tout nouveau provider, toute nouvelle route wallet ou tout nouveau constat de réconciliation met à jour les sections concernées.*
