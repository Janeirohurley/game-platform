import { createAuthClient } from "better-auth/react";
import { adminClient, magicLinkClient } from "better-auth/client/plugins";

/**
 * Same auth client as before, with the admin plugin mirrored so the
 * typed admin helpers (listUsers, banUser, setRole…) are available to
 * future admin surfaces. The plugin alone grants nothing — the server
 * enforces it.
 *
 * `magicLinkClient` mirrors the server plugin so `authClient.signIn.magicLink`
 * (request a link) and `authClient.magicLink.verify` (redeem a token) are
 * typed. It reuses the same session system — no parallel auth.
 */
export const authClient = createAuthClient({
  plugins: [adminClient(), magicLinkClient()],
});


export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
} = authClient;