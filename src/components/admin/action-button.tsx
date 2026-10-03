"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Runs an audited admin server action on click and reports the REAL
 * result (the action returns { ok, message } — success is never
 * faked). Used where a single click is the interaction; multi-field
 * forms post directly to a server wrapper instead.
 */
export function ActionButton<T>({
  action,
  args,
  children,
  variant = "default",
  size = "sm",
  disabled,
}: {
  action: (input: T) => Promise<{ ok: boolean; message: string }>;
  args: T;
  children: ReactNode;
  variant?:
    | "default"
    | "outline"
    | "secondary"
    | "destructive"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const result = await action(args);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          } catch {
            toast.error("L'opération a échoué côté serveur.");
          }
        })
      }
    >
      {pending ? "…" : children}
    </Button>
  );
}
