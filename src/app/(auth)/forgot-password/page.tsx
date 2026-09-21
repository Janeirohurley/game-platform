"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Mail01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";
import { authClient } from "@/lib/auth-client";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/auth";

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

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(data: ForgotPasswordInput) {
    setError("root.server", {
      type: "server",
      message: "",
    });

    const { error } = await authClient.requestPasswordReset({
      email: data.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("root.server", {
        type: "server",
        message:
          error.message || "Unable to send the reset link. Please try again.",
      });

      return;
    }

    setSubmittedEmail(data.email);
    setSubmitted(true);
  }

  function handleTryAnotherEmail() {
    setSubmitted(false);
    setSubmittedEmail("");
    reset({
      email: "",
    });
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <GameUniverseBackground />

      <div className="relative z-20 min-h-svh">
        {/* Top navigation */}
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-950 dark:text-white/55 dark:hover:text-white"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={17} strokeWidth={1.7} />
            Back to sign in
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

                {!submitted ? (
                  <>
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Forgot your password?
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                      Enter the email associated with your account and we'll
                      send you a link to reset your password.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex size-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={23}
                        strokeWidth={1.7}
                      />
                    </div>

                    <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                      Check your email.
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                      If an account exists for{" "}
                      <span className="font-medium text-slate-800 dark:text-white/80">
                        {submittedEmail}
                      </span>
                      , we've sent instructions to reset your password.
                    </p>
                  </>
                )}
              </div>

              {!submitted ? (
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-5"
                  noValidate
                >
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
                        aria-invalid={Boolean(errors.email)}
                        {...register("email")}
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                      />
                    </div>

                    {errors.email ? (
                      <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                        {errors.email.message}
                      </p>
                    ) : null}
                  </div>

                  {errors.root?.server?.message ? (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"
                    >
                      {errors.root.server.message}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-black/20 dark:border-t-black" />
                        Sending...
                      </>
                    ) : (
                      <>
                        Send reset link
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
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleTryAnotherEmail}
                    className="flex h-12 w-full items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80 dark:hover:bg-white/[0.06]"
                  >
                    Try another email
                  </button>
                </div>
              )}

              <p className="mt-7 text-center text-sm text-slate-400 dark:text-white/35">
                Remember your password?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-slate-800 hover:underline dark:text-white/80"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* 3D scene */}
          <div className="relative hidden min-h-[calc(100svh-4rem)] items-center justify-center lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.06),transparent_55%)]" />

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
                Get back in the game.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
