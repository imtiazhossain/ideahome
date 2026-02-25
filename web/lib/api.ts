/** Backend API base URL. Always absolute so requests never go to the current page origin. */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_URL || "";
const API_BASE_DEFAULT = "http://localhost:3001";
const API_BASE_RESOLVED =
  API_BASE_RAW && API_BASE_RAW.startsWith("http")
    ? API_BASE_RAW.replace(/\/$/, "")
    : API_BASE_DEFAULT;

/** localStorage key for SSO JWT. */
export const AUTH_TOKEN_KEY = "ideahome_token";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** fetch that includes JWT when present (for SSO). */
function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  return fetch(input, { ...init, headers });
}

/** Throw an Error with the backend message when present, otherwise a default message (includes status for debugging). */
async function throwFromResponse(r: Response, defaultMessage: string): Promise<never> {
  let message = defaultMessage;
  try {
    const body = (await r.json()) as { message?: string };
    if (typeof body?.message === "string" && body.message) {
      message = body.message;
    } else if (r.status > 0) {
      message = `${defaultMessage} (${r.status})`;
    }
  } catch {
    if (r.status > 0) message = `${defaultMessage} (${r.status})`;
  }
  throw new Error(message);
}

/** When true, app does not redirect to login (use with backend SKIP_AUTH_DEV in local dev). */
export function isSkipLoginDev(): boolean {
  return process.env.NEXT_PUBLIC_SKIP_LOGIN_DEV === "true";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/** Decode JWT payload to get user id (sub). Used for user-scoped localStorage keys. */
export function getUserIdFromToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = getStoredToken();
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const decoded = JSON.parse(json) as { sub?: string };
    return decoded.sub ?? null;
  } catch {
    return null;
  }
}

/** User-scoped localStorage key. Returns prefix-{userId} when authenticated, else legacyKey or prefix. */
export function getUserScopedStorageKey(
  prefix: string,
  legacyKey?: string
): string {
  const userId = getUserIdFromToken();
  return userId ? `${prefix}-${userId}` : (legacyKey ?? prefix);
}

/** Legacy localStorage keys cleared on logout. User-scoped keys (e.g. ideahome-ideas-list-{userId}) are NOT cleared so data persists per user. */
export const USER_SAVED_DATA_STORAGE_KEYS = [
  "ideahome-ideas-list",
  "ideahome-bugs-list",
  "ideahome-todo-list",
  "ideahome-features-list",
  "ideahome-expenses",
  "ideahome-costs-expenses",
  "ideahome-project-nav-tab-order",
] as const;

export function clearUserSavedData(): void {
  if (typeof window === "undefined") return;
  for (const k of USER_SAVED_DATA_STORAGE_KEYS) {
    localStorage.removeItem(k);
  }
}

export function isAuthenticated(): boolean {
  if (isSkipLoginDev()) return true;
  return Boolean(getStoredToken());
}

export function logout(redirectTo: string = "/login"): void {
  clearStoredToken();
  clearUserSavedData();
  if (typeof window === "undefined") return;
  window.location.href = redirectTo;
}

/**
 * Backend base URL. In the browser, if the configured API URL is the same as the current page origin,
 * we use "" (same-origin) so Next.js rewrites can proxy /issues, /projects, etc. to the backend.
 * Otherwise we use the resolved backend URL (e.g. http://localhost:3001).
 */
export function getApiBase(): string {
  if (
    typeof window !== "undefined" &&
    window.location.origin === API_BASE_RESOLVED
  ) {
    return "";
  }
  return API_BASE_RESOLVED;
}

/** Backend base URL (static). Prefer getApiBase() in browser so requests never target the current page. */
export const API_BASE = API_BASE_RESOLVED;

export type User = { id: string; email: string; name: string | null };
export type Organization = { id: string; name: string };
export type Project = { id: string; name: string };
export type IssueRecording = {
  id: string;
  videoUrl: string;
  mediaType?: "video" | "audio";
  recordingType?: "screen" | "camera" | "audio";
  name?: string | null;
  issueId: string;
  createdAt: string;
};

export type IssueScreenshot = {
  id: string;
  imageUrl: string;
  name?: string | null;
  issueId: string;
  createdAt: string;
};

