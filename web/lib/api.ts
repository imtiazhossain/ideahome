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

/** localStorage fallback key for SSO JWT (also cleaned on logout). */
export const AUTH_TOKEN_KEY = "ideahome_token";
/** sessionStorage key for SSO JWT. */
export const AUTH_TOKEN_SESSION_KEY = "ideahome_token_session";
/** cookie key for browser-managed auth (used by media tags that cannot set Authorization headers). */
export const AUTH_TOKEN_COOKIE_KEY = "ideahome_token";

function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionStorageSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore storage restrictions
  }
}

function safeSessionStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage restrictions
  }
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage restrictions
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage restrictions
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const needle = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(needle)) continue;
    const rawValue = trimmed.slice(needle.length);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

function setCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function authHeaders(): Record<string, string> {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Header sent on all API requests so Next.js rewrites only proxy these (not page navigation). */
export const API_REQUEST_HEADER = "X-Ideahome-Api";

let unauthorizedBlocked = false;

function handleUnauthorizedResponse(): void {
  if (typeof window === "undefined") return;
  if (isSkipLoginDev()) {
    clearStoredToken();
    return;
  }
  if (unauthorizedBlocked) return;
  unauthorizedBlocked = true;
  clearStoredToken();
  // In normal auth mode, move to login immediately.
  window.location.replace("/login");
}

/** fetch that includes JWT when present (for SSO). */
async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (unauthorizedBlocked && !getStoredToken()) {
    throw new Error("Unauthorized");
  }
  const headers = new Headers(init?.headers);
  headers.set(API_REQUEST_HEADER, "1");
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    handleUnauthorizedResponse();
  }
  return response;
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

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  errorMessage: string;
};

function buildRequestInit(options: RequestOptions): RequestInit {
  const { method, body, headers } = options;
  const mergedHeaders = new Headers(headers);
  if (body !== undefined && !mergedHeaders.has("Content-Type")) {
    mergedHeaders.set("Content-Type", "application/json");
  }
  return {
    ...(method ? { method } : {}),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(Array.from(mergedHeaders.keys()).length > 0
      ? { headers: mergedHeaders }
      : {}),
  };
}

async function requestJson<T>(
  path: string,
  options: RequestOptions
): Promise<T> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.json();
}

async function requestBlob(
  path: string,
  options: RequestOptions
): Promise<Blob> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.blob();
}

async function requestVoid(
  path: string,
  options: RequestOptions
): Promise<void> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
}

/** When true, app does not redirect to login (use with backend SKIP_AUTH_DEV in local dev). */
export function isSkipLoginDev(): boolean {
  return process.env.NEXT_PUBLIC_SKIP_LOGIN_DEV === "true";
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const sessionToken = safeSessionStorageGet(AUTH_TOKEN_SESSION_KEY)?.trim();
  if (sessionToken) return sessionToken;
  const cookieToken = readCookie(AUTH_TOKEN_COOKIE_KEY)?.trim();
  if (cookieToken) {
    safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, cookieToken);
    safeLocalStorageSet(AUTH_TOKEN_KEY, cookieToken);
    return cookieToken;
  }
  const fallbackToken = safeLocalStorageGet(AUTH_TOKEN_KEY)?.trim();
  if (!fallbackToken) return null;
  // Rehydrate session token for code paths that expect sessionStorage.
  safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, fallbackToken);
  setCookie(AUTH_TOKEN_COOKIE_KEY, fallbackToken);
  return fallbackToken;
}

/** Custom event dispatched when auth token changes (login/logout). */
export const AUTH_CHANGE_EVENT = "ideahome-auth-change";
export const ASSISTANT_VOICE_CHANGE_EVENT = "ideahome-assistant-voice-change";

function dispatchAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  unauthorizedBlocked = false;
  safeSessionStorageSet(AUTH_TOKEN_SESSION_KEY, token);
  // Keep a local fallback for browsers/webviews where sessionStorage is volatile.
  safeLocalStorageSet(AUTH_TOKEN_KEY, token);
  setCookie(AUTH_TOKEN_COOKIE_KEY, token);
  dispatchAuthChange();
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  safeLocalStorageRemove(AUTH_TOKEN_KEY);
  safeSessionStorageRemove(AUTH_TOKEN_SESSION_KEY);
  clearCookie(AUTH_TOKEN_COOKIE_KEY);
  dispatchAuthChange();
}

