"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  EyeIcon,
  EyeOffIcon,
  LockPasswordIcon,
  Mail01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import AuthShell from "@/components/auth/auth-shell";
import MagicLinkForm from "@/components/auth/magic-link-form";
import PlayingCard from "@/components/playing-card";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth/errors";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={<div className="min-h-svh bg-slate-50 dark:bg-[#05070b]" />}
    >
      <SignUpContent />
    </Suspense>
  );
}

type SignUpMethod = "magic" | "password";

const inputClass =
  "h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400 dark:border-white/10 dark:bg-white/3 dark:placeholder:text-white/25";

function SignUpTabs({
  method,
  onChange,
}: {
  method: SignUpMethod;
  onChange: (method: SignUpMethod) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Méthode d'inscription"
      className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5"
    >
      <button
        type="button"
        role="tab"
        id="tab-magic"
        aria-selected={method === "magic"}
        aria-controls="panel-magic"
        onClick={() => onChange("magic")}
        className="rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none aria-selected:bg-slate-950 aria-selected:text-white dark:aria-selected:bg-white dark:aria-selected:text-black"
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
        className="rounded-md px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none aria-selected:bg-slate-950 aria-selected:text-white dark:aria-selected:bg-white dark:aria-selected:text-black"
      >
        Mot de passe
      </button>
    </div>
  );
}

function SignUpContent() {
  const [method, setMethod] = useState<SignUpMethod>("magic");

  return (
    <AuthShell
      accent="violet"
      heading="Crée ton compte."
      description="Rejoins la communauté, trouve des joueurs et lance des parties en temps réel."
      visual={<PlayingCard />}
      footerTitle="Rejoins Game Arena"
      footerText="Trouve des joueurs. Choisis un jeu. Joue."
    >
      <SignUpTabs method={method} onChange={setMethod} />

      {method === "magic" ? (
        <div id="panel-magic" role="tabpanel" aria-labelledby="tab-magic">
          <MagicLinkForm
            mode="sign-up"
            callbackURL="/games"
            newUserCallbackURL="/games"
            errorCallbackURL="/sign-up"
          />
        </div>
      ) : (
        <div id="panel-password" role="tabpanel" aria-labelledby="tab-password">
          <PasswordSignUp />
        </div>
      )}

      <p className="mt-7 text-center text-sm text-slate-400 dark:text-white/35">
        Déjà un compte ?{" "}
        <Link
          href="/sign-in"
          className="font-medium text-slate-800 hover:underline dark:text-white/80"
        >
          Se connecter
        </Link>
      </p>
    </AuthShell>
  );
}

function PasswordSignUp() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptedLegal: false,
    },
    mode: "onSubmit",
  });

  async function onSubmit(data: SignUpInput) {
    clearErrors("root.server");

    const { error } = await authClient.signUp.email({
      name: data.username,
      email: data.email,
      password: data.password,
      callbackURL: "/games",
    });

    if (error) {
      setError("root.server", {
        type: "server",
        message: describeAuthError(error),
      });

      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Username */}
      <div>
        <label htmlFor="username" className="mb-2 block text-sm font-medium">
          Pseudo
        </label>

        <div className="relative">
          <HugeiconsIcon
            icon={UserIcon}
            size={18}
            strokeWidth={1.7}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
          />

          <input
            id="username"
            type="text"
            autoComplete="username"
            placeholder="Choisis un pseudo"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.username)}
            className={`${inputClass} pr-4`}
            {...register("username")}
          />
        </div>

        {errors.username && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.username.message}
          </p>
        )}
      </div>

      {/* Email */}
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
            className={`${inputClass} pr-4`}
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

      {/* Password */}
      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium">
          Mot de passe
        </label>

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
            autoComplete="new-password"
            placeholder="Choisis un mot de passe"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.password)}
            className={`${inputClass} pr-11`}
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

      {/* Confirm password */}
      <div>
        <label
          htmlFor="confirm-password"
          className="mb-2 block text-sm font-medium"
        >
          Confirme le mot de passe
        </label>

        <div className="relative">
          <HugeiconsIcon
            icon={LockPasswordIcon}
            size={18}
            strokeWidth={1.7}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
          />

          <input
            id="confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Répète ton mot de passe"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.confirmPassword)}
            className={`${inputClass} pr-11`}
            {...register("confirmPassword")}
          />

          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            disabled={isSubmitting}
            aria-label={
              showConfirmPassword
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30 dark:hover:text-white"
          >
            <HugeiconsIcon
              icon={showConfirmPassword ? EyeOffIcon : EyeIcon}
              size={18}
              strokeWidth={1.7}
            />
          </button>
        </div>

        {errors.confirmPassword && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* Terms */}
      <div>
        <label className="flex items-start gap-2 text-xs leading-5 text-slate-400 dark:text-white/35">
          <input
            type="checkbox"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.acceptedLegal)}
            className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-cyan-500 disabled:cursor-not-allowed aria-[invalid=true]:outline aria-[invalid=true]:outline-1 aria-[invalid=true]:outline-red-400 dark:border-white/20"
            {...register("acceptedLegal")}
          />

          <span>
            J&apos;accepte les{" "}
            <Link
              href="/terms"
              className="text-slate-700 hover:underline dark:text-white/70"
            >
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link
              href="/privacy"
              className="text-slate-700 hover:underline dark:text-white/70"
            >
              politique de confidentialité
            </Link>
            .
          </span>
        </label>

        {errors.acceptedLegal && (
          <p
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.acceptedLegal.message}
          </p>
        )}
      </div>

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
            Création...
          </>
        ) : (
          <>
            Créer mon compte
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
