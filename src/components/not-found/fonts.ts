import { Press_Start_2P, VT323 } from "next/font/google";

// Police arcade pour les titres, police "terminal" pour le texte courant.
export const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const terminal = VT323({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});