type JwtPayload = {
  sub?: unknown;
  email?: unknown;
};

function getDecodedTokenPayload(): JwtPayload | null {
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
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/** Decode JWT payload to get user id (sub). Used for user-scoped localStorage keys. */
export function getUserIdFromToken(): string | null {
  const payload = getDecodedTokenPayload();
  if (!payload) return null;
  return typeof payload.sub === "string" && payload.sub.trim()
    ? payload.sub.trim()
    : null;
}

export function getUserEmailFromToken(): string | null {
  const payload = getDecodedTokenPayload();
  if (!payload) return null;
  return typeof payload.email === "string" && payload.email.trim()
    ? payload.email.trim()
    : null;
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
    safeLocalStorageRemove(k);
  }
}

export function isAuthenticated(): boolean {
  if (isSkipLoginDev()) return true;
  return Boolean(getStoredToken());
}

const OPENROUTER_MODEL_STORAGE_PREFIX = "ideahome-openrouter-model";
const OPENROUTER_MODEL_STORAGE_LEGACY_KEY = "ideahome-openrouter-model";

function getOpenRouterModelStorageKey(): string {
  return getUserScopedStorageKey(
    OPENROUTER_MODEL_STORAGE_PREFIX,
    OPENROUTER_MODEL_STORAGE_LEGACY_KEY
  );
}

export function getStoredOpenRouterModel(): string | null {
  if (typeof window === "undefined") return null;
  const value = safeLocalStorageGet(getOpenRouterModelStorageKey())?.trim();
  return value || null;
}

export function setStoredOpenRouterModel(model: string): void {
  if (typeof window === "undefined") return;
  const normalized = model.trim();
  if (!normalized) return;
  safeLocalStorageSet(getOpenRouterModelStorageKey(), normalized);
}

const ASSISTANT_VOICE_STORAGE_PREFIX = "ideahome-assistant-voice-uri";
const ASSISTANT_VOICE_STORAGE_LEGACY_KEY = "ideahome-assistant-voice-uri";

function getAssistantVoiceStorageKey(): string {
  return getUserScopedStorageKey(
    ASSISTANT_VOICE_STORAGE_PREFIX,
    ASSISTANT_VOICE_STORAGE_LEGACY_KEY
  );
}

export function getStoredAssistantVoiceUri(): string | null {
  if (typeof window === "undefined") return null;
  const value = safeLocalStorageGet(getAssistantVoiceStorageKey())?.trim();
  return value || null;
}

export function setStoredAssistantVoiceUri(voiceUri: string): void {
  if (typeof window === "undefined") return;
  const normalized = voiceUri.trim();
  if (!normalized) return;
  safeLocalStorageSet(getAssistantVoiceStorageKey(), normalized);
  window.dispatchEvent(new CustomEvent(ASSISTANT_VOICE_CHANGE_EVENT));
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
  return requestJson<Organization[]>("/organizations", {
    errorMessage: "Failed to fetch organizations",
  });
}

export async function createOrganization(body: {
  name: string;
}): Promise<Organization> {
  return requestJson<Organization>("/organizations", {
    method: "POST",
    body,
    errorMessage: "Failed to create organization",
  });
}

/** Ensure the user has an organization (creates "My Workspace" if none). Returns the org. */
export async function ensureOrganization(): Promise<Organization> {
  return requestJson<Organization>("/organizations/ensure", {
    method: "POST",
    errorMessage: "Failed to ensure organization",
  });
}

export async function fetchProjects(): Promise<Project[]> {
  return requestJson<Project[]>("/projects", {
    errorMessage: "Failed to fetch projects",
  });
}

/** Create a project in the current user's workspace. Backend assigns the user's org. */
export async function createProject(body: { name: string }): Promise<Project> {
  return requestJson<Project>("/projects", {
    method: "POST",
    body,
    errorMessage: "Failed to create project",
  });
}

