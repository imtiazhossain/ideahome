import React from "react";

export interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  confirmBusyLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Optional style for the modal container (e.g. maxWidth) */
  modalStyle?: React.CSSProperties;
  /** Optional overlay className (e.g. modal-overlay--above-detail) */
  overlayClassName?: string;
  danger?: boolean;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmBusyLabel,
  busy = false,
  onClose,
  onConfirm,
  modalStyle,
  overlayClassName = "",
  danger = true,
}: ConfirmModalProps) {
  return (
    <div
      className={`modal-overlay ${overlayClassName}`.trim()}
      onClick={() => !busy && onClose()}
    >
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => !busy && onClose()}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
          {message}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => !busy && onClose()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={
              danger ? { background: "var(--danger, #c53030)" } : undefined
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && confirmBusyLabel ? confirmBusyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
