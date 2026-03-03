import React from "react";
import type { Issue } from "../../lib/api/issues";
import { IconTrash } from "../../components/IconTrash";

export type IssueDetailModalActionsProps = {
  selectedIssue: Issue;
  issueDetailOriginal: Issue | null;
  hasIssueDetailChangesFn: (issue: Issue, original: Issue | null) => boolean;
  handleSaveIssue: () => Promise<void>;
  issueSaving: boolean;
  setIssueToDelete: (issue: Issue | null) => void;
};

export function IssueDetailModalActions({
  selectedIssue,
  issueDetailOriginal,
  hasIssueDetailChangesFn,
  handleSaveIssue,
  issueSaving,
  setIssueToDelete,
}: IssueDetailModalActionsProps) {
  return (
    <div className="modal-actions">
      {hasIssueDetailChangesFn(selectedIssue, issueDetailOriginal) && (
        <button
          type="button"
          className="expenses-add-btn issue-modal-save-btn"
          onClick={handleSaveIssue}
          disabled={issueSaving}
        >
          {issueSaving ? "Saving…" : "Save"}
        </button>
      )}
      <button
        type="button"
        className="expenses-plaid-disconnect-btn issue-modal-delete-btn"
        onClick={() => setIssueToDelete(selectedIssue)}
        aria-label={`Delete ${selectedIssue.title || "issue"}`}
        title="Delete issue"
      >
        <IconTrash />
      </button>
    </div>
  );
}
