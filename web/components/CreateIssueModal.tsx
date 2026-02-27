import React from "react";
import type { Project, User } from "../lib/api";
import { parseTestCases, serializeTestCases } from "../lib/utils";
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
  const updateCases = (nextLines: string[]) => {
    setTestCases(serializeTestCases(nextLines) ?? "");
  };

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div
        className="modal modal--fit-screen"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Create Deck</h2>
          <button
            type="button"
            className="modal-close"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
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
          />
          <div className="form-group">
            <label>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summary"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details…"
            />
          </div>
          <div className="form-group">
            <label>Acceptance Criteria</label>
            <textarea
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="e.g. User can log in, Form validates input…"
            />
          </div>
          <div className="form-group">
            <label>Database</label>
            <input
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
              placeholder="Input Database Information..."
            />
          </div>
          <div className="form-group">
            <label>API</label>
            <input
              value={api}
              onChange={(e) => setApi(e.target.value)}
              placeholder="API"
            />
          </div>
          <div className="form-group">
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
                      className={idx > 0 ? "test-case-input-with-action" : ""}
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        className="btn btn-icon test-case-remove"
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
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => updateCases([...lines, ""])}
              >
                + Add test case
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Assigned To</label>
            <select
              className="form-select"
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
              className="btn btn-secondary"
              onClick={() => !submitting && onClose()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
