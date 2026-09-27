"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Edit01Icon,
  Globe02Icon,
  LanguageSkillIcon,
} from "@hugeicons/core-free-icons";

import type { PublicGamerProfileView } from "@/lib/profile/read-model";

/**
 * Gamer profile header — cover, avatar, tag, bio, presence, socials.
 * Server data in; no state. Presence comes from the realtime server
 * (or is undefined when it is unreachable: nothing is shown).
 */
export function GamerProfileHeader({
  data,
  isOwner,
}: {
  data: PublicGamerProfileView;
  isOwner: boolean;
}) {
  const initials = data.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.025]">
      {/* Cover — plain neutral band when no image was set. */}
      <div
        className={`h-28 sm:h-36 ${
          data.coverUrl ? "" : "bg-slate-100 dark:bg-white/[0.04]"
        }`}
        style={
          data.coverUrl
            ? {
                backgroundImage: `url("${data.coverUrl}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            {/* Avatar — square, rounded, initials fallback. */}
            <div className="-mt-14 size-20 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-slate-950 sm:-mt-16 sm:size-24 dark:border-[#0b0f17]">
              {data.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.avatarUrl}
                  alt={data.displayName}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-xl font-semibold text-white">
                  {initials}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {data.displayName}
              </h1>
              <p className="mt-0.5 text-sm font-medium text-cyan-600 dark:text-cyan-300">
                @{data.gamerTag}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-white/45">
                {data.presence ? (
                  <span
                    className={
                      data.presence.state === "in-match"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-cyan-600 dark:text-cyan-300"
                    }
                  >
                    {data.presence.state === "in-match"
                      ? `En partie${
                          data.presence.gameId
                            ? ` · ${data.presence.gameId}`
                            : ""
                        }`
                      : "Spectateur"}
                  </span>
                ) : null}

                {data.country ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon
                      icon={Globe02Icon}
                      size={14}
                      strokeWidth={1.8}
                    />
                    {data.country}
                  </span>
                ) : null}

                {data.languages.length > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <HugeiconsIcon
                      icon={LanguageSkillIcon}
                      size={14}
                      strokeWidth={1.8}
                    />
                    {data.languages.join(" · ")}
                  </span>
                ) : null}

                <span>
                  Gameur depuis{" "}
                  {new Intl.DateTimeFormat("fr", {
                    year: "numeric",
                  }).format(data.gamerSince)}
                </span>
              </div>
            </div>
          </div>

          {/* Owner actions — social actions arrive with friends/follows. */}
          {isOwner ? (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/profile"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.05]"
              >
                <HugeiconsIcon icon={Edit01Icon} size={15} strokeWidth={1.8} />
                Modifier
              </Link>
            </div>
          ) : null}
        </div>

        {data.bio ? (
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-white/60">
            {data.bio}
          </p>
        ) : null}
      </div>
    </header>
  );
}
