import { z } from "zod";

export const signUpSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must contain at least 3 characters.")
      .max(24, "Username must contain at most 24 characters.")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores.",
      ),

    email: z
      .email("Please enter a valid email address.")
      .transform((value) => value.trim().toLowerCase()),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .max(128, "Password must contain at most 128 characters."),

    confirmPassword: z.string(),

    acceptedLegal: z
      .boolean()
      .refine((value) => value == true, {
        error:
          "You must accept the Terms of Service and Privacy Policy.",

      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z
    .email("Please enter a valid email address.")
    .transform((value) => value.trim().toLowerCase()),

  password: z.string().min(1, "Password is required."),
  rememberMe: z.boolean(),

});

export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .email("Please enter a valid email address.")
    .transform((value) => value.trim().toLowerCase()),
});

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must contain at least 8 characters.")
      .max(128, "Password must contain at most 128 characters."),

    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export type ResetPasswordInput = z.infer<
  typeof resetPasswordSchema
>;

export const verifyEmailSchema = z.object({
  email: z
    .email("Please enter a valid email address.")
    .transform((value) => value.trim().toLowerCase()),
});

export type VerifyEmailInput = z.infer<
  typeof verifyEmailSchema
>;

