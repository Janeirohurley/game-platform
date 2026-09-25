import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import * as authSchema from "@/lib/db/schema/auth";

import { db } from "@/lib/db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

/**
 * Origins allowed to call the auth API. The list is resolved from the
 * environment at startup, so it can change per deployment without touching
 * this file:
 *
 * - `BETTER_AUTH_URL` is always trusted (Better Auth trusts its own base URL);
 * - outside production, every `localhost` / `127.0.0.1` port is trusted — the
 *   dev server runs with `next dev --experimental-https` and its port can
 *   shift (3000, 3001, 3002…);
 * - `AUTH_TRUSTED_ORIGINS` adds a comma-separated list, wildcards allowed,
 *   e.g. `https://*.trycloudflare.com,http://192.168.1.42:3000`;
 * - `AUTH_ALLOW_ANY_ORIGIN=true` trusts every origin. Testing escape hatch
 *   only: it turns off the CSRF origin check, so leave it unset on a real
 *   deployment.
 */
const isProduction = process.env.NODE_ENV === "production";
const allowAnyOrigin = process.env.AUTH_ALLOW_ANY_ORIGIN === "true";

if (allowAnyOrigin && isProduction) {
  console.warn(
    "[auth] AUTH_ALLOW_ANY_ORIGIN=true in a production build: every origin is trusted and the CSRF origin check is off. Unset it before going live.",
  );
}

const localOrigins = isProduction
  ? []
  : [
      "http://localhost:*",
      "https://localhost:*",
      "http://127.0.0.1:*",
      "https://127.0.0.1:*",
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