export type IssueFile = {
  id: string;
  fileUrl: string;
  fileName: string;
  issueId: string;
  createdAt: string;
};

export type Issue = {
  id: string;
  key: string | null;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  database: string | null;
  api: string | null;
  testCases: string | null;
  automatedTest: string | null;
  status: string;
  qualityScore: number;
  projectId: string;
  assigneeId: string | null;
  assignee: User | null;
  project: Project;
  recordings: IssueRecording[];
  screenshots: IssueScreenshot[];
  files: IssueFile[];
  createdAt: string;
};

export const STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
] as const;

export async function fetchOrganizations(): Promise<Organization[]> {
  const r = await apiFetch(`${getApiBase()}/organizations`);
  if (!r.ok) throw new Error("Failed to fetch organizations");
  return r.json();
}

export async function createOrganization(body: {
  name: string;
}): Promise<Organization> {
  const r = await apiFetch(`${getApiBase()}/organizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create organization");
  return r.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const r = await apiFetch(`${getApiBase()}/projects`);
  if (!r.ok) throw new Error("Failed to fetch projects");
  return r.json();
}

/** Create a project in the current user's workspace. Backend assigns the user's org. */
export async function createProject(body: { name: string }): Promise<Project> {
  const r = await apiFetch(`${getApiBase()}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) await throwFromResponse(r, "Failed to create project");
  return r.json();
}

