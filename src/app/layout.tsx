import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import DoubleClickTheme from "@/components/double-click-theme";

import { Playwrite_BE_WAL } from "next/font/google";

const playwrite = Playwrite_BE_WAL({
  variable: "--font-playwrite",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Game Arena",
    template: "%s | Game Arena",
  },
  description:
    "Find a game, meet players and play realtime multiplayer matches across devices.",
  icons: {
    icon: "/game-arena.png",
    apple: "/game-arena.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playwrite.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <DoubleClickTheme>{children}</DoubleClickTheme>
        </ThemeProvider>
      </body>
    </html>
  );
}
