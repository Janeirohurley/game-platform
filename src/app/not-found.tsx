import type { Metadata } from "next";

import NotFoundScreen from "@/components/not-found/NotFoundScreen";

export const metadata: Metadata = {
  title: "404 · Niveau introuvable",
  description: "Cette page n'existe pas ou a été déplacée.",
};

export default function NotFound() {
  return <NotFoundScreen />;
}
