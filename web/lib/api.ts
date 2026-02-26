/** Backend API base URL. Always absolute so requests never go to the current page origin. */
const API_BASE_RAW = process.env.NEXT_PUBLIC_API_URL || "";
const API_BASE_DEFAULT = "http://localhost:3001";

function resolveApiBase(raw: string): string {
  if (!raw) return API_BASE_DEFAULT;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return API_BASE_DEFAULT;
    }
    return raw.replace(/\/$/, "");
  } catch {
    return API_BASE_DEFAULT;
  }
}

const API_BASE_RESOLVED = resolveApiBase(API_BASE_RAW);

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** localStorage key for SSO JWT. */
export const AUTH_TOKEN_KEY = "ideahome_token";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Header sent on all API requests so Next.js rewrites only proxy these (not page navigation). */
export const API_REQUEST_HEADER = "X-Ideahome-Api";

/** fetch that includes JWT when present (for SSO). */
function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set(API_REQUEST_HEADER, "1");
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  return fetch(input, { ...init, headers });
}

function isLikelyNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err instanceof TypeError) return true;
  return /failed to fetch|networkerror|load failed/i.test(err.message);
}

async function readResponseMessage(r: Response): Promise<string | null> {
  try {
    const text = await r.text();
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
      const body = JSON.parse(trimmed) as { message?: string | string[] };
      if (typeof body?.message === "string" && body.message.trim()) {
        return body.message.trim();
      }
      if (Array.isArray(body?.message)) {
        const parts = body.message
          .filter((part): part is string => typeof part === "string")
          .map((part) => part.trim())
          .filter(Boolean);
        if (parts.length > 0) return parts.join(", ");
      }
    } catch {
      return trimmed.slice(0, 300);
    }
  } catch {
    // Ignore read/parse errors.
  }
  return null;
}