export async function updateProject(
  id: string,
  data: { name: string }
): Promise<Project> {
  const r = await apiFetch(`${getApiBase()}/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => ({ message: r.statusText }));
    const text =
      typeof msg.message === "string"
        ? msg.message
        : `Failed to update project (${r.status})`;
    throw new Error(text);
  }
  return r.json();
}

export async function deleteProject(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/projects/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => ({ message: r.statusText }));
    const text =
      typeof msg.message === "string"
        ? msg.message
        : `Server error (${r.status})`;
    throw new Error(text);
  }
}

export type Todo = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export async function fetchTodos(projectId: string): Promise<Todo[]> {
  const r = await apiFetch(
    `${getApiBase()}/todos?projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error("Failed to fetch todos");
  return r.json();
}

export async function createTodo(body: {
  projectId: string;
  name: string;
  done?: boolean;
}): Promise<Todo> {
  const r = await apiFetch(`${getApiBase()}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) await throwFromResponse(r, "Failed to create todo");
  return r.json();
}

export async function updateTodo(
  id: string,
  data: { name?: string; done?: boolean; order?: number }
): Promise<Todo> {
  const r = await apiFetch(`${getApiBase()}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update todo");
  return r.json();
}

export async function deleteTodo(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/todos/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete todo");
}

export async function reorderTodos(
  projectId: string,
  todoIds: string[]
): Promise<Todo[]> {
  const r = await apiFetch(`${getApiBase()}/todos/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, todoIds }),
  });
  if (!r.ok) throw new Error("Failed to reorder todos");
  return r.json();
}

export type Idea = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export async function fetchIdeas(projectId: string): Promise<Idea[]> {
  const r = await apiFetch(
    `${getApiBase()}/ideas?projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error("Failed to fetch ideas");
  return r.json();
}

export async function createIdea(body: {
  projectId: string;
  name: string;
  done?: boolean;
}): Promise<Idea> {
  const r = await apiFetch(`${getApiBase()}/ideas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create idea");
  return r.json();
}

export async function updateIdea(
  id: string,
  data: { name?: string; done?: boolean; order?: number }
): Promise<Idea> {
  const r = await apiFetch(`${getApiBase()}/ideas/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update idea");
  return r.json();
}

export async function deleteIdea(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/ideas/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to delete idea");
}

export async function reorderIdeas(
  projectId: string,
  ideaIds: string[]
): Promise<Idea[]> {
  const r = await apiFetch(`${getApiBase()}/ideas/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, ideaIds }),
  });
  if (!r.ok) throw new Error("Failed to reorder ideas");
  return r.json();
}

export type Bug = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export async function fetchBugs(projectId: string): Promise<Bug[]> {
  const r = await apiFetch(
    `${getApiBase()}/bugs?projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error("Failed to fetch bugs");
  return r.json();
}

export async function createBug(body: {
  projectId: string;
  name: string;
  done?: boolean;
}): Promise<Bug> {
  const r = await apiFetch(`${getApiBase()}/bugs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create bug");
  return r.json();
}

export async function updateBug(
  id: string,
  data: { name?: string; done?: boolean; order?: number }
): Promise<Bug> {
  const r = await apiFetch(`${getApiBase()}/bugs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update bug");
  return r.json();
}

export async function deleteBug(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/bugs/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Failed to delete bug");
}

export async function reorderBugs(
  projectId: string,
  bugIds: string[]
): Promise<Bug[]> {
  const r = await apiFetch(`${getApiBase()}/bugs/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, bugIds }),
  });
  if (!r.ok) throw new Error("Failed to reorder bugs");
  return r.json();
}

export type Feature = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export async function fetchFeatures(projectId: string): Promise<Feature[]> {
  const r = await apiFetch(
    `${getApiBase()}/features?projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error("Failed to fetch features");
  return r.json();
}

export async function createFeature(body: {
  projectId: string;
  name: string;
  done?: boolean;
}): Promise<Feature> {
  const r = await apiFetch(`${getApiBase()}/features`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create feature");
  return r.json();
}

export async function updateFeature(
  id: string,
  data: { name?: string; done?: boolean; order?: number }
): Promise<Feature> {
  const r = await apiFetch(`${getApiBase()}/features/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update feature");
  return r.json();
}

export async function deleteFeature(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/features/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to delete feature");
}

export async function reorderFeatures(
  projectId: string,
  featureIds: string[]
): Promise<Feature[]> {
  const r = await apiFetch(`${getApiBase()}/features/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, featureIds }),
  });
  if (!r.ok) throw new Error("Failed to reorder features");
  return r.json();
}

export type Expense = {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  projectId: string;
  createdAt: string;
};

export async function fetchExpenses(projectId: string): Promise<Expense[]> {
  const r = await apiFetch(
    `${getApiBase()}/expenses?projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error("Failed to fetch expenses");
  return r.json();
}

export async function createExpense(body: {
  projectId: string;
  amount: number;
  description: string;
  date: string;
  category?: string;
}): Promise<Expense> {
  const r = await apiFetch(`${getApiBase()}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create expense");
  return r.json();
}

export async function updateExpense(
  id: string,
  data: {
    amount?: number;
    description?: string;
    date?: string;
    category?: string;
  }
): Promise<Expense> {
  const r = await apiFetch(`${getApiBase()}/expenses/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to update expense");
  return r.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/expenses/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to delete expense");
}

export async function fetchUsers(): Promise<User[]> {
  const r = await apiFetch(`${getApiBase()}/users`);
  if (!r.ok) throw new Error("Failed to fetch users");
  return r.json();
}

export async function fetchIssues(projectId?: string): Promise<Issue[]> {
  const base = getApiBase();
  const url = projectId
    ? `${base}/issues?projectId=${encodeURIComponent(projectId)}`
    : `${base}/issues`;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error("Failed to fetch issues");
  return r.json();
}

/** Fetch a single issue by id. */
export async function fetchIssue(id: string): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${encodeURIComponent(id)}`);
  if (!r.ok)
    throw new Error(
      r.status === 404 ? "Issue not found" : "Failed to fetch issue"
    );
  return r.json();
}

/** Search issues within a project by text (title, description, etc.). */
export async function fetchIssueSearch(
  projectId: string,
  search: string
): Promise<Issue[]> {
  if (!search.trim()) return [];
  const base = getApiBase();
  const url = `${base}/issues?projectId=${encodeURIComponent(projectId)}&search=${encodeURIComponent(search.trim())}`;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error("Failed to search issues");
  return r.json();
}

export async function createIssue(body: {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  database?: string;
  api?: string;
  testCases?: string;
  automatedTest?: string;
  projectId: string;
  assigneeId?: string;
  qualityScore?: number;
}): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("Failed to create issue");
  return r.json();
}

export async function updateIssue(
  id: string,
  body: Record<string, unknown>
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg =
      r.status === 401
        ? "Unauthorized"
        : r.status === 404
          ? "Issue not found"
          : `Server error (${r.status})`;
    throw new Error(
      `Failed to save: ${msg}. Changes will not persist after refresh.`
    );
  }
  return r.json();
}

/** Update only issue status (lane move). Persists to DB so it survives refresh. */
export async function updateIssueStatus(
  id: string,
  status: string
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const msg =
      r.status === 404 ? "Issue not found" : `Server error (${r.status})`;
    throw new Error(
      `Failed to save status: ${msg}. Change will not persist after refresh.`
    );
  }
  return r.json();
}

export async function deleteIssue(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/issues/${id}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error("Failed to delete issue");
}

/** Delete all issues, optionally scoped by projectId. */
export async function deleteAllIssues(projectId?: string): Promise<void> {
  const base = getApiBase();
  const url = projectId
    ? `${base}/issues/bulk?projectId=${encodeURIComponent(projectId)}`
    : `${base}/issues/bulk`;
  const r = await apiFetch(url, { method: "DELETE" });
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`Failed to delete issues: ${r.status} ${msg || ""}`.trim());
  }
}

export type IssueCommentEditHistoryEntry = {
  body: string;
  editedAt: string;
};

export type CommentAttachmentType =
  | "screenshot"
  | "video"
  | "screen_recording"
  | "camera_recording"
  | "audio_recording";

export type CommentAttachment = {
  id: string;
  type: CommentAttachmentType;
  mediaUrl: string;
  commentId: string;
  createdAt: string;
};

export type IssueComment = {
  id: string;
  body: string;
  issueId: string;
  createdAt: string;
  editHistory?: IssueCommentEditHistoryEntry[];
  attachments?: CommentAttachment[];
};

export async function fetchIssueComments(
  issueId: string
): Promise<IssueComment[]> {
  try {
    const r = await apiFetch(`${getApiBase()}/issues/${issueId}/comments`);
    if (!r.ok)
      throw new Error(
        `Failed to fetch comments (${r.status}). Is the backend running on port 3001?`
      );
    return r.json();
  } catch (e) {
    if (e instanceof TypeError && e.message === "Failed to fetch") {
      throw new Error(
        "Failed to fetch comments. Is the backend running? Start it with: pnpm dev:backend"
      );
    }
    throw e;
  }
}

export async function createIssueComment(
  issueId: string,
  body: string
): Promise<IssueComment> {
  const r = await apiFetch(`${getApiBase()}/issues/${issueId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!r.ok) throw new Error("Failed to add comment");
  return r.json();
}

export async function updateIssueComment(
  issueId: string,
  commentId: string,
  body: string
): Promise<IssueComment> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/comments/${commentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  if (!r.ok)
    throw new Error(
      r.status === 404
        ? "Comment not found."
        : `Failed to update comment (${r.status}).`
    );
  return r.json();
}

export async function deleteIssueComment(
  issueId: string,
  commentId: string
): Promise<void> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/comments/${commentId}`,
    { method: "DELETE" }
  );
  if (!r.ok) {
    const msg =
      r.status === 404
        ? "Comment not found (may already be deleted)."
        : `Failed to delete comment (${r.status}).`;
    throw new Error(msg);
  }
}

export async function addCommentAttachment(
  issueId: string,
  commentId: string,
  body: {
    type: CommentAttachmentType;
    imageBase64?: string;
    videoBase64?: string;
  }
): Promise<IssueComment> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/comments/${commentId}/attachments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) {
    const text = await r.text();
    let msg = "Failed to add attachment to comment";
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (json.message)
        msg = Array.isArray(json.message)
          ? json.message.join(", ")
          : json.message;
    } catch {
      if (text) msg = `${msg}: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function deleteCommentAttachment(
  issueId: string,
  commentId: string,
  attachmentId: string
): Promise<IssueComment> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/comments/${commentId}/attachments/${attachmentId}`,
    { method: "DELETE" }
  );
  if (!r.ok) throw new Error("Failed to remove attachment");
  return r.json();
}

