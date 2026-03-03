import {
  IDEAHOME_API_ORIGIN,
  ISSUE_STATUS_IDS,
  pathApiUiTests,
  pathCommentAttachmentById,
  pathCommentAttachments,
  pathExpenseById,
  pathExpenses,
  pathExpensesDeleteImported,
  pathIdeaAssistantChat,
  pathIssueById,
  pathIssueFileById,
  pathIssueFileStream,
  pathIssueFiles,
  pathIssueCommentById,
  pathIssueComments,
  pathIssueRecordingById,
  pathIssueRecordings,
  pathIssueScreenshotById,
  pathIssueScreenshots,
  pathIssueStatus,
  pathIssues,
  pathIssuesBulk,
  pathChecklistItem,
  pathChecklistList,
  pathChecklistReorder,
  pathProjectById,
  pathProjects,
  pathRecordingStream,
  pathScreenshotStream,
  pathTestsRunApi,
  pathTestsRunUi,
  pathUsers,
} from "@ideahome/shared-config";
import type {
  AddCommentAttachmentInput,
  ChecklistItem as SharedChecklistItem,
  CommentAttachment as SharedCommentAttachment,
  CommentAttachmentType as SharedCommentAttachmentType,
  CreateExpenseInput,
  CreateIssueCommentInput,
  CreateIssueInput,
  CreateProjectInput,
  Expense as SharedExpense,
  Issue as SharedIssue,
  IssueComment as SharedIssueComment,
  IssueFile as SharedIssueFile,
  IssueRecording as SharedIssueRecording,
  IssueScreenshot as SharedIssueScreenshot,
  Project as SharedProject,
  RunApiTestInput,
  RunApiTestResult as SharedRunApiTestResult,
  RunUiTestInput,
  RunUiTestResult as SharedRunUiTestResult,
  UpdateExpenseInput,
  UpdateIssueCommentInput,
  UpdateIssueInput,
  UpdateIssueStatusInput,
  UpdateProjectInput,
  User as SharedUser,
} from "@ideahome/shared-config";

export type Project = SharedProject;
export type User = SharedUser;
export type RunUiTestResult = SharedRunUiTestResult;
export type RunApiTestResult = SharedRunApiTestResult;

export type UITestSuite = {
  name: string;
  tests: string[];
};

export type UITestFile = {
  file: string;
  suites: UITestSuite[];
};

export type IdeaAssistantChatResult = {
  ideaId: string;
  createdCount: number;
  todos: ChecklistItem[];
  previewGifUrl?: string | null;
  message?: string;
};

export type Expense = SharedExpense;

export type Issue = SharedIssue;

export type IssueComment = SharedIssueComment;
export type CommentAttachment = SharedCommentAttachment;
export type CommentAttachmentType = SharedCommentAttachmentType;
export type IssueRecording = SharedIssueRecording;
export type IssueScreenshot = SharedIssueScreenshot;
export type IssueFile = SharedIssueFile;
export type ChecklistItem = SharedChecklistItem;

export const ISSUE_STATUSES = ISSUE_STATUS_IDS;

const APP_API_URL = IDEAHOME_API_ORIGIN;