/** Throw an Error with the backend message when present, otherwise a default message (includes status for debugging). */
async function throwFromResponse(
  r: Response,
  defaultMessage: string
): Promise<never> {
  let message = (await readResponseMessage(r)) ?? defaultMessage;
  if (message === defaultMessage && r.status > 0) {
    message = `${defaultMessage} (${r.status})`;
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

/** Custom event dispatched when auth token changes (login/logout). */
export const AUTH_CHANGE_EVENT = "ideahome-auth-change";

function dispatchAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  dispatchAuthChange();
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  dispatchAuthChange();
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
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const json = atob(base64);
    const decoded = JSON.parse(json) as { sub?: string };
    return typeof decoded.sub === "string" && decoded.sub.trim()
      ? decoded.sub.trim()
      : null;
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
  "ideahome-project-nav-tabs-hidden",
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
  if (!r.ok) await throwFromResponse(r, "Failed to fetch organizations");
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
  if (!r.ok) await throwFromResponse(r, "Failed to create organization");
  return r.json();
}

/** Ensure the user has an organization (creates "My Workspace" if none). Returns the org. */
export async function ensureOrganization(): Promise<Organization> {
  const r = await apiFetch(`${getApiBase()}/organizations/ensure`, {
    method: "POST",
  });
  if (!r.ok) await throwFromResponse(r, "Failed to ensure organization");
  return r.json();
}

export async function fetchProjects(): Promise<Project[]> {
  const r = await apiFetch(`${getApiBase()}/projects`);
  if (!r.ok) await throwFromResponse(r, "Failed to fetch projects");
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
  const r = await apiFetch(
    `${getApiBase()}/projects/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to update project");
  return r.json();
}

export async function deleteProject(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok) await throwFromResponse(r, "Failed to delete project");
}

export type Todo = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Idea = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Bug = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Feature = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

type CheckableEntity = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

function createCheckableEntityApi<T extends CheckableEntity>(
  resource: "todos" | "ideas" | "bugs" | "features",
  singularLabel: "todo" | "idea" | "bug" | "feature",
  pluralLabel: "todos" | "ideas" | "bugs" | "features",
  reorderIdsKey: "todoIds" | "ideaIds" | "bugIds" | "featureIds"
) {
  return {
    async fetch(projectId: string): Promise<T[]> {
      const r = await apiFetch(
        `${getApiBase()}/${resource}?projectId=${encodeURIComponent(projectId)}`
      );
      if (!r.ok) await throwFromResponse(r, `Failed to fetch ${pluralLabel}`);
      return r.json();
    },
    async search(projectId: string, search: string): Promise<T[]> {
      if (!search.trim()) return [];
      const r = await apiFetch(
        `${getApiBase()}/${resource}?projectId=${encodeURIComponent(projectId)}&search=${encodeURIComponent(search.trim())}`
      );
      if (!r.ok) await throwFromResponse(r, `Failed to search ${pluralLabel}`);
      return r.json();
    },
    async create(body: {
      projectId: string;
      name: string;
      done?: boolean;
    }): Promise<T> {
      const r = await apiFetch(`${getApiBase()}/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) await throwFromResponse(r, `Failed to create ${singularLabel}`);
      return r.json();
    },
    async update(
      id: string,
      data: { name?: string; done?: boolean; order?: number }
    ): Promise<T> {
      const r = await apiFetch(`${getApiBase()}/${resource}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) await throwFromResponse(r, `Failed to update ${singularLabel}`);
      return r.json();
    },
    async remove(id: string): Promise<void> {
      const r = await apiFetch(`${getApiBase()}/${resource}/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) await throwFromResponse(r, `Failed to delete ${singularLabel}`);
    },
    async reorder(projectId: string, ids: string[]): Promise<T[]> {
      const payload: Record<string, unknown> = { projectId };
      payload[reorderIdsKey] = ids;
      const r = await apiFetch(`${getApiBase()}/${resource}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) await throwFromResponse(r, `Failed to reorder ${pluralLabel}`);
      return r.json();
    },
  };
}

const todoApi = createCheckableEntityApi<Todo>(
  "todos",
  "todo",
  "todos",
  "todoIds"
);
const ideaApi = createCheckableEntityApi<Idea>(
  "ideas",
  "idea",
  "ideas",
  "ideaIds"
);
const bugApi = createCheckableEntityApi<Bug>("bugs", "bug", "bugs", "bugIds");
const featureApi = createCheckableEntityApi<Feature>(
  "features",
  "feature",
  "features",
  "featureIds"
);

export const fetchTodos = todoApi.fetch;
/** Search todos by name within a project. */
export const fetchTodoSearch = todoApi.search;
export const createTodo = todoApi.create;
export const updateTodo = todoApi.update;
export const deleteTodo = todoApi.remove;
export const reorderTodos = todoApi.reorder;

export const fetchIdeas = ideaApi.fetch;
/** Search ideas by name within a project. */
export const fetchIdeaSearch = ideaApi.search;
export const createIdea = ideaApi.create;
export const updateIdea = ideaApi.update;
export const deleteIdea = ideaApi.remove;
export const reorderIdeas = ideaApi.reorder;

export const fetchBugs = bugApi.fetch;
/** Search bugs by name within a project. */
export const fetchBugSearch = bugApi.search;
export const createBug = bugApi.create;
export const updateBug = bugApi.update;
export const deleteBug = bugApi.remove;
export const reorderBugs = bugApi.reorder;

export const fetchFeatures = featureApi.fetch;
/** Search features by name within a project. */
export const fetchFeatureSearch = featureApi.search;
export const createFeature = featureApi.create;
export const updateFeature = featureApi.update;
export const deleteFeature = featureApi.remove;
export const reorderFeatures = featureApi.reorder;

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
  if (!r.ok) await throwFromResponse(r, "Failed to fetch expenses");
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
  if (!r.ok) await throwFromResponse(r, "Failed to create expense");
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
  const r = await apiFetch(`${getApiBase()}/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) await throwFromResponse(r, "Failed to update expense");
  return r.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const r = await apiFetch(`${getApiBase()}/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok) await throwFromResponse(r, "Failed to delete expense");
}

export async function fetchUsers(): Promise<User[]> {
  const r = await apiFetch(`${getApiBase()}/users`);
  if (!r.ok) await throwFromResponse(r, "Failed to fetch users");
  return r.json();
}

export async function fetchIssues(projectId?: string): Promise<Issue[]> {
  const base = getApiBase();
  const url = projectId
    ? `${base}/issues?projectId=${encodeURIComponent(projectId)}`
    : `${base}/issues`;
  const r = await apiFetch(url);
  if (!r.ok) await throwFromResponse(r, "Failed to fetch issues");
  return r.json();
}

/** Fetch a single issue by id. */
export async function fetchIssue(id: string): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${encodeURIComponent(id)}`);
  if (!r.ok) {
    if (r.status === 404) throw new Error("Issue not found");
    await throwFromResponse(r, "Failed to fetch issue");
  }
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
  if (!r.ok) await throwFromResponse(r, "Failed to search issues");
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
  if (!r.ok) await throwFromResponse(r, "Failed to create issue");
  return r.json();
}

export async function updateIssue(
  id: string,
  body: Record<string, unknown>
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${encodeURIComponent(id)}`, {
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

/** Update only issue status (lane move). Persists to DB so it survives refresh. */
export async function updateIssueStatus(
  id: string,
  status: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }
  );
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
  const r = await apiFetch(`${getApiBase()}/issues/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!r.ok) await throwFromResponse(r, "Failed to delete issue");
}

