import React from "react";

interface IconColorizerProps {
  size?: number;
}

export function IconColorizer({ size = 16 }: IconColorizerProps) {
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
      <path d="M12 3c-5 0-9 3.58-9 8 0 2.68 1.76 4.6 4.2 4.6H9a1 1 0 0 1 1 1v.8c0 1.98 1.62 3.6 3.6 3.6 4.64 0 7.4-4.26 7.4-8.6C21 7.03 17 3 12 3Z" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="10.5" cy="7.5" r="1" />
      <circle cx="14.5" cy="7.5" r="1" />
      <circle cx="16.5" cy="11" r="1" />
    </svg>
  );
}
