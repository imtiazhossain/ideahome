import React from "react";

export interface LoadingMessageProps {
  /** Loading text to display. Default "Loading…" */
  message?: string;
  /** Optional className (e.g. "loading" for board, "tests-page-section-desc" for sections) */
  className?: string;
  /** Optional inline style */
  style?: React.CSSProperties;
}

export function LoadingMessage({
  message = "Loading…",
  className,
  style,
}: LoadingMessageProps) {
  return (
    <div
      className={className}
      style={style}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
