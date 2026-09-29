import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Same auth client as before, with the admin plugin mirrored so the
 * typed admin helpers (listUsers, banUser, setRole…) are available to
 * future admin surfaces. The plugin alone grants nothing — the server
 * enforces the role on every call.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
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