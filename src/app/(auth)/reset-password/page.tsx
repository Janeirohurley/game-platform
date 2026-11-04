"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  EyeOffIcon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";
import { authClient } from "@/lib/auth-client";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
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

function ResetPasswordContent() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const tokenError = searchParams.get("error");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isReset, setIsReset] = useState(false);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const password = useWatch({ control, name: "password", defaultValue: "" });
  const confirmPassword = useWatch({
    control,
    name: "confirmPassword",
    defaultValue: "",
  });

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  async function onSubmit(data: ResetPasswordInput) {
    if (!token) {
      setError("root.server", {
        type: "server",
        message:
          "This password reset link is missing or invalid. Please request a new one.",
      });

      return;
    }

    if (tokenError) {
      setError("root.server", {
        type: "server",
        message:
          "This password reset link is invalid or has expired. Please request a new one.",
      });

      return;
    }

    setError("root.server", {
      type: "server",
      message: "",
    });

    const { error } = await authClient.resetPassword({
      newPassword: data.password,
      token,
    });

    if (error) {
      setError("root.server", {
        type: "server",
        message:
          error.message ||
          "Unable to reset your password. Please request a new reset link.",
      });

      return;
    }

    setIsReset(true);
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

              {!isReset ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Reset your password.
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                      Choose a new password for your Game Arena account.
                    </p>
                  </div>

                  {tokenError ? (
                    <div
                      role="alert"
                      className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                    >
                      This password reset link is invalid or has expired. Please
                      request a new one.
                    </div>
                  ) : null}

                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-5"
                    noValidate
                  >
                    {/* New password */}
                    <div>
                      <label
                        htmlFor="password"
                        className="mb-2 block text-sm font-medium"
                      >
                        New password
                      </label>

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
                          autoComplete="new-password"
                          placeholder="Enter a new password"
                          disabled={isSubmitting || Boolean(tokenError)}
                          aria-invalid={Boolean(errors.password)}
                          {...register("password")}
                          className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 dark:text-white/30 dark:hover:text-white"
                        >
                          <HugeiconsIcon
                            icon={showPassword ? EyeOffIcon : EyeIcon}
                            size={18}
                            strokeWidth={1.7}
                          />
                        </button>
                      </div>

                      {errors.password ? (
                        <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">
                          {errors.password.message}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400 dark:text-white/30">
                          Use at least 8 characters.
                        </p>
                      )}
                    </div>

                    {/* Confirm password */}
                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="mb-2 block text-sm font-medium"
                      >
                        Confirm password
                      </label>

                      <div className="relative">
                        <HugeiconsIcon
                          icon={LockPasswordIcon}
                          size={18}
                          strokeWidth={1.7}
                          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                        />

                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Repeat your new password"
                          disabled={isSubmitting || Boolean(tokenError)}
                          aria-invalid={Boolean(errors.confirmPassword)}
                          {...register("confirmPassword")}
                          className={[
                            "h-12 w-full rounded-lg border bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/[0.03] dark:placeholder:text-white/25",
                            errors.confirmPassword ||
                            (confirmPassword.length > 0 && !passwordsMatch)
                              ? "border-rose-300 focus:border-rose-400 dark:border-rose-400/30"
                              : "border-slate-200 focus:border-cyan-400 dark:border-white/10",
                          ].join(" ")}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword((value) => !value)
                          }
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 dark:text-white/30 dark:hover:text-white"
                        >
                          <HugeiconsIcon
                            icon={showConfirmPassword ? EyeOffIcon : EyeIcon}
                            size={18}
                            strokeWidth={1.7}
                          />
                        </button>
                      </div>

                      {errors.confirmPassword ? (
                        <p className="mt-2 text-xs text-rose-500 dark:text-rose-400">
                          {errors.confirmPassword.message}
                        </p>
                      ) : passwordsMatch ? (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">
                          <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            size={13}
                            strokeWidth={1.7}
                          />
                          Passwords match.
                        </p>
                      ) : confirmPassword.length > 0 ? (
                        <p className="mt-2 text-xs text-rose-500">
                          Passwords do not match.
                        </p>
                      ) : null}
                    </div>

                    {errors.root?.server?.message ? (
                      <div
                        role="alert"
                        className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                      >
                        {errors.root.server.message}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={
                        isSubmitting || !passwordsMatch || Boolean(tokenError)
                      }
                      className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-black/20 dark:border-t-black" />
                          Updating password...
                        </>
                      ) : (
                        <>
                          Reset password
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

                  {tokenError ? (
                    <Link
                      href="/forgot-password"
                      className="mt-5 flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 bg-white/70 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white/80 dark:hover:bg-white/[0.06]"
                    >
                      Request a new reset link
                    </Link>
                  ) : null}
                </>
              ) : (
                <div>
                  <div className="flex size-14 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      size={28}
                      strokeWidth={1.6}
                    />
                  </div>

                  <h1 className="mt-7 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Password updated.
                  </h1>

                  <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-white/45">
                    Your password has been reset successfully. You can now sign
                    in with your new password.
                  </p>

                  <Link
                    href="/sign-in"
                    className="mt-8 flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  >
                    Continue to sign in
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={17}
                      strokeWidth={1.7}
                      className="ml-2"
                    />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* 3D scene */}
          <div className="relative hidden min-h-[calc(100svh-4rem)] items-center justify-center lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.06),transparent_55%)]" />

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
