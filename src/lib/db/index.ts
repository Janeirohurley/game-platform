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

    client = postgres(connectionString, {
      /*
       * The DATABASE_URL points at the Supabase POOLER (transaction
       * mode, :6543), which reassigns the underlying server connection
       * on every transaction. Prepared statements are keyed to one
       * specific server session, so they break with "prepared statement
       * already exists"-class failures and stale pooled sockets can
       * leave queries hanging forever — which surface in the UI as an
       * admin section stuck "loading". Prepared statements are the
       * main win they disable, so switch them off; latency stays
       * dominated by the network round-trip either way.
       */
      prepare: false,
      /*
       * Recycle sockets aggressively: the pooler silently closes idle
       * server-side, and postgres.js defaults (idle forever) mean the
       * pool fills with dead sockets that stall the next borrower.
       */
      idle_timeout: 20,
      max_lifetime: 60 * 10,
      connect_timeout: 10,
    });
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
