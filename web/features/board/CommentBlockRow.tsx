import React from "react";
import { CloseButton } from "../../components/CloseButton";

export type CommentBlockRowProps = {
  dataCommentBlockIndex?: number;
  label: string;
  openAriaLabel: string;
  icon: React.ReactNode;
  onOpen?: () => void;
  onRemove: () => void;
};

/**
 * Presentational row for a single non-text comment block (attachment, recording, screenshot, file).
 * Used by IssueDetailModalComments to avoid duplicated button markup.
 */
export function CommentBlockRow({
  dataCommentBlockIndex,
  label,
  openAriaLabel,
  icon,
  onOpen,
  onRemove,
}: CommentBlockRowProps) {
  return (
    <div
      data-comment-block-index={dataCommentBlockIndex}
      className="comment-block-row"
      style={{ gap: 4 }}
    >
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={onOpen}
        aria-label={openAriaLabel}
        title={openAriaLabel}
      >
        {icon} {label}
      </button>
      <CloseButton
        className="btn btn-icon btn-icon-sm"
        size="sm"
        onClick={onRemove}
        aria-label="Remove"
        title="Remove"
      />
    </div>
  );
}