export async function updateProject(
  id: string,
  data: { name: string }
): Promise<Project> {
  return requestJson<Project>(`/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: data,
    errorMessage: "Failed to update project",
  });
}

export async function deleteProject(id: string): Promise<void> {
  return requestVoid(`/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorMessage: "Failed to delete project",
  });
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
  planJson?: IdeaPlan | null;
  planGeneratedAt?: string | null;
};

export type IdeaPlan = {
  summary: string;
  milestones: string[];
  tasks: string[];
  risks: string[];
  firstSteps: string[];
};

export type IdeaAssistantChatResult = {
  ideaId: string;
  createdCount: number;
  todos: Todo[];
  previewGifUrl?: string | null;
  message?: string;
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

export type Enhancement = {
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
      return requestJson<T[]>(
        `/${resource}?projectId=${encodeURIComponent(projectId)}`,
        { errorMessage: `Failed to fetch ${pluralLabel}` }
      );
    },
    async search(projectId: string, search: string): Promise<T[]> {
      if (!search.trim()) return [];
      return requestJson<T[]>(
        `/${resource}?projectId=${encodeURIComponent(projectId)}&search=${encodeURIComponent(search.trim())}`,
        { errorMessage: `Failed to search ${pluralLabel}` }
      );
    },
    async create(body: {
      projectId: string;
      name: string;
      done?: boolean;
    }): Promise<T> {
      return requestJson<T>(`/${resource}`, {
        method: "POST",
        body,
        errorMessage: `Failed to create ${singularLabel}`,
      });
    },
    async update(
      id: string,
      data: { name?: string; done?: boolean; order?: number }
    ): Promise<T> {
      return requestJson<T>(`/${resource}/${id}`, {
        method: "PATCH",
        body: data,
        errorMessage: `Failed to update ${singularLabel}`,
      });
    },
    async remove(id: string): Promise<void> {
      return requestVoid(`/${resource}/${id}`, {
        method: "DELETE",
        errorMessage: `Failed to delete ${singularLabel}`,
      });
    },
    async reorder(projectId: string, ids: string[]): Promise<T[]> {
      const payload: Record<string, unknown> = { projectId };
      payload[reorderIdsKey] = ids;
      return requestJson<T[]>(`/${resource}/reorder`, {
        method: "POST",
        body: payload,
        errorMessage: `Failed to reorder ${pluralLabel}`,
      });
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

export async function generateIdeaPlan(
  ideaId: string,
  context?: string,
  model?: string
): Promise<Idea> {
  const payload: { context?: string; model?: string } = {};
  const normalizedContext = typeof context === "string" ? context.trim() : "";
  const normalizedModel = typeof model === "string" ? model.trim() : "";
  if (normalizedContext) payload.context = normalizedContext;
  if (normalizedModel) payload.model = normalizedModel;
  return requestJson<Idea>(`/ideas/${encodeURIComponent(ideaId)}/plan`, {
    method: "POST",
    body: payload,
    errorMessage: "Failed to generate idea plan",
  });
}

export async function generateIdeaAssistantChat(
  ideaId: string,
  context?: string,
  model?: string,
  includeWeb?: boolean
): Promise<IdeaAssistantChatResult> {
  const payload: { context?: string; model?: string; includeWeb?: boolean } =
    {};
  const normalizedContext = typeof context === "string" ? context.trim() : "";
  const normalizedModel = typeof model === "string" ? model.trim() : "";
  if (normalizedContext) payload.context = normalizedContext;
  if (normalizedModel) payload.model = normalizedModel;
  if (includeWeb === true) payload.includeWeb = true;
  return requestJson<IdeaAssistantChatResult>(
    `/ideas/${encodeURIComponent(ideaId)}/assistant-chat`,
    {
      method: "POST",
      body: payload,
      errorMessage: "Failed to generate AI assistant response",
    }
  );
}

export async function generateListItemAssistantChat(
  projectId: string,
  itemName: string,
  context?: string,
  model?: string,
  includeWeb?: boolean
): Promise<IdeaAssistantChatResult> {
  const payload: {
    projectId: string;
    itemName: string;
    context?: string;
    model?: string;
    includeWeb?: boolean;
  } = {
    projectId: projectId.trim(),
    itemName: itemName.trim(),
  };
  const normalizedContext = typeof context === "string" ? context.trim() : "";
  const normalizedModel = typeof model === "string" ? model.trim() : "";
  if (normalizedContext) payload.context = normalizedContext;
  if (normalizedModel) payload.model = normalizedModel;
  if (includeWeb === true) payload.includeWeb = true;
  return requestJson<IdeaAssistantChatResult>("/ideas/assistant-chat", {
    method: "POST",
    body: payload,
    errorMessage: "Failed to generate AI assistant response",
  });
}

export async function fetchOpenRouterModels(): Promise<string[]> {
  const payload = (await requestJson<unknown>("/ideas/openrouter-models", {
    errorMessage: "Failed to fetch OpenRouter models",
  })) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export type ElevenLabsVoice = { id: string; name: string };

export async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const payload = (await requestJson<unknown>("/ideas/elevenlabs-voices", {
    errorMessage: "Failed to fetch ElevenLabs voices",
  })) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((entry): entry is ElevenLabsVoice =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        typeof (entry as ElevenLabsVoice).id === "string" &&
        typeof (entry as ElevenLabsVoice).name === "string"
      )
    )
    .map((entry) => ({ id: entry.id.trim(), name: entry.name.trim() }))
    .filter((entry) => Boolean(entry.id) && Boolean(entry.name));
}

export async function synthesizeIdeaChatSpeech(
  text: string,
  voiceId?: string
): Promise<Blob> {
  const payload: { text: string; voiceId?: string } = { text: text.trim() };
  if (voiceId?.trim()) payload.voiceId = voiceId.trim();
  return requestBlob("/ideas/tts", {
    method: "POST",
    body: payload,
    errorMessage: "Failed to synthesize speech",
  });
}

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

const ENHANCEMENTS_STORAGE_PREFIX = "ideahome-enhancements-list";
const ENHANCEMENTS_STORAGE_LEGACY_KEY = "ideahome-enhancements-list";

function getEnhancementsStorageKey(): string {
  return getUserScopedStorageKey(
    ENHANCEMENTS_STORAGE_PREFIX,
    ENHANCEMENTS_STORAGE_LEGACY_KEY
  );
}

function loadEnhancementsStore(): Enhancement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getEnhancementsStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Enhancement =>
      Boolean(
        item &&
        typeof item === "object" &&
        typeof (item as Enhancement).id === "string" &&
        typeof (item as Enhancement).name === "string" &&
        typeof (item as Enhancement).done === "boolean" &&
        typeof (item as Enhancement).order === "number" &&
        typeof (item as Enhancement).projectId === "string" &&
        typeof (item as Enhancement).createdAt === "string"
      )
    );
  } catch {
    return [];
  }
}

