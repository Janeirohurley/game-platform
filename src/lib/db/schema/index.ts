/**
 * Barrel for the Drizzle schema.
 *
 * `lib/auth.ts` deliberately imports only `./auth` (Better Auth must not
 * know about gaming tables); everything the platform needs — auth tables
 * AND gamer profile tables — is re-exported here for queries, drizzle-kit
 * (`drizzle.config.ts` globs this directory) and migrations.
 */
export * from "./auth";
export * from "./profiles";
export * from "./audit";
export * from "./wallet";
