import { z } from "zod";

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

  isPublic: z.boolean(),
});

export type ProfileInput = z.infer<typeof profileSchema>;