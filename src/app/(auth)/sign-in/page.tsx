"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  EyeOffIcon,
  Mail01Icon,
  LockPasswordIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import AuthShell, { AUTH_DICE_PALETTES } from "@/components/auth/auth-shell";
import MagicLinkForm from "@/components/auth/magic-link-form";
import Dice from "@/components/dice";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth/errors";
import { sanitizeCallbackUrl } from "@/lib/validation/redirect";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

type SignInMethod = "magic" | "password";

const tabClass =
  "rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none aria-selected:bg-slate-950 aria-selected:text-white dark:aria-selected:bg-white dark:aria-selected:text-black";

export default function SignInPage() {
  return (
    <Suspense
      fallback={<div className="min-h-svh bg-slate-50 dark:bg-[#05070b]" />}
    >
      <SignInContent />
    </Suspense>
  );
}

function SignInTabs({
  method,
  onChange,
}: {
  method: SignInMethod;
  onChange: (method: SignInMethod) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Méthode de connexion"
      className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5"
    >
      <button
        type="button"
        role="tab"
        id="tab-magic"
        aria-selected={method === "magic"}
        aria-controls="panel-magic"
        onClick={() => onChange("magic")}
        className={tabClass}
      >
        Lien magique
      </button>

      <button
        type="button"
        role="tab"
        id="tab-password"
        aria-selected={method === "password"}
        aria-controls="panel-password"
        onClick={() => onChange("password")}
        className={tabClass}
      >
        Mot de passe
      </button>
    </div>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();

  /*
   * Internal return path, when the visitor came from an auth-required
   * popup ("Procéder à la connexion"). Validated centrally — an open
   * redirect is never acceptable.
   */
  const redirectTo = sanitizeCallbackUrl(searchParams.get("redirect"));

  // A magic-link verification failure bounces back here with ?error=CODE.
  const errorCode = searchParams.get("error");

  const [method, setMethod] = useState<SignInMethod>("magic");

  return (
    <AuthShell
      heading="Bon retour."
      description="Connecte-toi pour retrouver les joueurs, rejoindre des parties et continuer à jouer."
      visual={
        <Dice
          colorAnimation={{
            enabled: true,
            duration: 5000,
            palettes: AUTH_DICE_PALETTES,
          }}
        />
      }
      footerTitle="Game Arena"
      footerText="Trouve quelqu'un. Choisis un jeu. Joue."
    >
      {errorCode && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
        >
          {describeAuthError({ code: errorCode })}
        </div>
      )}

      <SignInTabs method={method} onChange={setMethod} />

      {method === "magic" ? (
        <div id="panel-magic" role="tabpanel" aria-labelledby="tab-magic">
          <MagicLinkForm
            mode="sign-in"
            callbackURL={redirectTo}
            errorCallbackURL={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}
          />
        </div>
      ) : (
        <div id="panel-password" role="tabpanel" aria-labelledby="tab-password">
          <PasswordSignIn redirectTo={redirectTo} />
        </div>
      )}

      <p className="mt-7 text-center text-sm text-slate-400 dark:text-white/35">
        Pas encore de compte ?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-slate-800 hover:underline dark:text-white/80"
        >
          Créer un compte
        </Link>
      </p>
    </AuthShell>
  );
}

function PasswordSignIn({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
    mode: "onSubmit",
  });

  async function onSubmit(data: SignInInput) {
    clearErrors("root.server");

    const { error } = await authClient.signIn.email({
      email: data.email,
      password: data.password,
      rememberMe: data.rememberMe,
      callbackURL: redirectTo,
    });

    if (error) {
      setError("root.server", {
        type: "server",
        message: describeAuthError(error),
      });

      return;
    }

    router.push(redirectTo);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          Adresse e-mail
        </label>

        <div className="relative">
          <HugeiconsIcon
            icon={Mail01Icon}
            size={18}
            strokeWidth={1.7}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
          />

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="toi@exemple.com"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
            className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pr-4 pl-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400 dark:border-white/10 dark:bg-white/3 dark:placeholder:text-white/25"
            {...register("email")}
          />
        </div>

        {errors.email && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium">
            Mot de passe
          </label>

          <Link
            href="/forgot-password"
            className="text-xs text-slate-400 transition hover:text-slate-950 dark:text-white/35 dark:hover:text-white"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <div className="relative">
          <HugeiconsIcon
            icon={LockPasswordIcon}
            size={18}
            strokeWidth={1.7}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
          />

          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Ton mot de passe"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pr-11 pl-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400 dark:border-white/10 dark:bg-white/3 dark:placeholder:text-white/25"
            {...register("password")}
          />

          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            disabled={isSubmitting}
            aria-label={
              showPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30 dark:hover:text-white"
          >
            <HugeiconsIcon
              icon={showPassword ? EyeOffIcon : EyeIcon}
              size={18}
              strokeWidth={1.7}
            />
          </button>
        </div>

        {errors.password && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 dark:text-white/45">
        <input
          type="checkbox"
          disabled={isSubmitting}
          className="size-4 rounded border-slate-300 accent-cyan-500 disabled:cursor-not-allowed dark:border-white/20"
          {...register("rememberMe")}
        />
        Rester connecté
      </label>

      {errors.root?.server && (
        <p role="alert" className="text-sm text-red-500 dark:text-red-400">
          {errors.root.server.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:focus-visible:ring-offset-[#05070b]"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            Connexion...
          </>
        ) : (
          <>
            Se connecter
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={17}
              strokeWidth={1.7}
              className="ml-2"
            />
          </>
        )}
      </button>
    </form>
  );
}