function saveEnhancementsStore(items: Enhancement[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getEnhancementsStorageKey(), JSON.stringify(items));
  } catch {
    // ignore
  }
}

function sortEnhancementsByOrder(items: Enhancement[]): Enhancement[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function createEnhancementId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `enh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchEnhancements(
  projectId: string
): Promise<Enhancement[]> {
  const all = loadEnhancementsStore();
  return sortEnhancementsByOrder(
    all.filter((item) => item.projectId === projectId)
  );
}

export async function createEnhancement(body: {
  projectId: string;
  name: string;
  done?: boolean;
}): Promise<Enhancement> {
  const all = loadEnhancementsStore();
  const projectItems = all.filter((item) => item.projectId === body.projectId);
  const nextOrder =
    projectItems.length === 0
      ? 0
      : Math.max(...projectItems.map((item) => item.order)) + 1;
  const created: Enhancement = {
    id: createEnhancementId(),
    name: body.name,
    done: Boolean(body.done),
    order: nextOrder,
    projectId: body.projectId,
    createdAt: new Date().toISOString(),
  };
  saveEnhancementsStore([...all, created]);
  return created;
}

export async function updateEnhancement(
  id: string,
  data: { name?: string; done?: boolean; order?: number }
): Promise<Enhancement> {
  const all = loadEnhancementsStore();
  const idx = all.findIndex((item) => item.id === id);
  if (idx === -1) throw new Error("Enhancement not found");
  const current = all[idx];
  const updated: Enhancement = {
    ...current,
    ...(typeof data.name === "string" ? { name: data.name } : {}),
    ...(typeof data.done === "boolean" ? { done: data.done } : {}),
    ...(typeof data.order === "number" ? { order: data.order } : {}),
  };
  const next = [...all];
  next[idx] = updated;
  saveEnhancementsStore(next);
  return updated;
}

export async function deleteEnhancement(id: string): Promise<void> {
  const all = loadEnhancementsStore();
  const next = all.filter((item) => item.id !== id);
  saveEnhancementsStore(next);
}

export async function reorderEnhancements(
  projectId: string,
  ids: string[]
): Promise<Enhancement[]> {
  const all = loadEnhancementsStore();
  const projectItems = all.filter((item) => item.projectId === projectId);
  const byId = new Map(projectItems.map((item) => [item.id, item]));
  const uniqueIds = Array.from(new Set(ids)).filter((id) => byId.has(id));
  const missing = projectItems
    .map((item) => item.id)
    .filter((id) => !uniqueIds.includes(id));
  const orderedIds = [...uniqueIds, ...missing];
  const updatedProjectItems = orderedIds.map((id, order) => ({
    ...byId.get(id)!,
    order,
  }));
  const projectIdSet = new Set(projectItems.map((item) => item.id));
  const otherItems = all.filter((item) => !projectIdSet.has(item.id));
  const next = [...otherItems, ...updatedProjectItems];
  saveEnhancementsStore(next);
  return sortEnhancementsByOrder(updatedProjectItems);
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
  return requestJson<Expense[]>(
    `/expenses?projectId=${encodeURIComponent(projectId)}`,
    {
      errorMessage: "Failed to fetch expenses",
    }
  );
}

export async function createExpense(body: {
  projectId: string;
  amount: number;
  description: string;
  date: string;
  category?: string;
}): Promise<Expense> {
  return requestJson<Expense>("/expenses", {
    method: "POST",
    body,
    errorMessage: "Failed to create expense",
  });
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
  return requestJson<Expense>(`/expenses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update expense",
  });
}

