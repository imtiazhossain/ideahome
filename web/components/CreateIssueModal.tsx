import React from "react";
import type { Project, User } from "../lib/api";
import { parseTestCases, serializeTestCases } from "../lib/utils";
import { computeQualityScore } from "../features/board/scoring";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { ErrorBanner } from "./ErrorBanner";
import { ProjectSelect } from "./ProjectSelect";

export interface CreateIssueModalProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  acceptanceCriteria: string;
  setAcceptanceCriteria: (v: string) => void;
  database: string;
  setDatabase: (v: string) => void;
  api: string;
  setApi: (v: string) => void;
  testCases: string;
  setTestCases: (v: string) => void;
  assigneeId: string;
  setAssigneeId: (v: string) => void;
  users: User[];
  error: string | null;
  onDismissError: () => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateIssueModal({
  open,
  onClose,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  title,
  setTitle,
  description,
  setDescription,
  acceptanceCriteria,
  setAcceptanceCriteria,
  database,
  setDatabase,
  api,
  setApi,
  testCases,
  setTestCases,
  assigneeId,
  setAssigneeId,
  users,
  error,
  onDismissError,
  submitting,
  onSubmit,
}: CreateIssueModalProps) {
  if (!open) return null;

  const lines = parseTestCases(testCases);
  const qualityScore = computeQualityScore({
    title,
    description,
    acceptanceCriteria,
    database,
    api,
    testCases,
  });
  const qualityScorePercent = Math.round((qualityScore / 6) * 100);
  const updateCases = (nextLines: string[]) => {
    setTestCases(serializeTestCases(nextLines) ?? "");
  };

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div
        className="modal modal--fit-screen modal--issue-detail issue-detail-modal-finance"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="tests-page-section-title issue-detail-modal-title">
            Create Deck
          </h2>
          <button
            type="button"
            className="expenses-plaid-disconnect-btn issue-detail-modal-close"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="modal-body modal-body--scrollable issue-detail-modal-body">
          <section className="tests-page-section expenses-add-section issue-detail-modal-main-section">
            <form onSubmit={onSubmit}>
              <div className="quality-score-bar-wrap" style={{ marginBottom: 12 }}>
                <div className="quality-score-bar-label">
                  <span>Quality Score</span>
                  <span>{qualityScorePercent} / 100</span>
                </div>
                <div
                  className="quality-score-bar"
                  role="progressbar"
                  aria-valuenow={qualityScorePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="quality-score-bar-fill"
                    style={{ width: `${(qualityScore / 6) * 100}%` }}
                  />
                </div>
              </div>
              {error && (
                <ErrorBanner
                  message={error}
                  onDismiss={onDismissError}
                  style={{ marginBottom: 16 }}
                />
              )}
              <ProjectSelect
                id="create-deck-project"
                projects={projects}
                value={selectedProjectId}
                onChange={setSelectedProjectId}
                className="issue-modal-field expenses-field"
                selectClassName="form-select expenses-input"
              />
              <div className="form-group issue-modal-field expenses-field">
                <label>Title</label>
                <input
                  className="expenses-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summary"
                  autoFocus
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>Description</label>
                <textarea
                  className="expenses-input"
                  value={description}
                  spellCheck
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details…"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>Acceptance Criteria</label>
                <textarea
                  className="expenses-input"
                  value={acceptanceCriteria}
                  spellCheck
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  placeholder="e.g. User can log in, Form validates input…"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>Database</label>
                <input
                  className="expenses-input"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="Input Database Information..."
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>API</label>
                <input
                  className="expenses-input"
                  value={api}
                  onChange={(e) => setApi(e.target.value)}
                  placeholder="API"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>Test Cases</label>
                <div className="test-cases-list">
                  {lines.map((line, idx) => (
                    <div key={idx} className="test-case-row">
                      <div className="test-case-field">
                        <AutoResizeTextarea
                          value={line}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = e.target.value;
                            updateCases(next);
                          }}
                          placeholder="e.g. Given X when Y then Z"
                          className={`expenses-input${idx > 0 ? " test-case-input-with-action" : ""}`}
                        />
                        {idx > 0 && (
                          <button
                            type="button"
                            className="project-nav-add test-case-remove"
                            onClick={() => {
                              const next = lines.filter((_, i) => i !== idx);
                              updateCases(next.length ? next : [""]);
                            }}
                            aria-label="Remove test case"
                            title="Remove test case"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        className="project-nav-add test-case-add"
                        onClick={() =>
                          updateCases([
                            ...lines.slice(0, idx + 1),
                            "",
                            ...lines.slice(idx + 1),
                          ])
                        }
                        aria-label="Add test case"
                        title="Add test case"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <label>Assigned To</label>
                <select
                  className="form-select expenses-input"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary issue-modal-action-btn"
                  onClick={() => !submitting && onClose()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="expenses-add-btn issue-modal-save-btn"
                  disabled={submitting}
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
