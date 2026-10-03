"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  Mail01Icon,
  LockPasswordIcon,
} from "@hugeicons/core-free-icons";

import { authClient } from "@/lib/auth-client";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import { listGames } from "@/lib/games/registry";
import type { PublicGamerProfileView } from "@/lib/profile/read-model";
import { saveProfile } from "./actions";

import { GamerProfileHeader } from "@/components/profile/gamer-profile-header";
import { ProfileStatsStrip } from "@/components/profile/profile-stats-strip";
import { ProfileGamesPanel } from "@/components/profile/profile-games-panel";
import { ProfileAchievementsPanel } from "@/components/profile/profile-achievements-panel";
import { ProfileActivityPanel } from "@/components/profile/profile-activity-panel";

type Props = { data: PublicGamerProfileView };

type Tab = "overview" | "edit" | "security";

type SecuritySession = {
  id: string;
  token: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function getDeviceName(userAgent: string | null | undefined) {
  if (!userAgent) {
    return "Unknown device";
  }

  if (/iphone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/android/i.test(userAgent)) {
    return "Android device";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad";
  }

  if (/firefox/i.test(userAgent)) {
    return "Firefox";
  }

  if (/edg/i.test(userAgent)) {
    return "Microsoft Edge";
  }

  if (/chrome/i.test(userAgent)) {
    return "Google Chrome";
  }

  if (/safari/i.test(userAgent)) {
    return "Safari";
  }

  return "Web browser";
}

export default function ProfilePageClient({ data }: Props) {
  const { data: liveSession, isPending, refetch } = authClient.useSession();

  const session = liveSession ?? null;

  const [tab, setTab] = useState<Tab>("overview");
  const [saved, setSaved] = useState(false);
  const [sessions, setSessions] = useState<SecuritySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [revoking, setRevoking] = useState(false);

  const defaultValues = useMemo<ProfileInput>(
    () => ({
      username: data.gamerTag,
      displayName: data.displayName,
      bio: data.bio ?? "",
      avatarUrl: data.avatarUrl ?? "",
      coverUrl: data.coverUrl ?? "",
      countryCode: data.country ?? "",
      languages: data.languages,
      favoriteGames: data.favoriteGameIds,
      isPublic: data.isPublic,
    }),
    [data],
  );

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  async function onSubmit(formValues: ProfileInput) {
    setSaved(false);

    const result = await saveProfile(formValues);

    if (!result.success) {
      form.setError("root.server", {
        type: "server",
        message: result.message,
      });
      return;
    }

    await refetch();
    setSaved(true);
    reset(formValues);

    window.setTimeout(() => {
      setSaved(false);
    }, 3000);
  }

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionError("");

    const { data: sessionData, error } = await authClient.listSessions();

    if (error) {
      setSessionError(error.message || "Unable to load active sessions.");
      setSessionsLoading(false);
      return;
    }

    setSessions((sessionData ?? []) as SecuritySession[]);

    setSessionsLoading(false);
  }

  async function revokeOtherSessions() {
    setRevoking(true);
    setSessionError("");

    const { error } = await authClient.revokeOtherSessions();

    if (error) {
      setSessionError(error.message || "Unable to revoke other sessions.");
      setRevoking(false);
      return;
    }

    await loadSessions();
    setRevoking(false);
  }

  async function revokeSession(token: string) {
    setRevoking(true);
    setSessionError("");

    const { error } = await authClient.revokeSession({
      token,
    });

    if (error) {
      setSessionError(error.message || "Unable to revoke the session.");
      setRevoking(false);
      return;
    }

    await loadSessions();
    setRevoking(false);
  }

  useEffect(() => {
    if (tab === "security") {
      void loadSessions();
    }
  }, [tab]);

  if (isPending && !liveSession) {
    return (
      <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
        <div className="mx-auto flex min-h-svh max-w-6xl items-center justify-center px-6">
          <div className="text-sm text-white/45">Loading profile...</div>
        </div>
      </main>
    );
  }

  const games = listGames();

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <GamerProfileHeader data={data} isOwner />
        <ProfileStatsStrip data={data} />

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-white/10">
          {(
            [
              ["overview", "Overview"],
              ["edit", "Edit profile"],
              ["security", "Security"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={[
                "border-b-2 px-4 py-3 text-sm font-medium transition",
                tab === value
                  ? "border-cyan-500 text-slate-950 dark:text-white"
                  : "border-transparent text-slate-500 hover:text-slate-950 dark:text-white/45 dark:hover:text-white",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Overview — the gamer profile panels, owner edition. */}
        {tab === "overview" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <ProfileAchievementsPanel achievements={data.achievements} />
              <ProfileActivityPanel activity={data.activity} />
            </div>
            <div className="space-y-6">
              <ProfileGamesPanel games={data.games} />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.025]">
                <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
                  Compte
                </h2>
                <div className="mt-4 space-y-3">
                  {session ? (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-slate-500 dark:text-white/45">
                          Email
                        </span>
                        <span className="flex min-w-0 items-center gap-2 text-right text-sm font-medium">
                          <HugeiconsIcon
                            icon={Mail01Icon}
                            size={15}
                            strokeWidth={1.7}
                          />
                          <span className="truncate">{session.user.email}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500 dark:text-white/45">
                          Email status
                        </span>
                        <span className="text-sm font-medium">
                          {session.user.emailVerified
                            ? "Verified"
                            : "Not verified"}
                        </span>
                      </div>
                    </>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-white/45">
                      Visibilité
                    </span>
                    <span className="text-sm font-medium">
                      {data.isPublic ? "Public" : "Privé"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-white/45">
                      Série actuelle
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {data.currentStreak > 0
                        ? `${data.currentStreak} victoires`
                        : data.currentStreak < 0
                          ? `${Math.abs(data.currentStreak)} défaites`
                          : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-white/45">
                      Meilleure série
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {data.bestStreak}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Edit */}
        {tab === "edit" ? (
          <section className="mt-8 max-w-3xl">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
              noValidate
            >
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.025]">
                <div className="mb-7">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-white/30">
                    Profil de gameur
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    Personnalise ton identité de jeu
                  </h2>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="username"
                      className="mb-2 block text-sm font-medium"
                    >
                      Gamer tag
                    </label>
                    <input
                      id="username"
                      {...register("username")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    <p className="mt-1.5 text-xs text-slate-400 dark:text-white/30">
                      Ton identité publique en jeu. Unique.
                    </p>
                    {errors.username ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.username.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="displayName"
                      className="mb-2 block text-sm font-medium"
                    >
                      Nom d&apos;affichage
                    </label>
                    <input
                      id="displayName"
                      {...register("displayName")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    {errors.displayName ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.displayName.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="avatarUrl"
                      className="mb-2 block text-sm font-medium"
                    >
                      Avatar (URL)
                    </label>
                    <input
                      id="avatarUrl"
                      type="url"
                      placeholder="https://..."
                      {...register("avatarUrl")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    {errors.avatarUrl ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.avatarUrl.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="coverUrl"
                      className="mb-2 block text-sm font-medium"
                    >
                      Couverture (URL)
                    </label>
                    <input
                      id="coverUrl"
                      type="url"
                      placeholder="https://..."
                      {...register("coverUrl")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    {errors.coverUrl ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.coverUrl.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5">
                  <label
                    htmlFor="bio"
                    className="mb-2 block text-sm font-medium"
                  >
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    maxLength={280}
                    placeholder="Ta vie de joueur en quelques lignes."
                    {...register("bio")}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                  />
                  {errors.bio ? (
                    <p className="mt-2 text-xs text-rose-500">
                      {errors.bio.message}
                    </p>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="countryCode"
                      className="mb-2 block text-sm font-medium"
                    >
                      Pays (code)
                    </label>
                    <input
                      id="countryCode"
                      placeholder="BI"
                      maxLength={2}
                      {...register("countryCode")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm uppercase outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    {errors.countryCode ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.countryCode.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="languages"
                      className="mb-2 block text-sm font-medium"
                    >
                      Langues
                    </label>
                    <input
                      id="languages"
                      placeholder="fr, en"
                      {...register("languages")}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-cyan-400 dark:border-white/10 dark:bg-white/[0.03]"
                    />
                    <p className="mt-1.5 text-xs text-slate-400 dark:text-white/30">
                      Codes séparés par des virgules (max 5).
                    </p>
                    {errors.languages ? (
                      <p className="mt-2 text-xs text-rose-500">
                        {errors.languages.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Favorite games — registry-driven, generic. */}
                <fieldset className="mt-6">
                  <legend className="mb-2 block text-sm font-medium">
                    Jeux favoris
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {games.map((game) => {
                      const current = watch("favoriteGames") ?? [];
                      const checked = current.includes(game.id);
                      return (
                        <label
                          key={game.id}
                          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                            checked
                              ? "border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-400/40 dark:bg-cyan-400/10 dark:text-cyan-300"
                              : "border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.05]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={game.id}
                            {...register("favoriteGames")}
                            className="sr-only"
                          />
                          {game.title}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label className="mt-6 flex items-center gap-3">
                  <input
                    type="checkbox"
                    {...register("isPublic")}
                    className="size-4 accent-cyan-500"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      Profil public
                    </span>
                    <span className="block text-xs text-slate-400 dark:text-white/35">
                      Permettre aux autres joueurs de voir ton profil.
                    </span>
                  </span>
                </label>
              </div>

              {errors.root?.server?.message ? (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  {errors.root.server.message}
                </div>
              ) : null}

              {saved ? (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
                >
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={17}
                    strokeWidth={1.7}
                  />
                  Profil enregistré.
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    reset(defaultValues);
                    setSaved(false);
                  }}
                  disabled={!isDirty || isSubmitting}
                  className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/75 dark:hover:bg-white/[0.06]"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="h-11 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {/* Security */}
        {tab === "security" ? (
          <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.025]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-white/30">
                    Sessions
                  </p>

                  <h2 className="mt-2 text-xl font-semibold">
                    Appareils actifs
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/45">
                    Revois où ton compte Game Arena est actuellement connecté.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={revokeOtherSessions}
                  disabled={revoking || sessions.length <= 1}
                  className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-white/[0.05]"
                >
                  {revoking ? "Working..." : "Sign out other devices"}
                </button>
              </div>

              {sessionError ? (
                <div
                  role="alert"
                  className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300"
                >
                  {sessionError}
                </div>
              ) : null}

              {sessionsLoading ? (
                <div className="py-12 text-center text-sm text-slate-400 dark:text-white/35">
                  Loading sessions...
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400 dark:text-white/35">
                  No active sessions found.
                </div>
              ) : (
                <div className="mt-7 divide-y divide-slate-200 dark:divide-white/10">
                  {sessions.map((item) => {
                    const isCurrent = item.token === session?.session.token;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">
                              {getDeviceName(item.userAgent)}
                            </p>

                            {isCurrent ? (
                              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-300">
                                Current session
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs text-slate-400 dark:text-white/35">
                            {item.ipAddress || "IP unavailable"}
                            {" · "}
                            Expires {formatDate(item.expiresAt)}
                          </p>
                        </div>

                        {!isCurrent ? (
                          <button
                            type="button"
                            disabled={revoking}
                            onClick={() => revokeSession(item.token)}
                            className="h-9 rounded-lg border border-rose-200 px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-400/10"
                          >
                            Revoke
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.025]">
                <HugeiconsIcon
                  icon={LockPasswordIcon}
                  size={21}
                  strokeWidth={1.7}
                  className="text-slate-500 dark:text-white/50"
                />

                <h3 className="mt-4 font-semibold">Mot de passe</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/40">
                  Utilise le flux de réinitialisation pour choisir un nouveau
                  mot de passe.
                </p>

                <Link
                  href="/forgot-password"
                  className="mt-5 inline-flex items-center text-sm font-medium text-slate-950 hover:underline dark:text-white"
                >
                  Réinitialiser le mot de passe
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={15}
                    strokeWidth={1.7}
                    className="ml-1.5"
                  />
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.025]">
                <HugeiconsIcon
                  icon={EyeIcon}
                  size={21}
                  strokeWidth={1.7}
                  className="text-slate-500 dark:text-white/50"
                />

                <h3 className="mt-4 font-semibold">Visibilité du profil</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-white/40">
                  Ton profil est actuellement{" "}
                  <strong className="font-medium text-slate-700 dark:text-white/70">
                    {data.isPublic ? "public" : "privé"}
                  </strong>
                  .
                </p>

                <button
                  type="button"
                  onClick={() => setTab("edit")}
                  className="mt-5 inline-flex items-center text-sm font-medium text-slate-950 hover:underline dark:text-white"
                >
                  Changer la visibilité
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={15}
                    strokeWidth={1.7}
                    className="ml-1.5"
                  />
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
