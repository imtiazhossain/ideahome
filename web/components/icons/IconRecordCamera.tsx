import React from "react";

interface IconRecordCameraProps {
  size?: number;
}

export function IconRecordCamera({ size = 16 }: IconRecordCameraProps) {
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
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      <circle cx="8" cy="12" r="2.5" />
    </svg>
  );
}
