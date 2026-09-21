import { Resend } from "resend";

import { VerifyEmail } from "@/emails/verify-email";
import { ResetPassword } from "@/emails/reset-password";

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error("RESEND_API_KEY is not defined");
}

const resend = new Resend(resendApiKey);

const from =
  process.env.EMAIL_FROM ??
  "Game Arena <onboarding@resend.dev>";

export async function sendVerificationEmail({
  to,
  username,
  url,
}: {
  to: string;
  username: string;
  url: string;
}) {
  return resend.emails.send({
    from,
    to,
    subject: "Verify your Game Arena email",
    react: VerifyEmail({
      username,
      verificationUrl: url,
    }),
  });
}

export async function sendPasswordResetEmail({
  to,
  username,
  url,
}: {
  to: string;
  username: string;
  url: string;
}) {
  return resend.emails.send({
    from,
    to,
    subject: "Reset your Game Arena password",
    react: ResetPassword({
      username,
      resetUrl: url,
    }),
  });
}