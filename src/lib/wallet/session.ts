/**
 * Session guards for the wallet API layer. Every money endpoint runs
 * `requireWalletSession` before touching any data — authorization is
 * always re-verified server-side, never trusted from the client.
 */

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { WalletError } from "./errors";

export interface WalletSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface WalletSession {
  user: WalletSessionUser;
}

/** Returns the session or null (reads). Accepts request headers. */
export async function getWalletSession(
  requestHeaders?: Headers,
): Promise<WalletSession | null> {
  const session = await auth.api.getSession({
    headers: requestHeaders ?? (await headers()),
  });
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role ?? "user",
    },
  };
}

/** Throws a typed 401 when anonymous (writes). */
export async function requireWalletSession(
  requestHeaders?: Headers,
): Promise<WalletSession> {
  const session = await getWalletSession(requestHeaders);
  if (!session) {
    throw new WalletError("unauthorized", "You must be signed in.");
  }
  return session;
}