export async function deleteExpense(id: string): Promise<void> {
  return requestVoid(`/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorMessage: "Failed to delete expense",
  });
}

export async function fetchUsers(): Promise<User[]> {
  return requestJson<User[]>("/users", {
    errorMessage: "Failed to fetch users",
  });
}

export async function fetchIssues(projectId?: string): Promise<Issue[]> {
  const path = projectId
    ? `/issues?projectId=${encodeURIComponent(projectId)}`
    : "/issues";
  return requestJson<Issue[]>(path, { errorMessage: "Failed to fetch issues" });
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
  const path = `/issues?projectId=${encodeURIComponent(projectId)}&search=${encodeURIComponent(search.trim())}`;
  return requestJson<Issue[]>(path, {
    errorMessage: "Failed to search issues",
  });
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
  return requestJson<Issue>("/issues", {
    method: "POST",
    body,
    errorMessage: "Failed to create issue",
  });
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
  return requestVoid(`/issues/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorMessage: "Failed to delete issue",
  });
}

/** Delete all issues, optionally scoped by projectId. */
export async function deleteAllIssues(projectId?: string): Promise<void> {
  const path = projectId
    ? `/issues/bulk?projectId=${encodeURIComponent(projectId)}`
    : "/issues/bulk";
  return requestVoid(path, {
    method: "DELETE",
    errorMessage: "Failed to delete issues",
  });
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
  return requestJson<IssueComment>(
    `/issues/${encodeURIComponent(issueId)}/comments`,
    {
      method: "POST",
      body: { body },
      errorMessage: "Failed to add comment",
    }
  );
}

