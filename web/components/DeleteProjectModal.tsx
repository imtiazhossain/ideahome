import React from "react";
import { ConfirmModal } from "./ConfirmModal";

export interface DeleteProjectModalProps {
  project: { id: string; name: string };
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Optional style for the modal container (e.g. maxWidth) */
  modalStyle?: React.CSSProperties;
}

export function DeleteProjectModal({
  project,
  deleting,
  onClose,
  onConfirm,
  modalStyle,
}: DeleteProjectModalProps) {
  return (
    <ConfirmModal
      title="Delete Project"
      message={
        <>
          Delete &quot;{project.name}&quot;? This will permanently remove the
          project and all its issues.
        </>
      }
      confirmLabel="Delete"
      confirmBusyLabel="Deleting…"
      busy={deleting}
      onClose={onClose}
      onConfirm={onConfirm}
      modalStyle={modalStyle}
    />
  );
}
