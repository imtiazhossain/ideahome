import React from "react";

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  /** Optional style overrides (e.g. marginTop, marginBottom) */
  style?: React.CSSProperties;
}

const baseStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const dismissButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "0 4px",
  cursor: "pointer",
  fontSize: 18,
  lineHeight: 1,
  opacity: 0.8,
};

export function ErrorBanner({ message, onDismiss, style }: ErrorBannerProps) {
  return (
    <div className="error-banner" style={{ ...baseStyle, ...style }}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
          style={dismissButtonStyle}
        >
          ×
        </button>
      )}
    </div>
  );
}
