import React from "react";
import type { Issue } from "../../lib/api/issues";

export type IssueDetailModalHeaderProps = {
  selectedIssue: Issue;
  issueKeyFn: (issue: Issue) => string;
  computeQualityScoreFn: (issue: Issue) => number;
  onClose: () => void;
};

export function IssueDetailModalHeader({
  selectedIssue,
  issueKeyFn,
  computeQualityScoreFn,
  onClose,
}: IssueDetailModalHeaderProps) {
  return (
    <>
      <div className="modal-header">
        <h2 className="tests-page-section-title issue-detail-modal-title">
          {issueKeyFn(selectedIssue)}
        </h2>
        <div className="modal-header-actions">
          <button
            type="button"
            className="expenses-plaid-disconnect-btn issue-detail-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </div>
      <div
        className="quality-score-bar-wrap"
        style={{ marginBottom: 12 }}
      >
        <div className="quality-score-bar-label">
          <span>Quality Score</span>
          <span>
            {Math.round((computeQualityScoreFn(selectedIssue) / 6) * 100)} /
            100
          </span>
        </div>
        <div
          className="quality-score-bar"
          role="progressbar"
          aria-valuenow={Math.round(
            (computeQualityScoreFn(selectedIssue) / 6) * 100
          )}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="quality-score-bar-fill"
            style={{
              width: `${(computeQualityScoreFn(selectedIssue) / 6) * 100}%`,
            }}
          />
        </div>
      </div>
    </>
  );
}
