"use client";

import type { SVGProps } from "react";

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" {...props}>
      <path d="M14.5 15.5a4 4 0 1 0-5.5-5.5" />
      <path d="M20.5 14.5a7 7 0 0 0-10.5-2.5A4.5 4.5 0 0 0 8.5 19.5" />
    </svg>
  );
}

export function BotIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 15h6" />
    </svg>
  );
}
