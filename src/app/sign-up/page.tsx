"use client";

import Link from "next/link";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  EyeIcon,
  EyeOffIcon,
  LockPasswordIcon,
  Mail01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

import Dice from "@/components/dice";
import GameUniverseBackground from "@/components/game-universe-background";
import PlayingCard from "@/components/playing-card";

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

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              size={17}
              strokeWidth={1.7}
            />
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
                  Create your account.
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-white/45">
                  Join the community, find players and start playing realtime
                  matches.
                </p>
              </div>

              <form className="space-y-5">
                {/* Name */}
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-medium"
                  >
                    Username
                  </label>

                  <div className="relative">
                    <HugeiconsIcon
                      icon={UserIcon}
                      size={18}
                      strokeWidth={1.7}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                    />

                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="username"
                      placeholder="Choose a username"
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                    />
                  </div>
                </div>

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
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium"
                  >
                    Password
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
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((value) => !value)
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
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      className="h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-11 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03] dark:placeholder:text-white/25"
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
                </div>

                {/* Terms */}
                <label className="flex items-start gap-2 text-xs leading-5 text-slate-400 dark:text-white/35">
                  <input
                    type="checkbox"
                    name="terms"
                    className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-cyan-500 dark:border-white/20"
                  />

                  <span>
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      className="text-slate-700 hover:underline dark:text-white/70"
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
                      className="text-slate-700 hover:underline dark:text-white/70"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>

                {/* Submit */}
                <button
                  type="submit"
                  className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  Create account
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={17}
                    strokeWidth={1.7}
                    className="ml-2"
                  />
                </button>
              </form>

              {/* Sign in */}
              <p className="mt-7 text-center text-sm text-slate-400 dark:text-white/35">
                Already have an account?{" "}
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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.10),transparent_55%)] dark:bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.08),transparent_55%)]" />

            <div className="relative size-[min(42vw,520px)]">
              {/* <Dice
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
              /> */}
              <PlayingCard/>
            </div>

            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-white/25">
                Join Game Arena
              </p>

              <p className="mt-2 text-sm text-slate-500 dark:text-white/40">
                Find players. Pick a game. Play.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}