/** Delete all issues, optionally scoped by projectId. */
export async function deleteAllIssues(projectId?: string): Promise<void> {
  const base = getApiBase();
  const url = projectId
    ? `${base}/issues/bulk?projectId=${encodeURIComponent(projectId)}`
    : `${base}/issues/bulk`;
  const r = await apiFetch(url, { method: "DELETE" });
  if (!r.ok) await throwFromResponse(r, "Failed to delete issues");
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
    const r = await apiFetch(
      `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments`
    );
    if (!r.ok) {
      const detail = await readResponseMessage(r);
      throw new Error(
        `Failed to fetch comments (${r.status}${detail ? `: ${detail}` : ""}). Is the backend running on port 3001?`
      );
    }
    return r.json();
  } catch (e) {
    if (isLikelyNetworkFetchError(e)) {
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
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to add comment");
  return r.json();
}

export async function updateIssueComment(
  issueId: string,
  commentId: string,
  body: string
): Promise<IssueComment> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to update comment");
  return r.json();
}

export async function deleteIssueComment(
  issueId: string,
  commentId: string
): Promise<void> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to delete comment");
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
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/attachments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to add attachment to comment");
  return r.json();
}

export async function deleteCommentAttachment(
  issueId: string,
  commentId: string,
  attachmentId: string
): Promise<IssueComment> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to remove attachment");
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
  if (!r.ok) await throwFromResponse(r, "Failed to run test");
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
  if (!r.ok) await throwFromResponse(r, "Failed to run API test");
  return r.json();
}

export async function uploadIssueRecording(
  issueId: string,
  videoBase64: string,
  mediaType: "video" | "audio" = "video",
  recordingType: "screen" | "camera" | "audio" = "screen",
  fileName?: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/recordings`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64, mediaType, recordingType, fileName }),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to upload recording");
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
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/recordings/${encodeURIComponent(recordingId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to update recording");
  return r.json();
}

export async function deleteIssueRecording(
  issueId: string,
  recordingId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/recordings/${encodeURIComponent(recordingId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to delete recording");
  return r.json();
}

/** Full URL to stream a recording file from the backend (uses stream endpoint with correct Content-Type). */
export function getRecordingUrl(videoUrl: string): string {
  if (isHttpUrl(videoUrl)) return videoUrl;
  const filename = videoUrl.replace(/^.*\//, "");
  return `${getApiBase()}/issues/recordings/stream/${encodeURIComponent(filename)}`;
}

export async function uploadIssueScreenshot(
  issueId: string,
  imageBase64: string,
  fileName?: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/screenshots`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, fileName: fileName ?? undefined }),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to upload screenshot");
  return r.json();
}

export async function updateIssueScreenshot(
    issueId: string,
  screenshotId: string,
  data: { name?: string | null }
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/screenshots/${encodeURIComponent(screenshotId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to update screenshot");
  return r.json();
}

export async function deleteIssueScreenshot(
  issueId: string,
  screenshotId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/screenshots/${encodeURIComponent(screenshotId)}`,
    { method: "DELETE" }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to delete screenshot");
  return r.json();
}

/** Full URL to load a screenshot image from the backend. */
export function getScreenshotUrl(imageUrl: string): string {
  if (isHttpUrl(imageUrl)) return imageUrl;
  return `${getApiBase()}/${imageUrl}`;
}

export async function uploadIssueFile(
  issueId: string,
  fileBase64: string,
  fileName: string
): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}/issues/${encodeURIComponent(issueId)}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, fileName }),
  });
  if (!r.ok) await throwFromResponse(r, "Failed to upload file");
  return r.json();
}

export async function updateIssueFile(
  issueId: string,
  fileId: string,
  data: { fileName?: string }
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to update file");
  return r.json();
}

export async function deleteIssueFile(
  issueId: string,
  fileId: string
): Promise<Issue> {
  const r = await apiFetch(
    `${getApiBase()}/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
    }
  );
  if (!r.ok) await throwFromResponse(r, "Failed to delete file");
  return r.json();
}

/** Full URL to download an issue file (stream endpoint sets Content-Disposition). */
export function getIssueFileUrl(issueId: string, fileId: string): string {
  return `${getApiBase()}/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}/stream`;
}
