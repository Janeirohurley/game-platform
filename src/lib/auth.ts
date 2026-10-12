import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin, magicLink } from "better-auth/plugins";
import * as authSchema from "@/lib/db/schema/auth";

import { db } from "@/lib/db";
import {
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "./email";

/**
 * Origins allowed to call the auth API. The list is resolved from the
 * environment at startup, so it can change per deployment without touching
 * this file:
 *
 * - `BETTER_AUTH_URL` is always trusted (Better Auth trusts its own base URL);
 * - outside production, every loopback port is trusted — the dev server
 *   runs with `next dev --experimental-https` and its port can shift
 *   (3000, 3001, 3002…);
 * - a LAN address is trusted too, so the app can be opened from a phone
 *   or a second machine during development;
 * - `AUTH_TRUSTED_ORIGINS` adds a comma-separated list, wildcards allowed,
 *   e.g. `https://*.trycloudflare.com,http://192.168.1.42:3000`;
 * - `AUTH_ALLOW_ANY_ORIGIN=true` trusts every origin. Testing escape hatch
 *   only: it turns off the CSRF origin check, so leave it unset on a real
 *   deployment.
 */
const isProduction = process.env.NODE_ENV === "production";
// "AUTH_ALLOW_ANY_ORIGIN=true" is a dev/test escape hatch: it trusts every
// origin and disables the CSRF origin check. It is deliberately ignored in
// production, so a real deployment can never be opened to arbitrary origins.
const allowAnyOrigin = !isProduction && process.env.AUTH_ALLOW_ANY_ORIGIN === "true";

const localOrigins = isProduction
  ? []
  : [
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
      // Private-network ranges, so the app opened from a phone or a
      // second machine on the same Wi-Fi is trusted without having to
      // name each address. Development only — this whole list is empty
      // in production, where BETTER_AUTH_URL and AUTH_TRUSTED_ORIGINS
      // decide.
      "http://192.168.*.*:*",
      "https://192.168.*.*:*",
      "http://10.*.*.*:*",
      "https://10.*.*.*:*",
    ];

const configuredOrigins = (process.env.AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim());

const trustedOrigins = allowAnyOrigin
  ? ["*"]
  : [process.env.BETTER_AUTH_URL, ...localOrigins, ...configuredOrigins].filter(
      (origin): origin is string => Boolean(origin),
    );

export const auth = betterAuth({
  trustedOrigins: [...new Set(trustedOrigins)],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),

  /*
   * Platform administration (the /admin control plane): role-based
   * authorization on top of the SAME session system — no second auth,
   * no parallel permission store. The `role` column lives on `user`
   * (schema/auth.ts). Accounts created before the column existed get
   * the default role from the hook below.
   */
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),

    /*
     * Passwordless sign-in / sign-up — the SAME mechanism for both.
     *
     * A link establishes a session directly, so the visitor never needs
     * a password. Existing accounts are signed in; unknown addresses get
     * an account created on first verification (email already proven by
     * the click). Better Auth consumes the token atomically (single use)
     * and stores only its hash here, so a leaked database row cannot be
     * replayed. The server-side origin check on `/magic-link/verify`
     * rejects callback URLs outside `trustedOrigins`.
     *
     * The plugin's own rate limit (5 requests / IP / minute) is applied
     * on top of Better Auth's global rate limiter, which is on by
     * default in production.
     */
    magicLink({
      expiresIn: 60 * 10, // 10 minutes
      storeToken: "hashed",
      disableSignUp: false,
      rateLimit: { window: 60, max: 5 },

      sendMagicLink: async ({ email, url, metadata }) => {
        await sendMagicLinkEmail({
          to: email,
          url,
          username:
            typeof metadata?.name === "string" ? metadata.name : undefined,
        });
      },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        async before(user) {
          // Backfill the default role for users created without one.
          return { data: { ...user, role: user.role ?? "user" } };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,

    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        username: user.name,
        url,
      });
    },
  },


  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        username: user.name,
        url,
      });
    },
  },


  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
});