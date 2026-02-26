import React from "react";

interface IconStopProps {
  size?: number;
}

export function IconStop({ size = 16 }: IconStopProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="1" ry="1" />
    </svg>
  );
}
