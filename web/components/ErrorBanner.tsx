import React, { useMemo, useState } from "react";
import { sendErrorReportEmail } from "../lib/api";
import { AccessibleModal } from "./AccessibleModal";

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
  const [showDetails, setShowDetails] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState(message);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const pageUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  const handleOpenReport = () => {
    setReportMessage(message);
    setReportError(null);
    setReportSuccess(null);
    setReportOpen(true);
  };

  const handleSendReport = async () => {
    const trimmed = reportMessage.trim();
    if (!trimmed) {
      setReportError("Error message is required.");
      return;
    }
    setSending(true);
    setReportError(null);
    setReportSuccess(null);
    try {
      await sendErrorReportEmail({
        errorMessage: trimmed,
        pageUrl,
      });
      setReportSuccess("Thanks, we got your report.");
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Failed to send error report."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="error-banner" style={{ ...baseStyle, ...style }}>
        <span>
          Looks like a bulb went out,{" "}
          <button
            type="button"
            className="error-banner-link-button"
            onClick={handleOpenReport}
          >
            click here
          </button>{" "}
          to let us know so we can fix it
        </span>
        <div className="error-banner-actions">
          <button
            type="button"
            className="error-banner-arrow"
            onClick={() => setShowDetails((prev) => !prev)}
            aria-label={showDetails ? "Hide real error" : "Show real error"}
            title={showDetails ? "Hide real error" : "Show real error"}
          >
            {showDetails ? "▲" : "▼"}
          </button>
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
      </div>
      {showDetails ? <div className="error-banner-detail">{message}</div> : null}
      <AccessibleModal
        open={reportOpen}
        onClose={() => {
          if (sending) return;
          setReportOpen(false);
        }}
        title="Report error"
      >
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="error-report-message">Error message</label>
            <textarea
              id="error-report-message"
              value={reportMessage}
              onChange={(e) => setReportMessage(e.target.value)}
              rows={6}
              disabled={sending}
            />
          </div>
          {reportError ? <div className="error-banner-modal-error">{reportError}</div> : null}
          {reportSuccess ? (
            <div className="error-banner-modal-success">{reportSuccess}</div>
          ) : null}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReportOpen(false)}
              disabled={sending}
            >
              Close
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                handleSendReport().catch(() => {
                  // handled in state
                });
              }}
              disabled={sending}
            >
              {sending ? "Sending..." : "Send email"}
            </button>
          </div>
        </div>
      </AccessibleModal>
    </>
  );
}
