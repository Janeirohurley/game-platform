"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { HugeiconsIcon } from "@hugeicons/react";
import { GripIcon } from "@hugeicons/core-free-icons";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";

import { cn } from "cn";

import {
  clampPositionToViewport,
  readPosition,
  samePosition,
  writePosition,
  type FloatingPosition,
} from "@/lib/floating";

/**
 * Controls that own their pointer gestures. A drag arming inside them
 * would swallow the very interaction they exist for, so their subtree is
 * exempt. `data-no-drag` is the escape hatch for anything else that needs
 * pointer gestures — text selections, canvases, maps.
 */
const NO_DRAG_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [data-no-drag]';

function isNoDragTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(NO_DRAG_SELECTOR) !== null;
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

const ORIGIN: FloatingPosition = { x: 0, y: 0 };

export interface FloatingProps {
  /**
   * The content to float. It sizes the box: the wrapper shrink-wraps
   * around it, so exactly what you pass is exactly what can be dragged.
   */
  children: ReactNode;
  /**
   * Starting offset in pixels from wherever the children's own CSS put
   * them. The default `{ x: 0, y: 0 }` means "wherever the stylesheet put
   * it" — anchor with classes, then let the offset move it from there.
   * A persisted offset wins over this once one exists.
   */
  defaultPosition?: FloatingPosition;
  /**
   * localStorage key. Two floating panels that must not share a position
   * need distinct keys; leave it out and the offset lasts the session.
   */
  storageKey?: string;
  /** Extra classes for the draggable box itself. */
  className?: string;
}

/**
 * Makes any element float above its surroundings and drag with a mouse or
 * a finger, remembering where it landed.
 *
 * The box keeps whatever positioning its classes give it — `absolute`
 * inside a fixed match screen, `fixed` over a page, a flex item in a
 * centred bar — and the drag accumulates a transform on top. Nothing about
 * the layout has to change to become movable.
 *
 * ```tsx
 * <div className="pointer-events-none absolute bottom-16 right-3 z-50">
 *   <Floating storageKey="match-screen.chat">
 *     <Panel />
 *   </Floating>
 * </div>
 * ```
 */
export function Floating({
  children,
  defaultPosition = ORIGIN,
  storageKey,
  className,
}: FloatingProps) {
  // Read before first paint. This tree only mounts once a room exists, so
  // the first client render is also the first render anywhere — there is
  // no server markup to disagree with, and no flash of the default spot.
  const [position, setPosition] = useState<FloatingPosition>(() => {
    if (!storageKey || typeof window === "undefined") return defaultPosition;
    return readPosition(window.localStorage, storageKey) ?? defaultPosition;
  });

  const nodeRef = useRef<HTMLDivElement | null>(null);

  // A saved offset can outlive the window it was measured against. Pull it
  // back before paint, so a too-large value never shows as a panel parked
  // half off-screen. The ref is already attached by the time a parent's
  // layout effect runs, and `rect` carries the transform currently applied.
  const hasRestored = useRef(false);
  useLayoutEffect(() => {
    if (hasRestored.current) return;
    hasRestored.current = true;

    const node = nodeRef.current;
    if (!node) return;

    const next = clampPositionToViewport(
      position,
      node.getBoundingClientRect(),
      viewport(),
    );
    if (!samePosition(next, position)) setPosition(next);
  }, [position]);

  // Mouse: a short move arms the drag, so a click on a button inside still
  // lands as a click. Touch: a long press arms it, and a finger that
  // travels first is handed back to the browser as a scroll — the only way
  // to keep a scrollable child scrollable without `touch-action: none` on
  // the whole panel, which would lock it shut.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dropped: FloatingPosition = {
        x: position.x + event.delta.x,
        y: position.y + event.delta.y,
      };

      // The panel has already re-rendered at the dragged spot by now? No —
      // this runs inside the same batch as the DragEnd dispatch, so the DOM
      // still shows the drop position and `rect` is exactly what clamp wants.
      // `restrictToWindowEdges` held it in bounds anyway; this is the
      // guarantee rather than the mechanism.
      const node = nodeRef.current;
      const next = node
        ? clampPositionToViewport(
            dropped,
            node.getBoundingClientRect(),
            viewport(),
          )
        : dropped;

      setPosition(next);
      if (storageKey) writePosition(window.localStorage, storageKey, next);
    },
    [position, storageKey],
  );

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragEnd={handleDragEnd}
    >
      <FloatingBox position={position} nodeRef={nodeRef} className={className}>
        {children}
      </FloatingBox>
    </DndContext>
  );
}

interface FloatingBoxProps {
  position: FloatingPosition;
  nodeRef: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}

/**
 * The draggable element itself. Split from `Floating` because
 * `useDraggable` reads the DndContext provider — a hook called in the same
 * component that *renders* that provider sits above it in the tree and
 * falls back to dnd-kit's inert default context, where `activators` is
 * empty and no node is ever registered.
 */
function FloatingBox({ position, nodeRef, className, children }: FloatingBoxProps) {
  const id = useId();
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const attachNode = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      setNodeRef(node);
    },
    [nodeRef, setNodeRef],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isNoDragTarget(event.target)) return;
      listeners?.onMouseDown?.(event);
    },
    [listeners],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (isNoDragTarget(event.target)) return;
      listeners?.onTouchStart?.(event);
    },
    [listeners],
  );

  const x = position.x + (transform?.x ?? 0);
  const y = position.y + (transform?.y ?? 0);

  // At rest the transform is omitted entirely: a transform — even one
  // pinned to zero — would make this box a containing block and a stacking
  // context, quietly re-anchoring anything positioned inside it.
  const style: CSSProperties | undefined =
    x !== 0 || y !== 0
      ? { transform: CSS.Translate.toString({ x, y, scaleX: 1, scaleY: 1 }) }
      : undefined;

  return (
    <div
      ref={attachNode}
      className={cn(
        "group relative pointer-events-auto",
        // The box advertises itself as draggable; the controls nested in it
        // keep their own pointer affordance instead of inheriting the grab.
        isDragging ? "cursor-grabbing" : "cursor-grab",
        "[&_a]:cursor-pointer [&_button]:cursor-pointer [&_input]:cursor-pointer [&_select]:cursor-pointer [&_textarea]:cursor-pointer",
        className,
      )}
      style={style}
      {...listeners}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/*
        Half-in, half-out at the top-left corner: the quarter that lands
        inside only ever covers the corner padding, and the half outside
        never covers content. `pointer-events-none` keeps it from stealing
        a click from whatever sits next to the panel.
      */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -left-3 -top-3 z-10 flex size-6 items-center justify-center rounded-full border shadow-md backdrop-blur-sm transition",
          isDragging
            ? "border-slate-900/20 bg-slate-900 text-white dark:border-white/20 dark:bg-white dark:text-slate-900"
            : "border-slate-200 bg-white/95 text-slate-400 group-hover:text-slate-700 dark:border-white/10 dark:bg-neutral-900/95 dark:text-slate-500 dark:group-hover:text-slate-200",
        )}
      >
        <HugeiconsIcon icon={GripIcon} size={14} strokeWidth={1.6} />
      </span>
      {children}
    </div>
  );
}
