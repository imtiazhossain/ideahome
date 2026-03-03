import React from "react";
import type { Issue } from "../../lib/api/issues";
import type { User } from "../../lib/api/users";
import { AutoResizeTextarea } from "../../components/AutoResizeTextarea";

export type IssueDetailModalFormFieldsProps = {
  selectedIssue: Issue;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  users: User[];
  parseTestCasesFn: (s: string | null | undefined) => string[];
  serializeTestCasesFn: (lines: string[]) => string | null;
};

export function IssueDetailModalFormFields({
  selectedIssue,
  setSelectedIssue,
  users,
  parseTestCasesFn,
  serializeTestCasesFn,
}: IssueDetailModalFormFieldsProps) {
  return (
    <>
      <div className="form-group issue-modal-field expenses-field">
        <label>Project</label>
        <input
          className="expenses-input"
          type="text"
          value={selectedIssue.project?.name ?? ""}
          readOnly
          disabled
          style={{
            background: "var(--bg-muted)",
            cursor: "not-allowed",
          }}
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Title</label>
        <input
          className="expenses-input"
          value={selectedIssue.title ?? ""}
          onChange={(e) =>
            setSelectedIssue({
              ...selectedIssue,
              title: e.target.value,
            })
          }
          placeholder="Summary"
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Description</label>
        <textarea
          className="expenses-input"
          value={selectedIssue.description ?? ""}
          spellCheck
          onChange={(e) =>
            setSelectedIssue({
              ...selectedIssue,
              description: e.target.value || null,
            })
          }
          placeholder="Add more details…"
          rows={3}
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Acceptance Criteria</label>
        <textarea
          className="expenses-input"
          value={selectedIssue.acceptanceCriteria ?? ""}
          spellCheck
          onChange={(e) =>
            setSelectedIssue({
              ...selectedIssue,
              acceptanceCriteria: e.target.value || null,
            })
          }
          placeholder="e.g. User can log in, Form validates input…"
          rows={3}
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Database</label>
        <input
          className="expenses-input"
          value={selectedIssue.database ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedIssue({
              ...selectedIssue,
              database: value || null,
            });
          }}
          placeholder="Input Database Information..."
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>API</label>
        <input
          className="expenses-input"
          value={selectedIssue.api ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            setSelectedIssue({ ...selectedIssue, api: value || null });
          }}
          placeholder="API"
        />
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Test Cases</label>
        {(() => {
          const lines = parseTestCasesFn(selectedIssue.testCases);
          const updateCases = (nextLines: string[]) => {
            setSelectedIssue({
              ...selectedIssue,
              testCases: serializeTestCasesFn(nextLines) ?? "",
            });
          };
          return (
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
                      className={
                        `expenses-input${idx > 0 ? " test-case-input-with-action" : ""}`
                      }
                    />
                    {idx > 0 && (
                      <button
                        type="button"
                        className="project-nav-add test-case-remove"
                        onClick={() => {
                          const next = lines.filter(
                            (_, i) => i !== idx
                          );
                          updateCases(next);
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
          );
        })()}
      </div>
      <div className="form-group issue-modal-field expenses-field">
        <label>Assigned To</label>
        <select
          className="form-select expenses-input"
          value={selectedIssue.assigneeId ?? ""}
          onChange={(e) =>
            setSelectedIssue({
              ...selectedIssue,
              assigneeId: e.target.value || null,
            })
          }
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
