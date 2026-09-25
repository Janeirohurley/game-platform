import { Resend } from "resend";

import { VerifyEmail } from "@/emails/verify-email";
import { ResetPassword } from "@/emails/reset-password";

/**
 * The Resend client is created lazily: Next.js evaluates modules during
 * `next build` (page data collection) in environments without secrets
 * (Docker, CI), so the API key is only required when an email is
 * actually sent.
 */

const from =
  process.env.EMAIL_FROM ??
  "Game Arena <onboarding@resend.dev>";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not defined");
    }

    resend = new Resend(resendApiKey);
  }

  return resend;
}

export async function sendVerificationEmail({
  to,
  username,
  url,
}: {
  to: string;
  username: string;
  url: string;
}) {
  return getResend().emails.send({
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
  return getResend().emails.send({
    from,
    to,
    subject: "Reset your Game Arena password",
    react: ResetPassword({
      username,
      resetUrl: url,
    }),
  });
}
