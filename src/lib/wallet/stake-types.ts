/**
 * Game-stake status vocabularies — pure constants (no DB imports).
 *
 * These live here so the schema, the service and the API all agree on
 * the exact strings. CHECK constraints in the schema are built from the
 * SQL-interpolated lists below (same pattern as wallet constants).
 */

export const MATCH_STAKE_STATUSES = [
  "open",
  "funded",
  "playing",
  "settled",
  "void",
] as const;

export type MatchStakeStatus = (typeof MATCH_STAKE_STATUSES)[number];

export const MATCH_STAKE_HOLD_STATUSES = [
  "held",
  "released",
  "forfeited",
  "paid",
] as const;

export type MatchStakeHoldStatus = (typeof MATCH_STAKE_HOLD_STATUSES)[number];

export const MATCH_STAKE_STATUS_SQL = MATCH_STAKE_STATUSES
  .map((s) => `'${s}'`)
  .join(", ");

export const MATCH_STAKE_HOLD_STATUS_SQL = MATCH_STAKE_HOLD_STATUSES
  .map((s) => `'${s}'`)
  .join(", ");
