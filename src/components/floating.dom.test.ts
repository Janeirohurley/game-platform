/**
 * floating.dom.test.ts — the wiring, not the maths.
 *
 * The pure suite covers offsets; it cannot see a hook called outside the
 * provider that supplies it. That mistake shipped once: `useDraggable` was
 * invoked by the component that rendered `<DndContext>`, so it read
 * dnd-kit's inert default context (`activators: []`), `listeners` came
 * back empty and nothing moved — while typecheck, lint, build and every
 * pure test stayed green. These tests render the real component and drive
 * it with real pointer events for that reason.
 *
 * happy-dom stands in for a browser: rects come back as zeros, so the
 * viewport is a blank 1024×768 and only positive deltas survive the
 * window-edge modifier. That is enough to prove activation, movement and
 * persistence.
 */

import { afterAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Floating } = await import("./floating");

afterAll(() => {
  GlobalRegistrator.unregister();
});

function fire(target: Element, type: string, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    }),
  );
}

interface Harness {
  box: HTMLElement;
  dispose: () => Promise<void>;
}

async function mount(
  ui: unknown,
  props: Record<string, unknown> = {},
): Promise<Harness> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(ui as never, props as never));
  });

  // The draggable box is the element Floating renders itself as.
  const box = host.firstElementChild as HTMLElement;
  if (!box) throw new Error("Floating rendered no box");

  return {
    box,
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

/**
 * Arms the drag (the first move clears `distance`), moves it, then drops
 * it — one `act()` per event. Firing the whole sequence inside a single
 * batch starves dnd-kit of the render between activation and move: DragEnd
 * is then built from a context that never received the translate, and the
 * drop looks like a no-op.
 */
async function drag(box: HTMLElement, from: [number, number], to: [number, number]) {
  const step = async (type: string, x: number, y: number) => {
    await act(async () => fire(box, type, x, y));
  };

  await step("mousedown", from[0], from[1]);
  await step("mousemove", from[0] + 40, from[1] + 40);
  await step("mousemove", to[0], to[1]);
  await step("mouseup", to[0], to[1]);
}

test("a mouse drag moves the panel and stores the offset", async () => {
  const { box, dispose } = await mount(Floating, {
    storageKey: "drag-test",
    children: createElement("button", null, "Chat"),
  });

  expect(box.style.transform).toBe("");

  await drag(box, [10, 10], [110, 110]);

  expect(box.style.transform).toBe("translate3d(100px, 100px, 0)");
  expect(
    window.localStorage.getItem("floating:position:drag-test"),
  ).toBe('{"x":100,"y":100}');

  await dispose();
});

test("the offset is picked up again on the next mount", async () => {
  const first = await mount(Floating, {
    storageKey: "drag-restore",
    children: createElement("button", null, "Chat"),
  });
  await drag(first.box, [10, 10], [110, 110]);
  await first.dispose();

  const second = await mount(Floating, {
    storageKey: "drag-restore",
    children: createElement("button", null, "Chat"),
  });

  expect(second.box.style.transform).toBe("translate3d(100px, 100px, 0)");

  await second.dispose();
});

test("a click shorter than the activation distance does not move it", async () => {
  const { box, dispose } = await mount(Floating, {
    storageKey: "drag-click",
    children: createElement("button", null, "Chat"),
  });

  await act(async () => {
    fire(box, "mousedown", 10, 10);
    fire(box, "mouseup", 12, 10);
  });

  expect(box.style.transform).toBe("");
  expect(window.localStorage.getItem("floating:position:drag-click")).toBeNull();

  await dispose();
});

test("the box carries a decorative drag handle that cannot eat a click", async () => {
  const { box, dispose } = await mount(Floating, {
    storageKey: "drag-handle",
    children: createElement("button", null, "Chat"),
  });

  const handle = box.querySelector("span[aria-hidden='true']");
  expect(handle).not.toBeNull();
  // The glyph itself is there, not just the badge around it.
  expect(handle!.querySelector("svg")).not.toBeNull();
  // Half-outside the corner, so it never sits on top of the content.
  expect(handle!.className).toContain("-left-3");
  expect(handle!.className).toContain("-top-3");
  // Purely an affordance: it must not become the hit target.
  expect(handle!.className).toContain("pointer-events-none");
  // The box itself says grab, the controls inside keep pointer.
  expect(box.className).toContain("cursor-grab");
  expect(box.className).toContain("relative");
  expect(box.className).toContain("[&_button]:cursor-pointer");

  await dispose();
});

test("a drag started inside a form control is refused", async () => {
  const { box, dispose } = await mount(Floating, {
    storageKey: "drag-input",
    children: createElement("input", { type: "text" }),
  });
  const input = box.querySelector("input") as HTMLInputElement;

  await act(async () => {
    fire(input, "mousedown", 10, 10);
    fire(input, "mousemove", 110, 110);
    fire(input, "mouseup", 110, 110);
  });

  expect(box.style.transform).toBe("");
  expect(window.localStorage.getItem("floating:position:drag-input")).toBeNull();

  await dispose();
});
