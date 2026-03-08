import React from "react";
import type { Project, ProjectQualityScoreConfig, User } from "../lib/api";
import { parseTestCases, serializeTestCases } from "../lib/utils";
import { computeQualityScore } from "../features/board/scoring";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { CloseButton } from "./CloseButton";
import { ErrorBanner } from "./ErrorBanner";
import { ProjectSelect } from "./ProjectSelect";
import { UiInput } from "./UiInput";
import { Text } from "./Text";
import { UiSelect } from "./UiSelect";

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
  qualityScoreConfig?: ProjectQualityScoreConfig | null;
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
  qualityScoreConfig,
  error,
  onDismissError,
  submitting,
  onSubmit,
}: CreateIssueModalProps) {
  if (!open) return null;

  const titleFieldId = "create-deck-title";
  const descriptionFieldId = "create-deck-description";
  const acceptanceCriteriaFieldId = "create-deck-acceptance-criteria";
  const databaseFieldId = "create-deck-database";
  const apiFieldId = "create-deck-api";
  const assigneeFieldId = "create-deck-assignee";
  const lines = parseTestCases(testCases);
  const qualityScore = computeQualityScore({
    title,
    description,
    acceptanceCriteria,
    database,
    api,
    testCases,
    automatedTest: "",
    assigneeId: assigneeId || null,
    recordings: [],
    screenshots: [],
    files: [],
  }, qualityScoreConfig);
  const qualityScorePercent = Math.round(qualityScore);
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
          <Text as="h2" variant="title" className="tests-page-section-title issue-detail-modal-title">
            Create Deck
          </Text>
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
                  <Text as="span" variant="caption" tone="muted">Quality Score</Text>
                  <Text as="span" variant="caption">{qualityScorePercent} / 100</Text>
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
                    style={{ width: `${qualityScorePercent}%` }}
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
                <Text as="label" variant="label" tone="accent" htmlFor={titleFieldId}>Title</Text>
                <UiInput
                  id={titleFieldId}
                  name="title"
                  className="expenses-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summary"
                  autoFocus
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor={descriptionFieldId}>Description</Text>
                <textarea
                  id={descriptionFieldId}
                  name="description"
                  className="expenses-input"
                  value={description}
                  spellCheck
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details…"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor={acceptanceCriteriaFieldId}>Acceptance Criteria</Text>
                <textarea
                  id={acceptanceCriteriaFieldId}
                  name="acceptanceCriteria"
                  className="expenses-input"
                  value={acceptanceCriteria}
                  spellCheck
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  placeholder="e.g. User can log in, Form validates input…"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor={databaseFieldId}>Database</Text>
                <UiInput
                  id={databaseFieldId}
                  name="database"
                  className="expenses-input"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  placeholder="Input Database Information..."
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor={apiFieldId}>API</Text>
                <UiInput
                  id={apiFieldId}
                  name="api"
                  className="expenses-input"
                  value={api}
                  onChange={(e) => setApi(e.target.value)}
                  placeholder="API"
                />
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor="create-deck-test-case-0">Test Cases</Text>
                <div className="test-cases-list">
                  {lines.map((line, idx) => (
                    <div key={idx} className="test-case-row">
                      <div className="test-case-field">
                        <AutoResizeTextarea
                          id={`create-deck-test-case-${idx}`}
                          name={`testCase${idx + 1}`}
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
                          <CloseButton
                            className="project-nav-add test-case-remove"
                            size="sm"
                            onClick={() => {
                              const next = lines.filter((_, i) => i !== idx);
                              updateCases(next.length ? next : [""]);
                            }}
                            aria-label="Remove test case"
                            title="Remove Test Case"
                          />
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
                        title="Add Test Case"
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group issue-modal-field expenses-field">
                <Text as="label" variant="label" tone="accent" htmlFor={assigneeFieldId}>Assigned To</Text>
                <UiSelect
                  id={assigneeFieldId}
                  name="assigneeId"
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
                </UiSelect>
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
