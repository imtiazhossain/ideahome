import {
  STATUS_OPTIONS,
  pathIssueById,
  pathIssueStatus,
  pathIssues,
  pathIssuesBulk,
} from "@ideahome/shared";
import type {
  CommentAttachmentType as SharedCommentAttachmentType,
  CreateIssueInput,
  Issue as SharedIssue,
  IssueComment as SharedIssueComment,
  UpdateIssueInput,
  UpdateIssueStatusInput,
} from "@ideahome/shared";
import { apiFetch, getApiBase, readResponseMessage, requestJson, requestVoid } from "./http";

export type Issue = SharedIssue;
export type IssueComment = SharedIssueComment;
export type CommentAttachmentType = SharedCommentAttachmentType;
export const STATUSES = STATUS_OPTIONS;
export {
  fetchIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  addCommentAttachment,
  deleteCommentAttachment,
} from "./issueMedia";

export async function fetchIssues(projectId?: string): Promise<Issue[]> {
  return requestJson<Issue[]>(pathIssues(projectId), {
    errorMessage: "Failed to fetch issues",
  });
}

export async function fetchIssue(id: string): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}${pathIssueById(id)}`);
  if (!r.ok) {
    if (r.status === 404) throw new Error("Issue not found");
    const detail = await readResponseMessage(r);
    throw new Error(detail || "Failed to fetch issue");
  }
  return r.json();
}

export async function fetchIssueSearch(
  projectId: string,
  search: string
): Promise<Issue[]> {
  if (!search.trim()) return [];
  return requestJson<Issue[]>(pathIssues(projectId, search), {
    errorMessage: "Failed to search issues",
  });
}

export async function createIssue(body: CreateIssueInput): Promise<Issue> {
  return requestJson<Issue>(pathIssues(), {
    method: "POST",
    body,
    errorMessage: "Failed to create issue",
  });
}

export async function updateIssue(
  id: string,
  body: UpdateIssueInput
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}${pathIssueById(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const statusMsg =
      r.status === 401
        ? "Unauthorized"
        : r.status === 404
          ? "Issue not found"
          : `Server error (${r.status})`;
    const detail = await readResponseMessage(r);
    throw new Error(
      `Failed to save: ${statusMsg}${detail ? ` (${detail})` : ""}. Changes will not persist after refresh.`
    );
  }
  return r.json();
}

export async function updateIssueStatus(
  id: string,
  status: string
): Promise<Issue> {
  const payload: UpdateIssueStatusInput = { status };
  const r = await apiFetch(`${getApiBase()}${pathIssueStatus(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const statusMsg =
      r.status === 404 ? "Issue not found" : `Server error (${r.status})`;
    const detail = await readResponseMessage(r);
    throw new Error(
      `Failed to save status: ${statusMsg}${detail ? ` (${detail})` : ""}. Change will not persist after refresh.`
    );
  }
  return r.json();
}

export async function deleteIssue(id: string): Promise<void> {
  return requestVoid(pathIssueById(id), {
    method: "DELETE",
    errorMessage: "Failed to delete issue",
  });
}

export async function deleteAllIssues(projectId?: string): Promise<void> {
  return requestVoid(pathIssuesBulk(projectId), {
    method: "DELETE",
    errorMessage: "Failed to delete issues",
  });
}