export async function updateIssueComment(
  issueId: string,
  commentId: string,
  body: string
): Promise<IssueComment> {
  return requestJson<IssueComment>(
    `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: "PATCH",
      body: { body },
      errorMessage: "Failed to update comment",
    }
  );
}

export async function deleteIssueComment(
  issueId: string,
  commentId: string
): Promise<void> {
  return requestVoid(
    `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE", errorMessage: "Failed to delete comment" }
  );
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
  return requestJson<IssueComment>(
    `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/attachments`,
    {
      method: "POST",
      body,
      errorMessage: "Failed to add attachment to comment",
    }
  );
}

export async function deleteCommentAttachment(
  issueId: string,
  commentId: string,
  attachmentId: string
): Promise<IssueComment> {
  return requestJson<IssueComment>(
    `/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE", errorMessage: "Failed to remove attachment" }
  );
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
  return requestJson<RunUiTestResult>("/tests/run-ui", {
    method: "POST",
    body: { grep },
    errorMessage: "Failed to run test",
  });
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
  return requestJson<RunApiTestResult>("/tests/run-api", {
    method: "POST",
    body: { testNamePattern },
    errorMessage: "Failed to run API test",
  });
}

export async function uploadIssueRecording(
  issueId: string,
  videoBase64: string,
  mediaType: "video" | "audio" = "video",
  recordingType: "screen" | "camera" | "audio" = "screen",
  fileName?: string
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/recordings`,
    {
      method: "POST",
      body: { videoBase64, mediaType, recordingType, fileName },
      errorMessage: "Failed to upload recording",
    }
  );
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
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/recordings/${encodeURIComponent(recordingId)}`,
    {
      method: "PATCH",
      body: data,
      errorMessage: "Failed to update recording",
    }
  );
}

export async function deleteIssueRecording(
  issueId: string,
  recordingId: string
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/recordings/${encodeURIComponent(recordingId)}`,
    { method: "DELETE", errorMessage: "Failed to delete recording" }
  );
}

/** Full URL to stream a recording file from the backend (uses stream endpoint with correct Content-Type). */
export function getRecordingUrl(videoUrl: string): string {
  const filename = videoUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${getApiBase()}/issues/recordings/stream/${encodeURIComponent(filename)}`;
}

export async function uploadIssueScreenshot(
  issueId: string,
  imageBase64: string,
  fileName?: string
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/screenshots`,
    {
      method: "POST",
      body: { imageBase64, fileName: fileName ?? undefined },
      errorMessage: "Failed to upload screenshot",
    }
  );
}

export async function updateIssueScreenshot(
  issueId: string,
  screenshotId: string,
  data: { name?: string | null }
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/screenshots/${encodeURIComponent(screenshotId)}`,
    {
      method: "PATCH",
      body: data,
      errorMessage: "Failed to update screenshot",
    }
  );
}

export async function deleteIssueScreenshot(
  issueId: string,
  screenshotId: string
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/screenshots/${encodeURIComponent(screenshotId)}`,
    { method: "DELETE", errorMessage: "Failed to delete screenshot" }
  );
}

/** Full URL to load a screenshot image from the backend through authenticated stream endpoint. */
export function getScreenshotUrl(imageUrl: string): string {
  const filename = imageUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${getApiBase()}/issues/screenshots/stream/${encodeURIComponent(filename)}`;
}

export async function uploadIssueFile(
  issueId: string,
  fileBase64: string,
  fileName: string
): Promise<Issue> {
  return requestJson<Issue>(`/issues/${encodeURIComponent(issueId)}/files`, {
    method: "POST",
    body: { fileBase64, fileName },
    errorMessage: "Failed to upload file",
  });
}

export async function updateIssueFile(
  issueId: string,
  fileId: string,
  data: { fileName?: string }
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "PATCH",
      body: data,
      errorMessage: "Failed to update file",
    }
  );
}

export async function deleteIssueFile(
  issueId: string,
  fileId: string
): Promise<Issue> {
  return requestJson<Issue>(
    `/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to delete file",
    }
  );
}

/** Full URL to download an issue file (stream endpoint sets Content-Disposition). */
export function getIssueFileUrl(issueId: string, fileId: string): string {
  return `${getApiBase()}/issues/${encodeURIComponent(issueId)}/files/${encodeURIComponent(fileId)}/stream`;
}
