import { z } from "zod";

import { GAME_IDS } from "@/lib/games/registry";

/**
 * Profile validation (gamer profile edition).
 *
 * Deliberately ABSENT from this schema: level, xp, rating, wins, losses,
 * draws, streaks, play time — progression numbers are server-owned and
 * structurally unreachable from a client payload. Adding them here would
 * be a security bug, not a feature.
 */
export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must contain at least 3 characters.")
    .max(24, "Username must contain at most 24 characters.")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers and underscores.",
    ),

  displayName: z
    .string()
    .trim()
    .max(80, "Display name must contain at most 80 characters."),

  bio: z
    .string()
    .trim()
    .max(280, "Bio must contain at most 280 characters."),

  countryCode: z
    .string()
    .trim()
    .max(2, "Country code must contain 2 characters.")
    .regex(
      /^[a-zA-Z]{2}$/,
      "Country code must contain 2 letters.",
    )
    .or(z.literal("")),

  avatarUrl: z
    .string()
    .trim()
    .max(500, "Avatar URL is too long.")
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\/.+/i.test(value),
      "Avatar URL must be a valid HTTP or HTTPS URL.",
    ),

  coverUrl: z
    .string()
    .trim()
    .max(500, "Cover URL is too long.")
    .refine(
      (value) =>
        value === "" ||
        /^https?:\/\/.+/i.test(value),
      "Cover URL must be a valid HTTP or HTTPS URL.",
    ),

  /** BCP-47 language stems, e.g. ["fr", "en"]. Bounded, no free text. */
  languages: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-zA-Z]{2,5}(-[a-zA-Z0-9]{2,8})?$/, "Invalid language code."),
    )
    .max(5, "At most 5 languages.")
    .optional(),

  /** Registry ids only — unknown ids are dropped server-side too. */
  favoriteGames: z
    .array(z.string())
    .max(GAME_IDS.length, "Too many favorite games.")
    .refine(
      (gameIds) => gameIds.every((id) => (GAME_IDS as readonly string[]).includes(id)),
      "Unknown game.",
    )
    .optional(),

  isPublic: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
