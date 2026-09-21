"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { authClient } from "@/lib/auth-client";

type AuthContextValue = {
  session: typeof authClient.$Infer.Session | null;
  isPending: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const {
    data: session,
    isPending,
    error,
    refetch,
  } = authClient.useSession();

  return (
    <AuthContext.Provider
      value={{
        session,
        isPending,
        error,
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside <AuthProvider>.",
    );
  }

  return context;
}