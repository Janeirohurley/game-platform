import { afterAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { WaitingOverlay } = await import("./waiting-overlay");

afterAll(() => {
  GlobalRegistrator.unregister();
});

async function mount(props: Record<string, unknown>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(WaitingOverlay as never, props as never));
  });
  return {
    host,
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

const baseProps = {
  roomId: "room-1",
  gameId: "ludo",
  pendingRequest: false,
  isSpectator: false,
  isAdmin: false,
  onCopyInvite: () => {},
};

test("announces server-confirmed pending requests with readable apostrophes", async () => {
  const { host, dispose } = await mount({
    ...baseProps,
    pendingRequest: true,
    requestStatus: "pending",
    onCancelRequest: () => {},
  });

  const status = host.querySelector('[role="status"]');
  expect(status?.textContent).toContain("en attente de l’approbation");
  expect(status?.textContent).not.toContain("&apos;");
  expect(host.textContent).toContain("Annuler ma demande");
  await dispose();
});

test("shows an explicit acceptance outcome after the request leaves pending", async () => {
  const { host, dispose } = await mount({
    ...baseProps,
    requestStatus: "accepted",
  });

  expect(host.querySelector('[role="status"]')?.textContent).toContain(
    "Votre demande a été acceptée.",
  );
  await dispose();
});

test("announces a recoverable rejection and exposes an actionable retry", async () => {
  let retried = false;
  const { host, dispose } = await mount({
    ...baseProps,
    requestStatus: "rejected",
    requestError: "Le créateur a refusé votre demande.",
    onRetryRequest: () => {
      retried = true;
    },
  });

  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    "Le créateur a refusé",
  );
  const retry = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Réessayer"),
  );
  expect(retry).toBeDefined();
  await act(async () => retry!.click());
  expect(retried).toBe(true);
  await dispose();
});
