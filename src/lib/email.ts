import { Resend } from "resend";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

import { VerifyEmail } from "@/emails/verify-email";
import { ResetPassword } from "@/emails/reset-password";
import { MagicLinkEmail } from "@/emails/magic-link";

const from =
  process.env.EMAIL_FROM ??
  "Game Arena <onboarding@resend.dev>";

let resend: Resend | null = null;
let smtpTransport: Transporter | null = null;

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

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === "true";

    if (!host || !port) {
      throw new Error("SMTP_HOST and SMTP_PORT must be defined for SMTP provider");
    }

    // Auth is optional so a local catcher (Mailpit/MailHog) that accepts
    // unauthenticated mail works in development without fake credentials.
    const auth = user && pass ? { user, pass } : undefined;

    smtpTransport = nodemailer.createTransport({
      host,
      port: Number(port),
      secure,
      auth,
    });
  }
  return smtpTransport;
}

export type EmailProvider = "resend" | "smtp";

function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (provider === "smtp") return "smtp";
  return "resend";
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  return getResend().emails.send({
    from,
    to: params.to,
    subject: params.subject,
    react: params.react,
  });
}

async function sendViaSmtp(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  // Render React email to HTML
  const { render } = await import("@react-email/render");
  const html = await render(params.react);
  const text = await render(params.react, { plainText: true });

  return getSmtpTransport().sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html,
    text,
  });
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}) {
  const provider = getEmailProvider();
  if (provider === "smtp") {
    return sendViaSmtp(params);
  }
  return sendViaResend(params);
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
  return sendEmail({
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
  return sendEmail({
    to,
    subject: "Reset your Game Arena password",
    react: ResetPassword({
      username,
      resetUrl: url,
    }),
  });
}

export async function sendMagicLinkEmail({
  to,
  url,
  username,
}: {
  to: string;
  url: string;
  /** Set only for a first registration; ignored for existing accounts. */
  username?: string;
}) {
  return sendEmail({
    to,
    subject: "Votre lien de connexion à Game Arena",
    react: MagicLinkEmail({ url, username }),
  });
}