export type RunUiTestStep = { title: string; duration?: number };

export type RunUiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
  /** Steps from test.step() (from Playwright JSON report when available). */
  steps?: RunUiTestStep[];
  /** Frames sent by backend during run-ui-stream (for debugging). */
  screenshotCount?: number;
  /** Base64 WebM video of the test run. */
  videoBase64?: string;
};

export async function runUiTest(grep: string): Promise<RunUiTestResult> {
  const r = await apiFetch(`${getApiBase()}/tests/run-ui`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grep }),
  });
  if (!r.ok) throw new Error(`Failed to run test: ${r.statusText}`);
  return r.json();
}

export type RunApiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
};

export async function runApiTest(
  testNamePattern: string
): Promise<RunApiTestResult> {
  const r = await apiFetch(`${getApiBase()}/tests/run-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testNamePattern }),
  });
  if (!r.ok) throw new Error(`Failed to run API test: ${r.statusText}`);
  return r.json();
}

export async function uploadIssueRecording(
  issueId: string,
  videoBase64: string,
  mediaType: "video" | "audio" = "video",
  recordingType: "screen" | "camera" | "audio" = "screen",
  fileName?: string
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${issueId}/recordings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoBase64, mediaType, recordingType, fileName }),
  });
  if (!r.ok) throw new Error(`Failed to upload recording: ${r.statusText}`);
  return r.json();
}

export async function updateIssueRecording(
  issueId: string,
  recordingId: string,
  data: {
    mediaType?: "video" | "audio";
    recordingType?: "screen" | "camera" | "audio";
    name?: string | null;
  }
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/recordings/${recordingId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) throw new Error(`Failed to update recording: ${r.statusText}`);
  return r.json();
}

export async function deleteIssueRecording(
  issueId: string,
  recordingId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/recordings/${recordingId}`,
    { method: "DELETE" }
  );
  if (!r.ok) throw new Error(`Failed to delete recording: ${r.statusText}`);
  return r.json();
}

