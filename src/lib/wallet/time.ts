/**
 * Timeout wrapper for external provider calls. A slow rail must never
 * hold a request open forever: the operation times out with a typed
 * error and the transaction stays in a reconcilable state (the engine
 * decides what that state is — never the adapter).
 */

import { WalletError } from "./errors";

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = "Provider request timed out",
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new WalletError("provider_timeout", message)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