async function request<T>(
  path: string,
  token: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${APP_API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function fetchProjects(token: string): Promise<Project[]> {
  return request<Project[]>(pathProjects(), token);
}

export function createProject(token: string, name: string): Promise<Project> {
  const body: CreateProjectInput = { name };
  return request<Project>(pathProjects(), token, { method: "POST", body });
}

export function updateProject(
  token: string,
  id: string,
  body: UpdateProjectInput
): Promise<Project> {
  return request<Project>(pathProjectById(id), token, {
    method: "PUT",
    body,
  });
}

export function deleteProject(token: string, id: string): Promise<void> {
  return request<void>(pathProjectById(id), token, { method: "DELETE" });
}

export function fetchIssues(
  token: string,
  projectId?: string,
  search?: string
): Promise<Issue[]> {
  return request<Issue[]>(pathIssues(projectId, search), token);
}

export function createIssue(
  token: string,
  body: CreateIssueInput
): Promise<Issue> {
  return request<Issue>(pathIssues(), token, { method: "POST", body });
}

export function updateIssueStatus(
  token: string,
  id: string,
  status: string
): Promise<Issue> {
  const body: UpdateIssueStatusInput = { status };
  return request<Issue>(pathIssueStatus(id), token, {
    method: "PATCH",
    body,
  });
}

export function updateIssue(
  token: string,
  id: string,
  body: UpdateIssueInput
): Promise<Issue> {
  return request<Issue>(pathIssueById(id), token, {
    method: "PUT",
    body,
  });
}

export function deleteIssue(token: string, id: string): Promise<void> {
  return request<void>(pathIssueById(id), token, { method: "DELETE" });
}

export function deleteAllIssues(token: string, projectId?: string): Promise<void> {
  return request<void>(pathIssuesBulk(projectId), token, { method: "DELETE" });
}

export function fetchIssueComments(token: string, issueId: string): Promise<IssueComment[]> {
  return request<IssueComment[]>(pathIssueComments(issueId), token);
}

export function createIssueComment(
  token: string,
  issueId: string,
  body: string
): Promise<IssueComment> {
  const payload: CreateIssueCommentInput = { body };
  return request<IssueComment>(pathIssueComments(issueId), token, {
    method: "POST",
    body: payload,
  });
}

export function updateIssueComment(
  token: string,
  issueId: string,
  commentId: string,
  body: string
): Promise<IssueComment> {
  const payload: UpdateIssueCommentInput = { body };
  return request<IssueComment>(pathIssueCommentById(issueId, commentId), token, {
    method: "PATCH",
    body: payload,
  });
}

export function deleteIssueComment(
  token: string,
  issueId: string,
  commentId: string
): Promise<void> {
  return request<void>(pathIssueCommentById(issueId, commentId), token, { method: "DELETE" });
}

export function deleteCommentAttachment(
  token: string,
  issueId: string,
  commentId: string,
  attachmentId: string
): Promise<IssueComment> {
  return request<IssueComment>(pathCommentAttachmentById(issueId, commentId, attachmentId), token, {
    method: "DELETE",
  });
}

export function addCommentAttachment(
  token: string,
  issueId: string,
  commentId: string,
  body: AddCommentAttachmentInput
): Promise<IssueComment> {
  return request<IssueComment>(pathCommentAttachments(issueId, commentId), token, {
    method: "POST",
    body,
  });
}

export function fetchExpenses(token: string, projectId: string): Promise<Expense[]> {
  return request<Expense[]>(pathExpenses(projectId), token);
}

export function fetchUsers(token: string): Promise<User[]> {
  return request<User[]>(pathUsers(), token);
}

export function runUiTest(token: string, grep: string): Promise<RunUiTestResult> {
  const body: RunUiTestInput = { grep };
  return request<RunUiTestResult>(pathTestsRunUi(), token, {
    method: "POST",
    body,
  });
}

export function runApiTest(token: string, testNamePattern: string): Promise<RunApiTestResult> {
  const body: RunApiTestInput = { testNamePattern };
  return request<RunApiTestResult>(pathTestsRunApi(), token, {
    method: "POST",
    body,
  });
}

export function generateIdeaAssistantChat(
  token: string,
  ideaId: string,
  context?: string
): Promise<IdeaAssistantChatResult> {
  const payload: { context?: string } = {};
  if (context?.trim()) payload.context = context.trim();
  return request<IdeaAssistantChatResult>(pathIdeaAssistantChat(ideaId), token, {
    method: "POST",
    body: payload,
  });
}

export async function fetchUiTestsCatalog(): Promise<UITestFile[]> {
  const response = await fetch(`${APP_API_URL}${pathApiUiTests()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  const parsed = (await response.json()) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const file = String((entry as { file?: unknown }).file ?? "").trim();
      const rawSuites = (entry as { suites?: unknown }).suites;
      const suites = Array.isArray(rawSuites)
        ? rawSuites
            .map((suite) => {
              if (!suite || typeof suite !== "object") return null;
              const name = String((suite as { name?: unknown }).name ?? "").trim();
              const testsRaw = (suite as { tests?: unknown }).tests;
              const tests = Array.isArray(testsRaw)
                ? testsRaw
                    .filter((test) => typeof test === "string")
                    .map((test) => String(test))
                : [];
              if (!name) return null;
              return { name, tests };
            })
            .filter((suite): suite is UITestSuite => Boolean(suite && suite.name))
        : [];
      if (!file) return null;
      return { file, suites };
    })
    .filter((entry): entry is UITestFile => Boolean(entry && entry.file));
}

export function createExpense(
  token: string,
  body: CreateExpenseInput
): Promise<Expense> {
  return request<Expense>(pathExpenses(), token, { method: "POST", body });
}

export function updateExpense(
  token: string,
  id: string,
  body: UpdateExpenseInput
): Promise<Expense> {
  return request<Expense>(pathExpenseById(id), token, {
    method: "PATCH",
    body,
  });
}

export function deleteExpense(token: string, id: string): Promise<void> {
  return request<void>(pathExpenseById(id), token, { method: "DELETE" });
}

export function deleteAllImportedExpenses(
  token: string,
  projectId: string
): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(
    pathExpensesDeleteImported(projectId),
    token,
    { method: "DELETE" }
  );
}

export function updateIssueRecording(
  token: string,
  issueId: string,
  recordingId: string,
  body: { mediaType?: "video" | "audio"; recordingType?: "screen" | "camera" | "audio"; name?: string | null }
): Promise<Issue> {
  return request<Issue>(pathIssueRecordingById(issueId, recordingId), token, {
    method: "PATCH",
    body,
  });
}

export function deleteIssueRecording(
  token: string,
  issueId: string,
  recordingId: string
): Promise<Issue> {
  return request<Issue>(pathIssueRecordingById(issueId, recordingId), token, {
    method: "DELETE",
  });
}

export function updateIssueScreenshot(
  token: string,
  issueId: string,
  screenshotId: string,
  body: { name?: string | null }
): Promise<Issue> {
  return request<Issue>(pathIssueScreenshotById(issueId, screenshotId), token, {
    method: "PATCH",
    body,
  });
}

export function deleteIssueScreenshot(
  token: string,
  issueId: string,
  screenshotId: string
): Promise<Issue> {
  return request<Issue>(pathIssueScreenshotById(issueId, screenshotId), token, {
    method: "DELETE",
  });
}

export function updateIssueFile(
  token: string,
  issueId: string,
  fileId: string,
  body: { fileName?: string }
): Promise<Issue> {
  return request<Issue>(pathIssueFileById(issueId, fileId), token, {
    method: "PATCH",
    body,
  });
}

export function deleteIssueFile(
  token: string,
  issueId: string,
  fileId: string
): Promise<Issue> {
  return request<Issue>(pathIssueFileById(issueId, fileId), token, {
    method: "DELETE",
  });
}

export function uploadIssueRecording(
  token: string,
  issueId: string,
  videoBase64: string,
  mediaType: "video" | "audio" = "video",
  recordingType: "screen" | "camera" | "audio" = "screen",
  fileName?: string
): Promise<Issue> {
  return request<Issue>(pathIssueRecordings(issueId), token, {
    method: "POST",
    body: { videoBase64, mediaType, recordingType, fileName },
  });
}

export function uploadIssueScreenshot(
  token: string,
  issueId: string,
  imageBase64: string,
  fileName?: string
): Promise<Issue> {
  return request<Issue>(pathIssueScreenshots(issueId), token, {
    method: "POST",
    body: { imageBase64, fileName },
  });
}

export function uploadIssueFile(
  token: string,
  issueId: string,
  fileBase64: string,
  fileName: string
): Promise<Issue> {
  return request<Issue>(pathIssueFiles(issueId), token, {
    method: "POST",
    body: { fileBase64, fileName },
  });
}

export function getScreenshotStreamUrl(imageUrl: string): string {
  const filename = imageUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${APP_API_URL}${pathScreenshotStream(filename)}`;
}

export function getRecordingStreamUrl(videoUrl: string): string {
  const filename = videoUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${APP_API_URL}${pathRecordingStream(filename)}`;
}

export function getIssueFileStreamUrl(issueId: string, fileId: string): string {
  return `${APP_API_URL}${pathIssueFileStream(issueId, fileId)}`;
}

export function fetchFeatures(token: string, projectId: string): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistList("features", projectId), token);
}

export function createFeature(
  token: string,
  body: { projectId: string; name: string; done?: boolean }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistList("features"), token, { method: "POST", body });
}

export function updateFeature(
  token: string,
  id: string,
  body: { name?: string; done?: boolean; order?: number }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistItem("features", id), token, {
    method: "PATCH",
    body,
  });
}

export function deleteFeature(token: string, id: string): Promise<void> {
  return request<void>(pathChecklistItem("features", id), token, { method: "DELETE" });
}

export function reorderFeatures(
  token: string,
  projectId: string,
  featureIds: string[]
): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistReorder("features"), token, {
    method: "POST",
    body: { projectId, featureIds },
  });
}

export function fetchTodos(token: string, projectId: string): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistList("todos", projectId), token);
}

export function createTodo(
  token: string,
  body: { projectId: string; name: string; done?: boolean }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistList("todos"), token, { method: "POST", body });
}

export function updateTodo(
  token: string,
  id: string,
  body: { name?: string; done?: boolean; order?: number }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistItem("todos", id), token, {
    method: "PATCH",
    body,
  });
}

export function deleteTodo(token: string, id: string): Promise<void> {
  return request<void>(pathChecklistItem("todos", id), token, { method: "DELETE" });
}

export function reorderTodos(
  token: string,
  projectId: string,
  todoIds: string[]
): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistReorder("todos"), token, {
    method: "POST",
    body: { projectId, todoIds },
  });
}

export function fetchIdeas(token: string, projectId: string): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistList("ideas", projectId), token);
}

export function createIdea(
  token: string,
  body: { projectId: string; name: string; done?: boolean }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistList("ideas"), token, { method: "POST", body });
}

export function updateIdea(
  token: string,
  id: string,
  body: { name?: string; done?: boolean; order?: number }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistItem("ideas", id), token, {
    method: "PATCH",
    body,
  });
}

export function deleteIdea(token: string, id: string): Promise<void> {
  return request<void>(pathChecklistItem("ideas", id), token, { method: "DELETE" });
}

export function reorderIdeas(
  token: string,
  projectId: string,
  ideaIds: string[]
): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistReorder("ideas"), token, {
    method: "POST",
    body: { projectId, ideaIds },
  });
}

export function fetchBugs(token: string, projectId: string): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistList("bugs", projectId), token);
}

export function createBug(
  token: string,
  body: { projectId: string; name: string; done?: boolean }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistList("bugs"), token, { method: "POST", body });
}

export function updateBug(
  token: string,
  id: string,
  body: { name?: string; done?: boolean; order?: number }
): Promise<ChecklistItem> {
  return request<ChecklistItem>(pathChecklistItem("bugs", id), token, {
    method: "PATCH",
    body,
  });
}

export function deleteBug(token: string, id: string): Promise<void> {
  return request<void>(pathChecklistItem("bugs", id), token, { method: "DELETE" });
}

export function reorderBugs(
  token: string,
  projectId: string,
  bugIds: string[]
): Promise<ChecklistItem[]> {
  return request<ChecklistItem[]>(pathChecklistReorder("bugs"), token, {
    method: "POST",
    body: { projectId, bugIds },
  });
}
