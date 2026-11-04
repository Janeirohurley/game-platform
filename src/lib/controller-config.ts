import type { ComponentProps } from "react";
import ControllerViewer from "@/components/controller-viewer";


export const controllerViewerConfig: ComponentProps<
  typeof ControllerViewer
> = {
  logo: {
    src: "/playstation.svg",
  },


  shell: {
    gradient: [
      [6.6, "#050505"],
      [4.4, "#10080c"],
      [3.4, "#3b0d24"],
      [2.6, "#78143c"],
      [1.6, "#c5225e"],
      [0.4, "#ee3f82"],
      [-1.5, "#ff6aa2"],
      [-6.6, "#ff9ec0"],
    ],

    roughness: 0.22,
    clearcoat: 1,
  },

  colorAnimation: {
    enabled: true,
    duration: 4500,

    palettes: [
      {
        gradient: [
          [6.6, "#030507"],
          [4.4, "#07101b"],
          [3.4, "#0b2850"],
          [2.6, "#104f86"],
          [1.6, "#177fbd"],
          [0.4, "#2caee5"],
          [-1.5, "#5bd8f3"],
          [-6.6, "#9aeeff"],
        ],

        colors: {
          buttons: "#06080c",
          sticks: "#2caee5",
          decals: "#a4ecff",
          lightBar: "#48d7ff",
          logo: "#15547c",
          speaker: "#02080d",
          triggers: "#06080c",
          touchpad: "#030406",
        },

        environment: {
          rimColor: "#63dcff",
          rimIntensity: 0.9,
        },
      },

      {
        gradient: [
          [6.6, "#030206"],
          [4.4, "#08040e"],
          [3.4, "#1e0a42"],
          [2.6, "#42127c"],
          [1.6, "#7120c9"],
          [0.4, "#9b42ed"],
          [-1.5, "#bd67ff"],
          [-6.6, "#dda0ff"],
        ],

        colors: {
          buttons: "#08030d",
          sticks: "#a642e5",
          decals: "#e0b5ff",
          lightBar: "#b44cff",
          logo: "#4c177e",
          speaker: "#08020d",
          triggers: "#08030d",
          touchpad: "#040308",
        },

        environment: {
          rimColor: "#c77dff",
          rimIntensity: 1,
        },
      },

      {
        gradient: [
          [6.6, "#050505"],
          [4.4, "#161006"],
          [3.4, "#452008"],
          [2.6, "#7f3d0b"],
          [1.6, "#bd6114"],
          [0.4, "#e88a26"],
          [-1.5, "#ffad4d"],
          [-6.6, "#ffd18a"],
        ],

        colors: {
          buttons: "#0c0804",
          sticks: "#e88a26",
          decals: "#ffd18a",
          lightBar: "#ff9e38",
          logo: "#8b4b0e",
          speaker: "#0c0703",
          triggers: "#0c0804",
          touchpad: "#050403",
        },

        environment: {
          rimColor: "#ffb45c",
          rimIntensity: 0.9,
        },
      },
    ],
  },

  interaction: {
    zoomable: true,
    minZoom: 0.7,
    maxZoom: 2,
    rotationSensitivityX: 0.005,
    rotationSensitivityY: 0.008,
    inertia: 0.96,
  },

  animation: {
    intro: true,
    duration: 2200,
  },

  shadow: {
    enabled: true,
    opacity: 0.4,
    width: 38,
    height: 22,
    y: -8,
  },

  background: {
    light: "transparent",
    lightSecondary: "transparent",
    dark: "transparent",
    darkSecondary: "transparent",
  },
};

