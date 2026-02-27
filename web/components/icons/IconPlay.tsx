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
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 5.6L18 12 7 18.4z" />
    </svg>
  );
}
