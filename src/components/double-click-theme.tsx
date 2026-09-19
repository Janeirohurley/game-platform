"use client";

import {
  useCallback,
  useEffect,
} from "react";
import { useTheme } from "next-themes";

type ViewTransitionDocument =
  Document & {
    startViewTransition?: (options: {
      update: () => void | Promise<void>;
      types?: string[];
    }) => {
      finished: Promise<void>;
    };
  };

export default function DoubleClickTheme({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    resolvedTheme,
    setTheme,
  } = useTheme();

  const toggleTheme = useCallback(
    (event: MouseEvent) => {
      const nextTheme =
        resolvedTheme === "dark"
          ? "light"
          : "dark";

      const transitionDocument =
        document as ViewTransitionDocument;

      const root =
        document.documentElement;

      /*
       * -------------------------------------------------------
       * Point exact du double-clic
       * -------------------------------------------------------
       */

      const x = event.clientX;
      const y = event.clientY;

      /*
       * Distance maximale du point de départ
       * jusqu'à un coin de l'écran.
       *
       * Cela garantit que le cercle couvre
       * toute la fenêtre.
       */

      const maxX =
        Math.max(
          x,
          window.innerWidth - x,
        );

      const maxY =
        Math.max(
          y,
          window.innerHeight - y,
        );

      const radius =
        Math.sqrt(
          maxX * maxX +
            maxY * maxY,
        );

      root.style.setProperty(
        "--theme-x",
        `${x}px`,
      );

      root.style.setProperty(
        "--theme-y",
        `${y}px`,
      );

      root.style.setProperty(
        "--theme-radius",
        `${radius}px`,
      );

      /*
       * -------------------------------------------------------
       * Native View Transition
       * -------------------------------------------------------
       */

      if (
        transitionDocument.startViewTransition
      ) {
        transitionDocument.startViewTransition(
          {
            update() {
              setTheme(nextTheme);
            },

            types: [
              "theme-radial",
            ],
          },
        );

        return;
      }

      /*
       * -------------------------------------------------------
       * Fallback
       * -------------------------------------------------------
       */

      setTheme(nextTheme);
    },
    [
      resolvedTheme,
      setTheme,
    ],
  );

  useEffect(() => {
    const handleDoubleClick = (
      event: MouseEvent,
    ) => {
      toggleTheme(event);
    };

    document.body.addEventListener(
      "dblclick",
      handleDoubleClick,
    );

    return () => {
      document.body.removeEventListener(
        "dblclick",
        handleDoubleClick,
      );
    };
  }, [toggleTheme]);

  return (
    <>
      <style jsx global>{`
        /* =====================================================
           THEME RADIAL VIEW TRANSITION
           ===================================================== */

        html {
          --theme-x: 50vw;
          --theme-y: 50vh;
          --theme-radius: 100vmax;
        }

        /*
         * Le groupe entier dure 900ms.
         */

        html:active-view-transition-type(
          theme-radial
        ) {
          &::view-transition-group(root) {
            animation-duration: 900ms;
            animation-timing-function:
              cubic-bezier(
                0.22,
                1,
                0.36,
                1
              );
          }

          /*
           * L'ancien thème reste brièvement visible.
           */

          &::view-transition-old(root) {
            animation:
              theme-radial-old
              900ms
              cubic-bezier(
                0.22,
                1,
                0.36,
                1
              )
              both;
          }

          /*
           * Le nouveau thème commence exactement
           * au point du double-clic.
           */

          &::view-transition-new(root) {
            animation:
              theme-radial-new
              900ms
              cubic-bezier(
                0.22,
                1,
                0.36,
                1
              )
              both;
          }
        }

        /* =====================================================
           OLD THEME
           ===================================================== */

        @keyframes theme-radial-old {
          0% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1);
          }

          55% {
            opacity: 0.96;
            transform: scale(1.008);
            filter: brightness(1);
          }

          100% {
            opacity: 0;
            transform: scale(1.025);
            filter: brightness(0.95);
          }
        }

        /* =====================================================
           NEW THEME
           ===================================================== */

        @keyframes theme-radial-new {
          0% {
            clip-path: circle(
              0px
              at
              var(--theme-x)
              var(--theme-y)
            );

            transform: scale(1.015);
            filter: brightness(1.08);
          }

          55% {
            clip-path: circle(
              calc(var(--theme-radius) * 0.72)
              at
              var(--theme-x)
              var(--theme-y)
            );

            transform: scale(1.002);
            filter: brightness(1.02);
          }

          100% {
            clip-path: circle(
              var(--theme-radius)
              at
              var(--theme-x)
              var(--theme-y)
            );

            transform: scale(1);
            filter: brightness(1);
          }
        }

        /* =====================================================
           ACCESSIBILITY
           ===================================================== */

        @media (
          prefers-reduced-motion: reduce
        ) {
          html:active-view-transition-type(
            theme-radial
          ) {
            &::view-transition-group(root),
            &::view-transition-old(root),
            &::view-transition-new(root) {
              animation-duration: 1ms !important;
            }
          }
        }
      `}</style>

      {children}
    </>
  );
}