/** Full URL to stream a recording file from the backend (uses stream endpoint with correct Content-Type). */
export function getRecordingUrl(videoUrl: string): string {
  if (videoUrl.startsWith("http")) return videoUrl;
  const filename = videoUrl.replace(/^.*\//, "");
  return `${getApiBase()}/issues/recordings/stream/${encodeURIComponent(filename)}`;
}

export async function uploadIssueScreenshot(
  issueId: string,
  imageBase64: string,
  fileName?: string
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${issueId}/screenshots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, fileName: fileName ?? undefined }),
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => ({ message: r.statusText }));
    const detail =
      typeof (msg as { message?: string }).message === "string"
        ? (msg as { message: string }).message
        : r.statusText;
    throw new Error(`Failed to upload screenshot: ${detail} (${r.status})`);
  }
  return r.json();
}

export async function updateIssueScreenshot(
  issueId: string,
  screenshotId: string,
  data: { name?: string | null }
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/screenshots/${encodeURIComponent(screenshotId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) {
    const text = await r.text();
    let msg = `Failed to update screenshot: ${r.statusText}`;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (json.message)
        msg = Array.isArray(json.message)
          ? json.message.join(", ")
          : json.message;
    } catch {
      if (text) msg = `${msg}: ${text.slice(0, 200)}`;
    }
    throw new Error(msg);
  }
  return r.json();
}

export async function deleteIssueScreenshot(
  issueId: string,
  screenshotId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/screenshots/${encodeURIComponent(screenshotId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) throw new Error(`Failed to delete screenshot: ${r.statusText}`);
  return r.json();
}

/** Full URL to load a screenshot image from the backend. */
export function getScreenshotUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http")) return imageUrl;
  return `${getApiBase()}/${imageUrl}`;
}

export async function uploadIssueFile(
  issueId: string,
  fileBase64: string,
  fileName: string
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${issueId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, fileName }),
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => ({ message: r.statusText }));
    const text =
      typeof (msg as { message?: string }).message === "string"
        ? (msg as { message: string }).message
        : r.statusText;
    throw new Error(`Failed to upload file: ${text}`);
  }
  return r.json();
}

export async function updateIssueFile(
  issueId: string,
  fileId: string,
  data: { fileName?: string }
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/files/${fileId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) throw new Error(`Failed to update file: ${r.statusText}`);
  return r.json();
}

export async function deleteIssueFile(
  issueId: string,
  fileId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${issueId}/files/${fileId}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) throw new Error(`Failed to delete file: ${r.statusText}`);
  return r.json();
}

/** Full URL to download an issue file (stream endpoint sets Content-Disposition). */
export function getIssueFileUrl(issueId: string, fileId: string): string {
  return `${getApiBase()}/issues/${issueId}/files/${fileId}/stream`;
}
