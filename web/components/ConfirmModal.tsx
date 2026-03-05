import React from "react";
import { Button } from "./Button";
import { CloseButton } from "./CloseButton";

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
        className="modal modal--confirm"
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <CloseButton
            className="modal-close"
            onClick={() => !busy && onClose()}
            disabled={busy}
          />
        </div>
        <p className="confirm-modal-message">{message}</p>
        <div className="modal-actions confirm-modal-actions">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => !busy && onClose()}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            size="lg"
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy && confirmBusyLabel ? confirmBusyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
