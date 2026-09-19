"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  EyeOffIcon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";

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

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reset, setReset] = useState(false);

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  const handleSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!passwordsMatch) {
      return;
    }

    setReset(true);
  };

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
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={17}
              strokeWidth={1.7}
            />
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

              {!reset ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      Reset your password.
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                      Choose a new password for your Game Arena account.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-5"
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
                          name="password"
                          type={
                            showPassword
                              ? "text"
                              : "password"
                          }
                          value={password}
                          onChange={(event) =>
                            setPassword(event.target.value)
                          }
                          autoComplete="new-password"
                          placeholder="Enter a new password"
                          required
                          minLength={8}
                          className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowPassword(
                              (value) => !value,
                            )
                          }
                          aria-label={
                            showPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 dark:text-white/30 dark:hover:text-white"
                        >
                          <HugeiconsIcon
                            icon={
                              showPassword
                                ? EyeOffIcon
                                : EyeIcon
                            }
                            size={18}
                            strokeWidth={1.7}
                          />
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-slate-400 dark:text-white/30">
                        Use at least 8 characters.
                      </p>
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
                          name="confirm-password"
                          type={
                            showConfirmPassword
                              ? "text"
                              : "password"
                          }
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(
                              event.target.value,
                            )
                          }
                          autoComplete="new-password"
                          placeholder="Repeat your new password"
                          required
                          minLength={8}
                          className={[
                            "h-12 w-full rounded-lg border bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 dark:bg-white/[0.03] dark:placeholder:text-white/25",
                            confirmPassword.length > 0 &&
                            !passwordsMatch
                              ? "border-rose-300 focus:border-rose-400 dark:border-rose-400/30"
                              : "border-slate-200 focus:border-cyan-400 dark:border-white/10",
                          ].join(" ")}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(
                              (value) => !value,
                            )
                          }
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 transition hover:text-slate-950 dark:text-white/30 dark:hover:text-white"
                        >
                          <HugeiconsIcon
                            icon={
                              showConfirmPassword
                                ? EyeOffIcon
                                : EyeIcon
                            }
                            size={18}
                            strokeWidth={1.7}
                          />
                        </button>
                      </div>

                      {confirmPassword.length > 0 &&
                        !passwordsMatch && (
                          <p className="mt-2 text-xs text-rose-500">
                            Passwords do not match.
                          </p>
                        )}

                      {passwordsMatch && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">
                          <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            size={13}
                            strokeWidth={1.7}
                          />
                          Passwords match.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!passwordsMatch}
                      className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    >
                      Reset password
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={17}
                        strokeWidth={1.7}
                        className="ml-2"
                      />
                    </button>
                  </form>
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
                    Your password has been reset successfully. You can
                    now sign in with your new password.
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
                size={5}
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