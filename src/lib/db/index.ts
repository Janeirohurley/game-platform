import postgres from "postgres";
import {
  drizzle,
  type PostgresJsDatabase,
} from "drizzle-orm/postgres-js";

/**
 * Database access is deliberately lazy.
 *
 * Next.js evaluates route modules during `next build` (page data
 * collection), in environments that intentionally carry no secrets —
 * Docker builds, CI. Throwing `DATABASE_URL is not defined` at import
 * time breaks those builds, so the connection is created on first real
 * use instead and misconfiguration still fails loudly, just at runtime.
 */

let client: postgres.Sql | null = null;

function getClient(): postgres.Sql {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined");
    }

    client = postgres(connectionString);
  }

  return client;
}

let database: PostgresJsDatabase | null = null;

/**
 * Drizzle database handle. Import-safe: nothing runs until the first
 * property access (e.g. `db.select(...)`), which only happens at runtime.
 */
export const db: PostgresJsDatabase = new Proxy(
  {} as PostgresJsDatabase,
  {
    get(_target, property) {
      database ??= drizzle(getClient());

      const value = Reflect.get(database, property, database);

      // Bind so destructuring (const { select } = db) keeps working.
      return typeof value === "function"
        ? value.bind(database)
        : value;
    },
  },
);
