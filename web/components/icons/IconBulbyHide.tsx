import React from "react";

/** Tiny Bulby (lightbulb) icon for "Hide Bulby" — bulb with slash (hidden/off). */
export function IconBulbyHide() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Bulb shape */}
      <path d="M12 2a5 5 0 0 0-5 5c0 2.5 1.5 4.5 3.5 5.5v1.5h3v-1.5c2-1 3.5-3 3.5-5.5a5 5 0 0 0-5-5z" />
      <line x1="9" y1="14" x2="15" y2="14" />
      <line x1="10" y1="16.5" x2="14" y2="16.5" />
      <line x1="11" y1="19" x2="13" y2="19" />
      {/* Slash through = hidden */}
      <line x1="4" y1="4" x2="20" y2="20" />
    </svg>
  );
}
