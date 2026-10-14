"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth/errors";
import {
  magicLinkSignInSchema,
  magicLinkSignUpSchema,
} from "@/lib/validation/auth";

/** Seconds before a second link can be requested for the same address. */
const RESEND_COOLDOWN_SECONDS = 60;

interface MagicLinkFormValues {
  email: string;
  name?: string;
}

interface MagicLinkFormProps {
  mode: "sign-in" | "sign-up";
  /** Where to land after a successful verification. */
  callbackURL: string;
  /** Where brand-new accounts land (defaults to `callbackURL`). */
  newUserCallbackURL?: string;
  /** Where the server sends the visitor on a link error. */
  errorCallbackURL?: string;
}

const inputClass =
  "h-12 w-full rounded-lg border border-slate-200 bg-white/80 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-red-400 dark:border-white/10 dark:bg-white/3 dark:text-white dark:placeholder:text-white/25";

/**
 * The passwordless form shared by sign-in and sign-up.
 *
 * A single mechanism — Better Auth's magic-link plugin — backs both
 * screens; only the optional username field and the copy differ.
 */
export default function MagicLinkForm({
  mode,
  callbackURL,
  newUserCallbackURL,
  errorCallbackURL,
}: MagicLinkFormProps) {
  const isSignUp = mode === "sign-up";

  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkFormValues>({
    resolver: zodResolver(
      isSignUp ? magicLinkSignUpSchema : magicLinkSignInSchema,
    ) as Resolver<MagicLinkFormValues>,
    defaultValues: { email: "", name: "" },
    mode: "onSubmit",
  });

  // Ticking cooldown, cleared on unmount.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const id = setTimeout(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );

    return () => clearTimeout(id);
  }, [cooldown]);

  function buildPayload(values: MagicLinkFormValues) {
    return {
      email: values.email,
      callbackURL,
      ...(newUserCallbackURL ? { newUserCallbackURL } : {}),
      ...(errorCallbackURL ? { errorCallbackURL } : {}),
      ...(isSignUp && values.name
        ? { name: values.name, metadata: { name: values.name } }
        : {}),
    };
  }

  async function onSubmit(values: MagicLinkFormValues) {
    clearErrors("root.server");
    setNotice(null);

    const requestPayload = buildPayload(values);
    const { error } = await authClient.signIn.magicLink(requestPayload);

    if (error) {
      setError("root.server", {
        type: "server",
        message: describeAuthError(error),
      });

      return;
    }

    setPayload(requestPayload);
    setSubmittedEmail(values.email);
    setSubmitted(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  async function handleResend() {
    if (cooldown > 0 || isSubmitting || !payload) {
      return;
    }

    setNotice(null);
    const { error } = await authClient.signIn.magicLink(
      payload as Parameters<typeof authClient.signIn.magicLink>[0],
    );

    if (error) {
      setNotice(describeAuthError(error));

      return;
    }

    setNotice("Un nouveau lien vient d'être envoyé.");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function handleUseAnotherEmail() {
    const current = getValues("email");

    reset({ email: current, name: getValues("name") });
    setSubmitted(false);
    setSubmittedEmail("");
    setPayload(null);
    setNotice(null);
    setCooldown(0);
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={18}
            strokeWidth={1.7}
            className="mt-0.5 shrink-0"
          />

          <p>
            <span className="font-semibold">Vérifie ta boîte mail.</span> Si un
            compte est associé à{" "}
            <span className="font-medium break-all">{submittedEmail}</span>, tu
            recevras un lien de connexion. Pense à regarder tes spams.
          </p>
        </div>

        {notice && (
          <p
            role="status"
            className="text-sm text-slate-500 dark:text-white/45"
          >
            {notice}
          </p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isSubmitting}
          aria-busy={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-sm font-semibold text-slate-900 transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/3 dark:text-white dark:hover:border-white/20"
        >
          {cooldown > 0
            ? `Renvoyer le lien (${cooldown} s)`
            : "Renvoyer le lien"}
        </button>

        <button
          type="button"
          onClick={handleUseAnotherEmail}
          className="w-full text-center text-sm text-slate-400 underline-offset-4 transition hover:text-slate-950 hover:underline focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none dark:text-white/35 dark:hover:text-white"
        >
          Utiliser un autre e-mail
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Username — sign-up only */}
      {isSignUp && (
        <div>
          <label
            htmlFor="magic-name"
            className="mb-2 block text-sm font-medium"
          >
            Pseudo
          </label>

          <div className="relative">
            <HugeiconsIcon
              icon={UserIcon}
              size={18}
              strokeWidth={1.7}
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
            />

            <input
              id="magic-name"
              type="text"
              autoComplete="username"
              placeholder="Choisis un pseudo"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "magic-name-error" : undefined}
              className={inputClass}
              {...register("name")}
            />
          </div>

          {errors.name && (
            <p
              id="magic-name-error"
              role="alert"
              className="mt-2 text-xs text-red-500 dark:text-red-400"
            >
              {errors.name.message}
            </p>
          )}
        </div>
      )}

      {/* Email */}
      <div>
        <label htmlFor="magic-email" className="mb-2 block text-sm font-medium">
          Adresse e-mail
        </label>

        <div className="relative">
          <HugeiconsIcon
            icon={Mail01Icon}
            size={18}
            strokeWidth={1.7}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 dark:text-white/30"
          />

          <input
            id="magic-email"
            type="email"
            autoComplete="email"
            placeholder="toi@exemple.com"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "magic-email-error" : undefined}
            className={inputClass}
            {...register("email")}
          />
        </div>

        {errors.email && (
          <p
            id="magic-email-error"
            role="alert"
            className="mt-2 text-xs text-red-500 dark:text-red-400"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {errors.root?.server && (
        <p role="alert" className="text-sm text-red-500 dark:text-red-400">
          {errors.root.server.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="flex h-12 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90 dark:focus-visible:ring-offset-[#05070b]"
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            Envoi en cours...
          </>
        ) : (
          <>
            Recevoir mon lien
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={17}
              strokeWidth={1.7}
              className="ml-2"
            />
          </>
        )}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400 dark:text-white/35">
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          size={14}
          strokeWidth={1.7}
          aria-hidden="true"
        />
        Sans mot de passe — le lien est valable 10 minutes.
      </p>
    </form>
  );
}
