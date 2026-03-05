import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibleModal } from "./AccessibleModal";
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

export interface ProjectSettingsModalProps {
  open: boolean;
  onClose: () => void;
  projectId?: string;
  projectName: string;
  onRenameProject?: (projectId: string, name: string) => Promise<void> | void;
  onDeleteProject?: (projectId: string, name: string) => void | Promise<void>;
}

export function ProjectSettingsModal({
  open,
  onClose,
  projectId,
  projectName,
  onRenameProject,
  onDeleteProject,
}: ProjectSettingsModalProps) {
  const [nameInput, setNameInput] = useState(projectName);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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
    if (open) {
      setNameInput(projectName);
      setNameError(null);
    }
  }, [open, projectName]);

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
    if (!open || !projectId) {
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
  }, [loadCollaboration, open, projectId]);

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
    try {
      await Promise.resolve(onRenameProject(projectId, nextName));
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
    } catch (e) {
      setCollabError(
        e instanceof Error ? e.message : "Failed to resend invite email"
      );
    } finally {
      setResendActionId(null);
    }
  };

  return (
    <AccessibleModal open={open} onClose={onClose} title="Project settings">
      <div className="project-settings-modal" aria-live="polite">
        {projectId ? (
          <>
            <form
              id="project-settings-name-form"
              onSubmit={handleRenameProject}
              className="project-settings-modal-form"
            >
              <div className="form-group">
                <Text
                  as="label"
                  htmlFor="project-settings-name"
                  variant="label"
                  tone="muted"
                  weight="semibold"
                >
                  Project name
                </Text>
                <UiInput
                  id="project-settings-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Project name"
                  disabled={nameSaving}
                />
              </div>
              {nameError ? (
                <p className="project-settings-modal-error">{nameError}</p>
              ) : null}
            </form>

            <div className="project-settings-modal-divider" />

            <div className="project-settings-modal-section">
              <Text as="h3" variant="label" tone="muted" weight="semibold">
                Invites and members
              </Text>

              <form
                className="project-settings-modal-invite-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleInviteEmail();
                }}
              >
                <UiInput
                  className="project-settings-modal-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email"
                  disabled={collabLoading || inviteSubmitting}
                />
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={
                    collabLoading || inviteSubmitting || !inviteEmail.trim()
                  }
                >
                  {inviteEmailSubmitting ? "Sending..." : "Send"}
                </Button>
              </form>

              <form
                className="project-settings-modal-invite-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleInviteMember();
                }}
              >
                <UiSelect
                  className="app-select project-settings-modal-user-select"
                  value={inviteUserId}
                  onChange={(e) => setInviteUserId(e.target.value)}
                  disabled={collabLoading || inviteSubmitting}
                >
                  <option value="">Invite member...</option>
                  {inviteableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name?.trim() || user.email}
                    </option>
                  ))}
                </UiSelect>
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={
                    collabLoading || inviteSubmitting || !inviteUserId.trim()
                  }
                >
                  {inviteMemberSubmitting ? "Adding..." : "Add"}
                </Button>
              </form>

              {collabError ? (
                <p className="project-settings-modal-error">{collabError}</p>
              ) : null}
              {collabSuccess ? (
                <p className="project-settings-modal-success">{collabSuccess}</p>
              ) : null}

              <div className="project-settings-modal-list-wrap">
                <Text
                  as="p"
                  className="project-settings-modal-list-title"
                  variant="body"
                  tone="muted"
                  weight="medium"
                >
                  Members
                </Text>
                {projectMembers.length === 0 && !collabLoading ? (
                  <Text
                    as="p"
                    className="project-settings-modal-empty"
                    variant="body"
                    tone="muted"
                  >
                    No members yet.
                  </Text>
                ) : (
                  <ul className="project-settings-modal-list" role="list">
                    {projectMembers.map((member) => {
                      const displayName =
                        member.user.name?.trim() || member.user.email;
                      return (
                        <li key={member.userId} className="project-settings-modal-item">
                          <Text as="span" variant="body" tone="default" weight="medium">
                            {displayName}
                            {member.role === "OWNER" ? " (Owner)" : ""}
                          </Text>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              void handleRemoveMember(member.userId);
                            }}
                            disabled={
                              collabLoading || memberActionUserId === member.userId
                            }
                          >
                            {memberActionUserId === member.userId
                              ? "Removing..."
                              : "Remove"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="project-settings-modal-list-wrap">
                <Text
                  as="p"
                  className="project-settings-modal-list-title"
                  variant="body"
                  tone="muted"
                  weight="medium"
                >
                  Pending invites
                </Text>
                {projectInvites.length === 0 ? (
                  <Text
                    as="p"
                    className="project-settings-modal-empty"
                    variant="body"
                    tone="muted"
                  >
                    No pending invites.
                  </Text>
                ) : (
                  <ul className="project-settings-modal-list" role="list">
                    {projectInvites.map((invite) => (
                      <li key={invite.id} className="project-settings-modal-item">
                        <Text as="span" variant="body" tone="default" weight="medium">
                          {invite.email}
                        </Text>
                        <div className="project-settings-modal-item-actions">
                          <Button
                            variant="secondary"
                            size="sm"
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
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
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
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {onDeleteProject ? (
              <>
                <div className="project-settings-modal-divider" />
                <div className="project-settings-modal-actions">
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={() => {
                      if (!projectId) return;
                      onClose();
                      void onDeleteProject(projectId, projectName);
                    }}
                    disabled={nameSaving || collabLoading || inviteSubmitting}
                  >
                    Delete project
                  </Button>
                </div>
              </>
            ) : null}

            {hasNameEdits ? (
              <div className="modal-actions project-settings-modal-actions project-settings-modal-actions-bottom">
                <Button
                  type="submit"
                  form="project-settings-name-form"
                  variant="primary"
                  disabled={nameSaving || !trimmedNameInput}
                >
                  {nameSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="project-settings-modal-empty">
            Select a project to manage settings.
          </p>
        )}
      </div>
    </AccessibleModal>
  );
}
