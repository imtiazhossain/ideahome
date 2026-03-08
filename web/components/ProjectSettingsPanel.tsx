import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toUiTitleCase } from "@ideahome/shared";
import { Button } from "./Button";
import { Text } from "./Text";
import { UiInput } from "./UiInput";
import { UiSelect } from "./UiSelect";
import {
  fetchProjectInvites,
  fetchProjectMembers,
  inviteProjectByEmail,
  inviteProjectMember,
  removeProjectMember,
  revokeProjectInvite,
  type ProjectInvite,
  type ProjectMember,
} from "../lib/api/projects";
import { fetchUsers, type User } from "../lib/api/users";

export interface ProjectSettingsPanelProps {
  projectId?: string;
  projectName: string;
  onRenameProject?: (projectId: string, name: string) => Promise<void> | void;
  onDeleteProject?: (projectId: string, name: string) => void | Promise<void>;
}

export function ProjectSettingsPanel({
  projectId,
  projectName,
  onRenameProject,
  onDeleteProject,
}: ProjectSettingsPanelProps) {
  const [nameInput, setNameInput] = useState(projectName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);

  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectInvites, setProjectInvites] = useState<ProjectInvite[]>([]);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState<string | null>(null);
  const [collabSuccess, setCollabSuccess] = useState<string | null>(null);
  const [inviteEmailSubmitting, setInviteEmailSubmitting] = useState(false);
  const [inviteMemberSubmitting, setInviteMemberSubmitting] = useState(false);
  const [memberActionUserId, setMemberActionUserId] = useState<string | null>(
    null
  );
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [resendActionId, setResendActionId] = useState<string | null>(null);
  const inviteSubmitting = inviteEmailSubmitting || inviteMemberSubmitting;

  const trimmedNameInput = nameInput.trim();
  const hasNameEdits = trimmedNameInput !== projectName.trim();

  useEffect(() => {
    setNameInput(projectName);
    setNameError(null);
    setNameSuccess(null);
  }, [projectName]);

  const loadCollaboration = useCallback(async () => {
    if (!projectId) return;
    setCollabLoading(true);
    setCollabError(null);
    try {
      const [users, members, invites] = await Promise.all([
        fetchUsers(),
        fetchProjectMembers(projectId),
        fetchProjectInvites(projectId),
      ]);
      setOrgUsers(users);
      setProjectMembers(members);
      setProjectInvites(invites);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to load project members"
      );
    } finally {
      setCollabLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setProjectMembers([]);
      setProjectInvites([]);
      setOrgUsers([]);
      setInviteUserId("");
      setInviteEmail("");
      setCollabError(null);
      setCollabSuccess(null);
      return;
    }
    void loadCollaboration();
  }, [loadCollaboration, projectId]);

  const inviteableUsers = useMemo(() => {
    const memberIds = new Set(projectMembers.map((member) => member.userId));
    return orgUsers.filter((user) => !memberIds.has(user.id));
  }, [orgUsers, projectMembers]);

  const handleRenameProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!projectId || !onRenameProject || nameSaving) return;
    const nextName = nameInput.trim();
    if (!nextName) {
      setNameError("Project name is required.");
      return;
    }
    setNameSaving(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      await Promise.resolve(onRenameProject(projectId, nextName));
      setNameSuccess("Project renamed successfully.");
      setTimeout(() => setNameSuccess(null), 3000);
    } catch (err) {
      setNameError(
        err instanceof Error ? err.message : "Failed to update project name"
      );
    } finally {
      setNameSaving(false);
    }
  };

  const handleInviteMember = async () => {
    if (!projectId || !inviteUserId.trim()) return;
    setInviteMemberSubmitting(true);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const members = await inviteProjectMember(projectId, inviteUserId);
      setProjectMembers(members);
      setProjectInvites(await fetchProjectInvites(projectId));
      setInviteUserId("");
      setCollabSuccess("Member invited successfully.");
      setTimeout(() => setCollabSuccess(null), 3000);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to invite project member"
      );
    } finally {
      setInviteMemberSubmitting(false);
    }
  };

  const handleInviteEmail = async () => {
    if (!projectId || !inviteEmail.trim()) return;
    setInviteEmailSubmitting(true);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const invites = await inviteProjectByEmail(projectId, inviteEmail);
      setProjectInvites(invites);
      setProjectMembers(await fetchProjectMembers(projectId));
      setInviteEmail("");
      setCollabSuccess("Invitation sent successfully.");
      setTimeout(() => setCollabSuccess(null), 3000);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to send email invite"
      );
    } finally {
      setInviteEmailSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!projectId) return;
    setMemberActionUserId(userId);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const members = await removeProjectMember(projectId, userId);
      setProjectMembers(members);
      setCollabSuccess("Member removed.");
      setTimeout(() => setCollabSuccess(null), 3000);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to remove project member"
      );
    } finally {
      setMemberActionUserId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!projectId) return;
    setInviteActionId(inviteId);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const invites = await revokeProjectInvite(projectId, inviteId);
      setProjectInvites(invites);
      setCollabSuccess("Invite revoked.");
      setTimeout(() => setCollabSuccess(null), 3000);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to revoke invite"
      );
    } finally {
      setInviteActionId(null);
    }
  };

  const handleResendInvite = async (invite: ProjectInvite) => {
    if (!projectId) return;
    setResendActionId(invite.id);
    setCollabError(null);
    setCollabSuccess(null);
    try {
      const invites = await inviteProjectByEmail(projectId, invite.email);
      setProjectInvites(invites);
      setProjectMembers(await fetchProjectMembers(projectId));
      setCollabSuccess("Invite email resent.");
      setTimeout(() => setCollabSuccess(null), 3000);
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to resend invite email"
      );
    } finally {
      setResendActionId(null);
    }
  };

  return (
    <section
      className="settings-panel"
      id="project"
      aria-labelledby="project-settings-title"
    >
      <div className="settings-panel-heading">
        <p className="settings-panel-eyebrow">Management</p>
        <h2 className="settings-panel-title" id="project-settings-title">
          {toUiTitleCase("project details")}
        </h2>
        <p className="settings-panel-description">
          Manage project name, team members, invites, and deletion.
        </p>
      </div>

      {!projectId ? (
        <div className="settings-note-card">
          <strong className="settings-note-title">No Project Selected.</strong>
          <p className="settings-note-copy">
            Select a project in the navigation to manage its settings.
          </p>
        </div>
      ) : (
        <div className="settings-tool-grid settings-tool-grid-project">
          {/* Project Name */}
          <article className="settings-tool-card settings-tool-card-compact settings-tool-card-name">
            <div className="settings-tool-heading">
              <h3 className="settings-tool-title">Project Name</h3>
              <p className="settings-tool-description">
                Rename the current project workspace.
              </p>
            </div>
            <form
              id="project-settings-name-form"
              onSubmit={handleRenameProject}
              className="settings-field"
            >
              <UiInput
                id="project-settings-name"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Project name"
                disabled={nameSaving}
              />
              {hasNameEdits ? (
                <div className="settings-actions settings-actions-name-project mt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={nameSaving || !trimmedNameInput}
                  >
                    {nameSaving ? "Saving..." : "Save Name"}
                  </Button>
                </div>
              ) : null}
            </form>
            {nameError && (
              <p
                className="settings-status settings-status-warning"
                role="status"
              >
                {nameError}
              </p>
            )}
            {nameSuccess && (
              <p
                className="settings-status settings-status-success"
                role="status"
              >
                {nameSuccess}
              </p>
            )}
          </article>

          {/* Members */}
          <article className="settings-tool-card settings-tool-card-compact">
            <div className="settings-tool-heading">
              <h3 className="settings-tool-title">Members</h3>
              <p className="settings-tool-description">
                Manage the team members in this project.
              </p>
            </div>
            <div
              className="settings-list settings-list-compact"
              role="list"
              aria-label="Current members"
            >
              {projectMembers.length === 0 && !collabLoading ? (
                <div className="settings-list-row">
                  <span className="settings-list-label tone-muted">
                    No members yet.
                  </span>
                </div>
              ) : (
                projectMembers.map((member) => {
                  const displayName =
                    member.user.name?.trim() || member.user.email;
                  return (
                    <div
                      key={member.userId}
                      className="settings-list-row settings-list-row-compact"
                      role="listitem"
                    >
                      <span className="settings-list-label settings-list-label-strong">
                        {displayName}
                        {member.role === "OWNER" ? " (Owner)" : ""}
                      </span>
                      <button
                        type="button"
                        className="settings-inline-btn settings-inline-btn-danger"
                        onClick={() => {
                          void handleRemoveMember(member.userId);
                        }}
                        disabled={
                          collabLoading || memberActionUserId === member.userId
                        }
                        title="Remove Member"
                      >
                        {memberActionUserId === member.userId
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          {/* Invites */}
          <article className="settings-tool-card settings-tool-card-project-invites">
            <div className="settings-tool-heading">
              <h3 className="settings-tool-title">Invites</h3>
              <p className="settings-tool-description">
                Invite new members by email or select existing organization
                users.
              </p>
            </div>
            <div className="project-settings-invite-stack">
              <form
                className="project-settings-inline-form"
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleInviteEmail();
                }}
              >
                <div className="project-settings-inline-field">
                  <UiInput
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Invite by email"
                    disabled={collabLoading || inviteSubmitting}
                  />
                </div>
                <Button
                  variant="secondary"
                  type="submit"
                  className="project-settings-action-btn"
                  disabled={
                    collabLoading || inviteSubmitting || !inviteEmail.trim()
                  }
                >
                  {inviteEmailSubmitting ? "Sending..." : "Send"}
                </Button>
              </form>

              <form
                className="project-settings-inline-form"
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleInviteMember();
                }}
              >
                <div className="project-settings-inline-field">
                  <UiSelect
                    value={inviteUserId}
                    onChange={(e) => setInviteUserId(e.target.value)}
                    disabled={collabLoading || inviteSubmitting}
                  >
                    <option value="">Select organization user...</option>
                    {inviteableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name?.trim() || user.email}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <Button
                  variant="secondary"
                  type="submit"
                  className="project-settings-action-btn"
                  disabled={
                    collabLoading || inviteSubmitting || !inviteUserId.trim()
                  }
                >
                  {inviteMemberSubmitting ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>

            <Text
              as="h4"
              variant="label"
              tone="muted"
              weight="semibold"
              className="project-settings-subtitle"
            >
              Pending Invites
            </Text>
            <div
              className="settings-list settings-list-compact"
              role="list"
              aria-label="Pending invites"
            >
              {projectInvites.length === 0 ? (
                <div className="settings-list-row">
                  <span className="settings-list-label tone-muted">
                    No pending invites.
                  </span>
                </div>
              ) : (
                projectInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="settings-list-row settings-list-row-compact"
                    role="listitem"
                  >
                    <span className="settings-list-label">{invite.email}</span>
                    <div className="settings-list-actions">
                      <button
                        type="button"
                        className="settings-inline-btn"
                        onClick={() => {
                          void handleResendInvite(invite);
                        }}
                        disabled={
                          collabLoading ||
                          inviteActionId === invite.id ||
                          resendActionId === invite.id
                        }
                      >
                        {resendActionId === invite.id
                          ? "Resending..."
                          : "Resend"}
                      </button>
                      <button
                        type="button"
                        className="settings-inline-btn settings-inline-btn-danger"
                        onClick={() => {
                          void handleRevokeInvite(invite.id);
                        }}
                        disabled={
                          collabLoading ||
                          inviteActionId === invite.id ||
                          resendActionId === invite.id
                        }
                      >
                        {inviteActionId === invite.id ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {collabError && (
              <p
                className="settings-status settings-status-warning mt-2"
                role="status"
              >
                {collabError}
              </p>
            )}
            {collabSuccess && (
              <p
                className="settings-status settings-status-success mt-2"
                role="status"
              >
                {collabSuccess}
              </p>
            )}
          </article>

          {/* Danger Zone */}
          {onDeleteProject && (
            <article className="settings-tool-card settings-tool-card-danger">
              <div className="settings-tool-heading">
                <h3 className="settings-tool-title">Delete Project</h3>
                <p className="settings-tool-description">
                  Permanently delete this project and all of its data. This
                  action cannot be undone.
                </p>
              </div>
              <div className="settings-actions settings-actions-start mt-4">
                <Button
                  variant="danger"
                  onClick={() => {
                    if (!projectId) return;
                    void onDeleteProject(projectId, projectName);
                  }}
                  disabled={nameSaving || collabLoading || inviteSubmitting}
                >
                  Delete Project
                </Button>
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
