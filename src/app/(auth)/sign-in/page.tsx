"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  EyeIcon,
  EyeOffIcon,
  Mail01Icon,
  LockPasswordIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";
import { authClient } from "@/lib/auth-client";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";

const dicePalettes = [
  {
    body: "#5bd8f3",
    pip: "#07101b",
    light: "#63dcff",
  },
  {
    body: "#bd67ff",
    pip: "#08040e",
    light: "#c77dff",
  },
  {
    body: "#ffad4d",
    pip: "#161006",
    light: "#ffb45c",
  },
];

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-slate-50 dark:bg-[#05070b]" />}>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /*
   * Internal return path, when the visitor came from an auth-required
   * popup ("Procéder à la connexion"). Only same-origin paths qualify —
   * an open redirect is never acceptable.
   */
  const rawRedirect = searchParams.get("redirect");
  const redirectTo =
    rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/games";

  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    mode: "onSubmit",
  });

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;

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
        message: error.message || "Unable to sign in. Please try again.",
      });

      return;
    }

    router.push(redirectTo);
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20 min-h-svh">
        {/* Top navigation */}
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950 dark:text-white/55 dark:hover:text-white"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={17} strokeWidth={1.7} />
            Back to Game Arena
          </Link>
        </div>

        <section className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Form */}
          <div className="flex items-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8">
                <Link
                  href="/"
                  className="mb-6 inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
                >
                  <span className="relative size-8 shrink-0">
                    <Dice
                      size={2.1}
                      clickable={false}
                      autoRotate
                      autoRotateSpeed={0.5}
                      style={{
                        minHeight: 0,
                        width: "100%",
                        height: "100%",
                      }}
                      colorAnimation={{
                        enabled: true,
                        duration: 4000,
                        palettes: dicePalettes,
                      }}
                    />
                  </span>

                  <span>Game Arena</span>
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Welcome back.
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                  Sign in to find players, join matches and continue playing.
                </p>
              </div>

              <form
                className="space-y-5"
                onSubmit={handleSubmit(onSubmit)}
                noValidate
              >
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-medium"
                  >
                    Email
                  </label>

                  <div className="relative">
                    <HugeiconsIcon
                      icon={Mail01Icon}
                      size={18}
                      strokeWidth={1.7}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                    />

                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.email}
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400 dark:border-white/10 dark:bg-white/3 dark:placeholder:text-white/25"
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
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium"
                    >
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs text-slate-400 transition hover:text-slate-950 dark:text-white/35 dark:hover:text-white"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <HugeiconsIcon
                      icon={LockPasswordIcon}
                      size={18}
                      strokeWidth={1.7}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                    />

                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      disabled={isSubmitting}
                      aria-invalid={!!errors.password}
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-red-400 dark:border-white/10 dark:bg-white/3 dark:placeholder:text-white/25"
                      {...register("password")}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      disabled={isSubmitting}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/30 dark:hover:text-white"
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

                {/* Remember */}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500 dark:text-white/45">
                  <input
                    type="checkbox"
                    disabled={isSubmitting}
                    className="size-4 rounded border-slate-300 accent-cyan-500 disabled:cursor-not-allowed dark:border-white/20"
                    {...register("rememberMe")}
                  />
                  Remember me
                </label>

                {/* Server error */}
                {errors.root?.server && (
                  <p
                    role="alert"
                    className="text-sm text-red-500 dark:text-red-400"
                  >
                    {errors.root.server.message}
                  </p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  {isSubmitting ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in
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

              {/* Signup */}
              <p className="mt-7 text-center text-sm text-slate-400 dark:text-white/35">
                Don&apos;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-medium text-slate-800 hover:underline dark:text-white/80"
                >
                  Create one
                </Link>
              </p>
            </div>
          </div>

          {/* 3D Scene */}
          <div className="relative hidden min-h-[calc(100svh-4rem)] items-center justify-center lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_55%)]" />

            <div className="relative size-[min(42vw,520px)]">
              <Dice
                clickable
                autoRotate
                autoRotateSpeed={0.35}
                style={{
                  minHeight: 0,
                  width: "100%",
                  height: "100%",
                }}
                colorAnimation={{
                  enabled: true,
                  duration: 5000,
                  palettes: dicePalettes,
                }}
              />
            </div>

            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/25">
                Game Arena
              </p>

              <p className="mt-2 text-sm text-slate-500 dark:text-white/40">
                Find someone. Pick a game. Play.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ```ts
// export const signInSchema = z.object({
//   email: z
//     .email("Please enter a valid email address.")
//     .transform((value) => value.trim().toLowerCase()),

//   password: z
//     .string()
//     .min(1, "Password is required."),

//   rememberMe: z.boolean().default(false),
// });

// export type SignInInput = z.infer<typeof signInSchema>;
// ```

// Le flux devient propre :

// ```text
// Email
// Password
// Remember me
//         ↓
// React Hook Form
//         ↓
// Zod
//         ↓
// authClient.signIn.email()
//         ↓
// Better Auth
//         ↓
// Session
//         ↓
// /games
// ```

// Et pour un utilisateur qui n'a pas encore vérifié son email :

// ```text
// signIn
//   ↓
// Better Auth
//   ↓
// 403
//   ↓
// /verify-email?email=...
// ```

// Une fois `SignInPage` remplacée, vérifie :

// ```bash
// bun run typecheck
// bun run lint
// ```

// Puis teste successivement un mauvais email, un mauvais mot de passe, un utilisateur non vérifié et enfin un compte vérifié.
