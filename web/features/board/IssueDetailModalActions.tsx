import React from "react";
import type { Issue } from "../../lib/api/issues";
import { IconTrash } from "../../components/IconTrash";
import { IconSettings } from "../../components/icons";

export type IssueDetailModalActionsProps = {
  selectedIssue: Issue;
  issueDetailOriginal: Issue | null;
  hasIssueDetailChangesFn: (issue: Issue, original: Issue | null) => boolean;
  handleSaveIssue: () => Promise<void>;
  issueSaving: boolean;
  openQualityConfig: () => void;
  qualityConfigSaving: boolean;
  setIssueToDelete: (issue: Issue | null) => void;
};

export function IssueDetailModalActions({
  selectedIssue,
  issueDetailOriginal,
  hasIssueDetailChangesFn,
  handleSaveIssue,
  issueSaving,
  openQualityConfig,
  qualityConfigSaving,
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
        className="expenses-add-btn issue-modal-action-btn issue-modal-quality-config-btn"
        onClick={openQualityConfig}
        disabled={qualityConfigSaving}
      >
        <IconSettings />
        Quality Score
      </button>
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
