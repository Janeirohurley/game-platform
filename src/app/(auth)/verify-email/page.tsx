"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";
import { authClient } from "@/lib/auth-client";
import {
  verifyEmailSchema,
  type VerifyEmailInput,
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

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") ?? "";

  const [resent, setResent] = useState(false);

  const form = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email: emailFromUrl,
    },
  });

  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(data: VerifyEmailInput) {
    clearErrors("root.server");
    setResent(false);

    const { error } = await authClient.sendVerificationEmail({
      email: data.email,
      callbackURL: "/games",
    });

    if (error) {
      setError("root.server", {
        type: "server",
        message: error.message || "Unable to resend the verification email.",
      });

      return;
    }

    setResent(true);
  }

  const email = emailFromUrl || "your email address";

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
          {/* Content */}
          <div className="flex items-center px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-md text-center lg:text-left">
              {/* Small logo */}
              <Link
                href="/"
                className="mb-8 inline-flex items-center gap-2 text-sm font-semibold tracking-wide"
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

              {/* Icon */}
              <div className="flex justify-center lg:justify-start">
                <div className="flex size-14 items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    size={27}
                    strokeWidth={1.6}
                  />
                </div>
              </div>

              <h1 className="mt-7 text-3xl font-semibold tracking-tight sm:text-4xl">
                Verify your email.
              </h1>

              <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-white/45">
                We&apos;ve sent a verification link to
              </p>

              <p className="mt-1 break-all text-sm font-medium text-slate-900 dark:text-white/80">
                {email}
              </p>

              <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-slate-500 dark:text-white/40">
                Open the email and click the verification link to activate your
                Game Arena account.
              </p>

              {/* Status */}
              {resent && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-600 lg:justify-start dark:text-emerald-300">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={16}
                    strokeWidth={1.7}
                  />
                  Verification email sent again.
                </div>
              )}

              {errors.root?.server && (
                <p
                  role="alert"
                  className="mt-6 text-sm text-red-500 dark:text-red-400"
                >
                  {errors.root.server.message}
                </p>
              )}

              {/* Actions */}
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="mt-8 flex flex-col gap-3"
              >
                <button
                  type="submit"
                  disabled={isSubmitting || !emailFromUrl}
                  aria-busy={isSubmitting}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/75 dark:hover:bg-white/[0.06]"
                >
                  <HugeiconsIcon
                    icon={Refresh01Icon}
                    size={17}
                    strokeWidth={1.7}
                    className="mr-2"
                  />

                  {isSubmitting ? "Sending..." : "Resend verification email"}
                </button>

                <Link
                  href="/sign-in"
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  Continue to sign in
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={17}
                    strokeWidth={1.7}
                    className="ml-2"
                  />
                </Link>
              </form>

              {errors.email && (
                <p
                  role="alert"
                  className="mt-3 text-xs text-red-500 dark:text-red-400"
                >
                  {errors.email.message}
                </p>
              )}

              {/* Help */}
              <div className="mt-8 border-t border-slate-200 pt-6 text-sm text-slate-400 dark:border-white/10 dark:text-white/35">
                <p>Didn&apos;t receive it?</p>

                <p className="mt-2">
                  Check your spam folder or{" "}
                  {emailFromUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        void form.handleSubmit(onSubmit)();
                      }}
                      disabled={isSubmitting}
                      className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white/70 dark:hover:text-white"
                    >
                      send it again
                    </button>
                  ) : (
                    <span>return to sign up and try again.</span>
                  )}
                  .
                </p>
              </div>
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
                One more step before you play.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
