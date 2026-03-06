import React from "react";

export interface IconBrokenBulbProps {
  className?: string;
}

export function IconBrokenBulb({ className }: IconBrokenBulbProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {/* Bulb glass (split top to suggest missing piece) */}
      <path d="M8.1 11.2A4.6 4.6 0 0 1 10.9 6.9" />
      <path d="M13.4 6.8a4.6 4.6 0 0 1 2.5 4.4c0 1.8-.8 3.3-2.2 4.3v1.9h-3.4v-1.9c-1.4-1-2.2-2.5-2.2-4.3" />
      {/* Detached glass shard */}
      <path d="m11.8 6 1.4-.8.8 1.5-1.3.8z" />
      {/* Jagged crack in the bulb */}
      <path d="m13.7 8.5-1.4 1.4 1.1 1.1-1.9 1.7" />
      <path d="M10 18.1h4" />
      <path d="M10.8 20h2.4" />
    </svg>
  );
}
