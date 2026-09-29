/**
 * Create (or promote) a platform administrator.
 *
 * The `/admin` control plane is gated on `user.role === "admin"`, a column
 * owned by the better-auth admin plugin (src/lib/auth.ts). This script is the
 * bootstrap: it provisions that very first account — or repairs an existing
 * one — without going through the UI, because the UI itself requires an admin.
 *
 * What it guarantees:
 * - a real credential account (password hashed by better-auth, never stored
 *   in clear here);
 * - `role = "admin"`, so `requireAdminSession()` lets it through;
 * - `emailVerified = true`, so `requireEmailVerification` (src/lib/auth.ts)
 *   doesn't lock the account out of the /admin surface.
 *
 * Usage:
 *
 *   bun run admin:create -- --email admin@example.com --password 's3cret' --name Admin
 *
 * Every argument can also come from the environment (ADMIN_EMAIL,
 * ADMIN_PASSWORD, ADMIN_NAME), which is what a deploy pipeline or a Docker
 * entrypoint should use instead of passing secrets on the command line.
 *
 * Re-running on an existing account is safe: the role and the verified flag
 * are re-asserted and the password is reset, so it doubles as a recovery tool
 * ("I lost the admin password"). Existing sessions are NOT revoked.
 */

import "dotenv/config";

import { auth } from "@/lib/auth";

/*
 * Mirrors `emailAndPassword` in src/lib/auth.ts. Creating an account that
 * could never pass the server's own sign-in would be a silent trap, so the
 * same bounds are enforced here, up front.
 */
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const ADMIN_ROLE = "admin";

interface Cli {
  email: string;
  password: string;
  /** Undefined when neither --name nor ADMIN_NAME was given. */
  name: string | undefined;
}

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/**
 * Minimal `--flag value` parser. Everything also reads from the environment,
 * so an unparseable argv is not fatal on its own.
 */
function parseArgs(argv: string[]): Map<string, string> {
  const parsed = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const [flag, inlineValue] = token.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];

    if (inlineValue === undefined) {
      index += 1;
    }

    parsed.set(flag, value ?? "");
  }

  return parsed;
}

function readCredentials(): Cli {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.get("email") ?? process.env.ADMIN_EMAIL ?? "").trim();
  const password = args.get("password") ?? process.env.ADMIN_PASSWORD ?? "";
  const name = (args.get("name") ?? process.env.ADMIN_NAME ?? "").trim();

  if (!email) {
    fail(
      "Missing email. Pass --email admin@example.com or set ADMIN_EMAIL in the environment.",
    );
  }

  // Deliberately not RFC-complete: enough to catch a typo or a pasted
  // username, without pretending to be a full RFC 5322 parser.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`"${email}" is not a valid email address.`);
  }

  if (!password) {
    fail(
      "Missing password. Pass --password 'your-password' or set ADMIN_PASSWORD in the environment.",
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(
      `Password too short: ${password.length} characters, minimum is ${MIN_PASSWORD_LENGTH}.`,
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    fail(
      `Password too long: ${password.length} characters, maximum is ${MAX_PASSWORD_LENGTH}.`,
    );
  }

  return {
    email: email.toLowerCase(),
    password,
    // Left undefined when not asked for, so re-running on an existing account
    // never renames it by accident.
    name: name || undefined,
  };
}

async function main() {
  const { email, password, name } = readCredentials();

  console.log("\n== Création du compte administrateur ==\n");

  /*
   * The internal adapter is better-auth's own creation seam: it runs the same
   * databaseHooks as sign-up (so the `role` default backfill applies), hashes
   * nothing itself, and needs no HTTP request — unlike `auth.api.signUpEmail`,
   * which would also fire the verification email this script exists to skip.
   */
  const context = await auth.$context;
  const { internalAdapter, password: hasher } = context;

  const existing = await internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });

  const hashedPassword = await hasher.hash(password);

  if (existing) {
    const { user: current } = existing;

    const updated = await internalAdapter.updateUser(current.id, {
      role: ADMIN_ROLE,
      emailVerified: true,
      ...(name ? { name } : {}),
    });

    /*
     * An account that signed up through a social provider has no credential
     * account to update, so link one instead — otherwise the password just
     * given would be silently ignored at sign-in.
     */
    const credential = await internalAdapter.findCredentialAccount(current.id);

    if (credential) {
      await internalAdapter.updatePassword(current.id, hashedPassword);
    } else {
      await internalAdapter.linkAccount({
        userId: current.id,
        providerId: "credential",
        accountId: current.id,
        password: hashedPassword,
      });
    }

    console.log(`   Compte existant mis à jour : ${updated.email}`);
    console.log(`   Rôle forcé sur « ${updated.role} », email vérifié.`);
    console.log("   Mot de passe réinitialisé (sessions actives conservées).");
  } else {
    const created = await internalAdapter.createUser(
      {
        email,
        // `user.name` is NOT NULL: a new account always needs one, so the
        // email's local part is the fallback here (never on the update path,
        // where an absent --name must leave the existing name alone).
        name: name ?? (email.split("@")[0] ?? "Admin"),
        role: ADMIN_ROLE,
        emailVerified: true,
      },
      { method: "admin" },
    );

    await internalAdapter.linkAccount({
      userId: created.id,
      providerId: "credential",
      accountId: created.id,
      password: hashedPassword,
    });

    console.log(`   Administrateur créé : ${created.email}`);
    console.log(`   Nom : ${created.name}`);
    console.log(`   Rôle : ${created.role} · email vérifié`);
  }

  console.log("\n✅ Terminé — connectez-vous sur /admin avec ces identifiants.\n");
}

try {
  await main();
} catch (error) {
  console.error("\n❌ Échec de la création de l'administrateur\n");
  console.error(error);
  process.exit(1);
}
