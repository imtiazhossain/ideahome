import React from "react";

interface IconPlayProps {
  size?: number;
}

export function IconPlay({ size = 16 }: IconPlayProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
