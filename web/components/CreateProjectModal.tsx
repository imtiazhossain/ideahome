import React from "react";
import type { Organization } from "../lib/api";
import { Button } from "./Button";
import { CloseButton } from "./CloseButton";
import { ErrorBanner } from "./ErrorBanner";
import { UiInput } from "./UiInput";
import { UiSelect } from "./UiSelect";

export interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  organizations: Organization[];
  newOrgName: string;
  setNewOrgName: (v: string) => void;
  newProjectOrgId: string;
  setNewProjectOrgId: (v: string) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  error: string | null;
  onDismissError: () => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function CreateProjectModal({
  open,
  onClose,
  organizations,
  newOrgName,
  setNewOrgName,
  newProjectOrgId,
  setNewProjectOrgId,
  newProjectName,
  setNewProjectName,
  error,
  onDismissError,
  submitting,
  onSubmit,
}: CreateProjectModalProps) {
  if (!open) return null;

  const organizationNameFieldId = "create-project-org-name";
  const projectNameFieldId = "create-project-name";

  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Project</h2>
          <CloseButton
            className="modal-close"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
          />
        </div>
        <form onSubmit={onSubmit}>
          {error && (
            <ErrorBanner
              message={error}
              onDismiss={onDismissError}
              style={{ marginBottom: 16 }}
            />
          )}
          {organizations.length === 0 ? (
            <div className="form-group">
              <label htmlFor={organizationNameFieldId}>Organization Name</label>
              <UiInput
                id={organizationNameFieldId}
                name="organizationName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Organization"
              />
              <span className="form-hint">
                No organizations yet. Enter a name to create one with this
                project, or leave blank for &quot;My Workspace&quot;.
              </span>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="create-project-org">Organization</label>
              <UiSelect
                id="create-project-org"
                name="organizationId"
                value={newProjectOrgId}
                onChange={(e) => setNewProjectOrgId(e.target.value)}
                required
              >
                <option value="">Select an organization</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </UiSelect>
            </div>
          )}
          <div className="form-group">
            <label htmlFor={projectNameFieldId}>Project Name</label>
            <UiInput
              id={projectNameFieldId}
              name="projectName"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. Engineering, Marketing"
              required
              autoFocus={organizations.length > 0}
            />
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
