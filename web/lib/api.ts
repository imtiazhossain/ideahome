import {
  pathExpensesDeleteImported,
  pathCalendarGoogleStatus,
  pathCalendarGoogleConnect,
  pathCalendarGoogleCalendars,
  pathCalendarGoogleCalendarSelection,
  pathCalendarGoogleSync,
  pathCalendarGoogleDisconnect,
  pathCalendarEvents,
  pathCalendarEventById,
  type CalendarEvent as SharedCalendarEvent,
  type CalendarGoogleCalendar as SharedCalendarGoogleCalendar,
  type CalendarGoogleStatus as SharedCalendarGoogleStatus,
  type CreateCalendarEventInput,
  type UpdateCalendarEventInput,
} from "@ideahome/shared-config";
import {
  APPEARANCE_PRESET_IDS,
  API_REQUEST_HEADER as SHARED_API_REQUEST_HEADER,
  ASSISTANT_VOICE_CHANGE_EVENT as SHARED_ASSISTANT_VOICE_CHANGE_EVENT,
  AUTH_CHANGE_EVENT as SHARED_AUTH_CHANGE_EVENT,
  AUTH_TOKEN_COOKIE_KEY as SHARED_AUTH_TOKEN_COOKIE_KEY,
  AUTH_TOKEN_KEY as SHARED_AUTH_TOKEN_KEY,
  AUTH_TOKEN_SESSION_KEY as SHARED_AUTH_TOKEN_SESSION_KEY,
  NATIVE_BRIDGE_AUTH_CHANGE,
  STATUS_OPTIONS,
  pathCommentAttachmentById,
  pathCommentAttachments,
  pathExpenseById,
  pathExpenses,
  pathOrganizations,
  pathOrganizationsEnsure,
  pathIssueById,
  pathIssueFileById,
  pathIssueFiles,
  pathIssueFileStream,
  pathIssueCommentById,
  pathIssueComments,
  pathIssueRecordingById,
  pathIssueRecordings,
  pathIssueScreenshotById,
  pathIssueScreenshots,
  pathIssueStatus,
  pathIssues,
  pathIssuesBulk,
  pathProjectInvites,
  pathProjectMembers,
  pathRecordingStream,
  pathScreenshotStream,
  pathProjectById,
  pathProjects,
  pathTestsRunApi,
  pathTestsRunUi,
  pathSupportErrorReport,
  pathUsers,
  pathUsersMeAppearance,
} from "@ideahome/shared";
import type {
  AppearancePreferences as SharedAppearancePreferences,
  AppearancePresetId as SharedAppearancePresetId,
  AddCommentAttachmentInput,
  CommentAttachment as SharedCommentAttachment,
  CommentAttachmentType as SharedCommentAttachmentType,
  CreateExpenseInput,
  CreateIssueCommentInput,
  CreateIssueInput,
  CreateProjectInput,
  Expense as SharedExpense,
  Issue as SharedIssue,
  IssueComment as SharedIssueComment,
  Organization as SharedOrganization,
  IssueCommentEditHistoryEntry as SharedIssueCommentEditHistoryEntry,
  IssueFile as SharedIssueFile,
  IssueRecording as SharedIssueRecording,
  IssueScreenshot as SharedIssueScreenshot,
  Project as SharedProject,
  ProjectQualityScoreConfig as SharedProjectQualityScoreConfig,
  QualityScoreItemId as SharedQualityScoreItemId,
  QualityScoreWeights as SharedQualityScoreWeights,
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
} from "@ideahome/shared";
import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "./storage";
import { createAssistantApi, type ElevenLabsVoice } from "./api/assistant";
import {
  createCheckableApis,
  type Bug,
  type Enhancement,
  type Feature,
  type Idea,
  type IdeaAssistantChatResult,
  type IdeaPlan,
  type Todo,
} from "./api/checkable-entities";

/** Backend API base URL. Always absolute so requests never go to the current page origin. */
function readPublicEnv(name: string): string | undefined {
  const maybeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return maybeProcess?.env?.[name];
}

const API_BASE_RAW = readPublicEnv("NEXT_PUBLIC_API_URL") || "";
const API_BASE_DEFAULT = "http://localhost:3001";
const SKIP_LOGIN_DEV =
  process.env.NEXT_PUBLIC_SKIP_LOGIN_DEV ??
  readPublicEnv("NEXT_PUBLIC_SKIP_LOGIN_DEV");

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
export const AUTH_TOKEN_KEY = SHARED_AUTH_TOKEN_KEY;
/** sessionStorage key for SSO JWT. */
export const AUTH_TOKEN_SESSION_KEY = SHARED_AUTH_TOKEN_SESSION_KEY;
/** cookie key for browser-managed auth (used by media tags that cannot set Authorization headers). */
export const AUTH_TOKEN_COOKIE_KEY = SHARED_AUTH_TOKEN_COOKIE_KEY;

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
export const API_REQUEST_HEADER = SHARED_API_REQUEST_HEADER;
export const BACKEND_CONNECTIVITY_CHANGE_EVENT =
  "ideahome-backend-connectivity-change";

let backendOffline = false;

function dispatchBackendConnectivityChange(offline: boolean): void {
  if (backendOffline === offline) return;
  backendOffline = offline;
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BACKEND_CONNECTIVITY_CHANGE_EVENT, {
      detail: { offline, at: Date.now() },
    })
  );
}

/** True when recent API requests failed with a network-level backend connectivity error. */
export function isBackendOffline(): boolean {
  return backendOffline;
}

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
  try {
    const response = await fetch(input, { ...init, headers });
    dispatchBackendConnectivityChange(false);
    if (response.status === 401) {
      handleUnauthorizedResponse();
    }
    return response;
  } catch (err) {
    if (isLikelyNetworkFetchError(err)) {
      dispatchBackendConnectivityChange(true);
    }
    throw err;
  }
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

export async function requestJson<T>(
  path: string,
  options: RequestOptions
): Promise<T> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.json();
}

export async function requestBlob(
  path: string,
  options: RequestOptions
): Promise<Blob> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
  return r.blob();
}

export async function requestVoid(
  path: string,
  options: RequestOptions
): Promise<void> {
  const r = await apiFetch(`${getApiBase()}${path}`, buildRequestInit(options));
  if (!r.ok) await throwFromResponse(r, options.errorMessage);
}

export async function sendErrorReportEmail(body: {
  errorMessage: string;
  pageUrl?: string;
}): Promise<void> {
  return requestVoid(pathSupportErrorReport(), {
    method: "POST",
    body,
    errorMessage: "Failed to send error report",
  });
}

/** When true, app does not redirect to login (use with backend SKIP_AUTH_DEV in local dev). */
export function isSkipLoginDev(): boolean {
  return SKIP_LOGIN_DEV === "true";
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
export const AUTH_CHANGE_EVENT = SHARED_AUTH_CHANGE_EVENT;
export const ASSISTANT_VOICE_CHANGE_EVENT = SHARED_ASSISTANT_VOICE_CHANGE_EVENT;

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
  // Notify native app (WebView) so it can clear its token and show auth screen
  try {
    const w = window as Window & {
      ReactNativeWebView?: { postMessage: (m: string) => void };
    };
    if (w.ReactNativeWebView) {
      w.ReactNativeWebView.postMessage(
        JSON.stringify({ type: NATIVE_BRIDGE_AUTH_CHANGE, token: "" })
      );
    }
  } catch {
    // ignore
  }
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
 * When the web app is loaded in the mobile WebView from a LAN URL (e.g. http://192.168.68.106:3000),
 * use the same host with port 3001 so API requests reach the Mac's backend. Otherwise the device
 * would request localhost:3001 (its own loopback) and fail.
 */
function getMobileDevApiBase(): string | null {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  // Private/LAN IP ranges
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return `http://${hostname}:3001`;
  return null;
}

/**
 * Backend base URL. In the browser, if the configured API URL is the same as the current page origin,
 * we use "" (same-origin) so Next.js rewrites can proxy /issues, /projects, etc. to the backend.
 * When loaded from a LAN URL (mobile WebView dev), we use the same host with port 3001.
 * Otherwise we use the resolved backend URL (e.g. http://localhost:3001).
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const mobileBase = getMobileDevApiBase();
    if (mobileBase) return mobileBase;
    const host = window.location.hostname;
    if (!API_BASE_RAW) {
      if (host !== "localhost" && host !== "127.0.0.1") {
        return "";
      }
    }
    if (
      (API_BASE_RESOLVED === "http://localhost:3001" ||
        API_BASE_RESOLVED === "http://127.0.0.1:3001") &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
      return "";
    }
    if (window.location.origin === API_BASE_RESOLVED) return "";
  }
  return API_BASE_RESOLVED;
}

/** Backend base URL (static). Prefer getApiBase() in browser so requests never target the current page. */
export const API_BASE = API_BASE_RESOLVED;

export type User = SharedUser;
export type AppearancePresetId = SharedAppearancePresetId;
export type AppearancePreferences = SharedAppearancePreferences;
export type Organization = SharedOrganization;
export type Project = SharedProject;
export type ProjectQualityScoreConfig = SharedProjectQualityScoreConfig;
export type QualityScoreItemId = SharedQualityScoreItemId;
export type QualityScoreWeights = SharedQualityScoreWeights;
export type ProjectMember = {
  userId: string;
  role: string;
  createdAt: string;
  user: User;
};
export type ProjectInvite = {
  id: string;
  email: string;
  createdAt: string;
  invitedByUserId: string | null;
};
export type IssueRecording = SharedIssueRecording;
export type IssueScreenshot = SharedIssueScreenshot;
export type IssueFile = SharedIssueFile;
export type Issue = SharedIssue;
export type RunUiTestResult = SharedRunUiTestResult;
export type RunApiTestResult = SharedRunApiTestResult;

export const STATUSES = STATUS_OPTIONS;
export const APPEARANCE_PRESETS = APPEARANCE_PRESET_IDS;

export type ProjectCodeRepository = {
  id: string;
  projectId: string;
  provider: string;
  repoFullName: string;
  defaultBranch: string | null;
  createdAt: string;
};

export type ProjectCodeAnalysisRun = {
  id: string;
  codeRepositoryId: string;
  payload: unknown;
  createdAt: string;
};

export async function fetchProjectCodeRepositories(
  projectId: string
): Promise<ProjectCodeRepository[]> {
  return requestJson<ProjectCodeRepository[]>(
    `/code/projects/${encodeURIComponent(projectId)}/repositories`,
    {
      errorMessage: "Failed to load project repositories",
    }
  );
}

export async function createGithubRepositoryForProject(
  projectId: string,
  body: { repoFullName: string; defaultBranch?: string }
): Promise<ProjectCodeRepository> {
  return requestJson<ProjectCodeRepository>(
    `/code/projects/${encodeURIComponent(projectId)}/repositories/github`,
    {
      method: "POST",
      body,
      errorMessage: "Failed to connect repository",
    }
  );
}

export async function fetchOrganizations(): Promise<Organization[]> {
  return requestJson<Organization[]>(pathOrganizations(), {
    errorMessage: "Failed to fetch organizations",
  });
}

export async function createOrganization(body: {
  name: string;
}): Promise<Organization> {
  return requestJson<Organization>(pathOrganizations(), {
    method: "POST",
    body,
    errorMessage: "Failed to create organization",
  });
}

/** Ensure the user has an organization (creates "My Workspace" if none). Returns the org. */
export async function ensureOrganization(): Promise<Organization> {
  return requestJson<Organization>(pathOrganizationsEnsure(), {
    method: "POST",
    errorMessage: "Failed to ensure organization",
  });
}

export async function fetchProjects(): Promise<Project[]> {
  return requestJson<Project[]>(pathProjects(), {
    errorMessage: "Failed to fetch projects",
  });
}

/** Create a project in the current user's workspace. Backend assigns the user's org. */
export async function createProject(
  body: CreateProjectInput
): Promise<Project> {
  return requestJson<Project>(pathProjects(), {
    method: "POST",
    body,
    errorMessage: "Failed to create project",
  });
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<Project> {
  return requestJson<Project>(pathProjectById(id), {
    method: "PUT",
    body: data,
    errorMessage: "Failed to update project",
  });
}

export async function deleteProject(id: string): Promise<void> {
  return requestVoid(pathProjectById(id), {
    method: "DELETE",
    errorMessage: "Failed to delete project",
  });
}

export async function fetchProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(pathProjectMembers(projectId), {
    errorMessage: "Failed to fetch project members",
  });
}

export async function inviteProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(pathProjectMembers(projectId), {
    method: "POST",
    body: { userId },
    errorMessage: "Failed to invite project member",
  });
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(
    `${pathProjectMembers(projectId)}/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to remove project member",
    }
  );
}

export async function fetchProjectInvites(
  projectId: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(pathProjectInvites(projectId), {
    errorMessage: "Failed to fetch project invites",
  });
}

export async function inviteProjectByEmail(
  projectId: string,
  email: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(pathProjectInvites(projectId), {
    method: "POST",
    body: { email },
    errorMessage: "Failed to send project invite",
  });
}

export async function revokeProjectInvite(
  projectId: string,
  inviteId: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(
    `${pathProjectInvites(projectId)}/${encodeURIComponent(inviteId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to revoke project invite",
    }
  );
}

export type {
  Todo,
  Idea,
  IdeaPlan,
  IdeaAssistantChatResult,
  Bug,
  Feature,
  Enhancement,
};

const checkableApis = createCheckableApis({
  requestJson,
  requestVoid,
  getUserScopedStorageKey,
});
const { todoApi, ideaApi, bugApi, featureApi } = checkableApis;

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
const assistantApi = createAssistantApi<Idea, IdeaAssistantChatResult>({
  requestJson,
  requestBlob,
});

export const generateIdeaPlan = assistantApi.generateIdeaPlan;
export const generateIdeaAssistantChat = assistantApi.generateIdeaAssistantChat;
export const generateListItemAssistantChat =
  assistantApi.generateListItemAssistantChat;
export const fetchOpenRouterModels = assistantApi.fetchOpenRouterModels;
export const fetchElevenLabsVoices = assistantApi.fetchElevenLabsVoices;
export const synthesizeIdeaChatSpeech = assistantApi.synthesizeIdeaChatSpeech;
export type { ElevenLabsVoice };

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

export const fetchEnhancements = checkableApis.fetchEnhancements;
export const createEnhancement = checkableApis.createEnhancement;
export const updateEnhancement = checkableApis.updateEnhancement;
export const deleteEnhancement = checkableApis.deleteEnhancement;
export const reorderEnhancements = checkableApis.reorderEnhancements;

export type Expense = SharedExpense;
export type CalendarEvent = SharedCalendarEvent;
export type CalendarGoogleStatus = SharedCalendarGoogleStatus;
export type CalendarGoogleCalendar = SharedCalendarGoogleCalendar;
export type TaxDocument = {
  id: string;
  fileUrl: string;
  fileName: string;
  sizeBytes: number;
  kind: string;
  taxYear: number | null;
  notes: string | null;
  textPreview: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchExpenses(projectId: string): Promise<Expense[]> {
  return requestJson<Expense[]>(pathExpenses(projectId), {
    errorMessage: "Failed to fetch expenses",
  });
}

export async function createExpense(
  body: CreateExpenseInput
): Promise<Expense> {
  return requestJson<Expense>(pathExpenses(), {
    method: "POST",
    body,
    errorMessage: "Failed to create expense",
  });
}

export async function updateExpense(
  id: string,
  data: UpdateExpenseInput
): Promise<Expense> {
  return requestJson<Expense>(pathExpenseById(id), {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update expense",
  });
}

export async function deleteExpense(id: string): Promise<void> {
  return requestVoid(pathExpenseById(id), {
    method: "DELETE",
    errorMessage: "Failed to delete expense",
  });
}

export async function fetchTaxDocuments(
  projectId: string
): Promise<TaxDocument[]> {
  return requestJson<TaxDocument[]>(
    `/tax-documents?projectId=${encodeURIComponent(projectId)}`,
    {
      errorMessage: "Failed to fetch tax documents",
    }
  );
}

export async function createTaxDocument(input: {
  projectId: string;
  fileName: string;
  fileBase64: string;
  kind?: string;
  taxYear?: number | null;
  notes?: string | null;
  textPreview?: string | null;
}): Promise<TaxDocument> {
  return requestJson<TaxDocument>("/tax-documents", {
    method: "POST",
    body: input,
    errorMessage: "Failed to upload tax document",
  });
}

export async function updateTaxDocument(
  id: string,
  input: {
    kind?: string;
    taxYear?: number | null;
    notes?: string | null;
    textPreview?: string | null;
  }
): Promise<TaxDocument> {
  return requestJson<TaxDocument>(`/tax-documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
    errorMessage: "Failed to update tax document",
  });
}

export async function deleteTaxDocument(id: string): Promise<void> {
  return requestVoid(`/tax-documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    errorMessage: "Failed to delete tax document",
  });
}

export async function downloadTaxDocument(id: string): Promise<Blob> {
  return requestBlob(`/tax-documents/${encodeURIComponent(id)}/download`, {
    errorMessage: "Failed to download tax document",
  });
}

/** Delete all imported (Plaid) expenses for a project. Returns { deleted: number }. */
export async function deleteAllImportedExpenses(
  projectId: string
): Promise<{ deleted: number }> {
  return requestJson<{ deleted: number }>(
    pathExpensesDeleteImported(projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to delete imported expenses",
    }
  );
}

/** Plaid: get a link token to open Plaid Link. */
export async function getPlaidLinkToken(): Promise<{ linkToken: string }> {
  return requestJson<{ linkToken: string }>("/plaid/link-token", {
    method: "POST",
    errorMessage: "Failed to get Plaid link",
  });
}

/** Plaid: exchange public token after user connects an account. */
export async function exchangePlaidToken(publicToken: string): Promise<{
  itemId: string;
  institutionName?: string;
}> {
  return requestJson<{ itemId: string; institutionName?: string }>(
    "/plaid/exchange",
    {
      method: "POST",
      body: { public_token: publicToken },
      errorMessage: "Failed to connect account",
    }
  );
}

/** Plaid: list linked bank/credit accounts. */
export type PlaidLinkedAccount = {
  id: string;
  itemId: string;
  institutionName: string | null;
  createdAt: string;
};

export async function fetchPlaidLinkedAccounts(): Promise<
  PlaidLinkedAccount[]
> {
  return requestJson<PlaidLinkedAccount[]>("/plaid/linked-accounts", {
    errorMessage: "Failed to load linked accounts",
  });
}

/** Plaid: rename a linked bank/credit account (user-editable display name). */
export async function renamePlaidLinkedAccount(
  plaidItemId: string,
  institutionName: string | null
): Promise<PlaidLinkedAccount> {
  return requestJson<PlaidLinkedAccount>(
    `/plaid/linked-accounts/${encodeURIComponent(plaidItemId)}`,
    {
      method: "PATCH",
      body: { institutionName },
      errorMessage: "Failed to rename account",
    }
  );
}

/** Plaid: sync transactions into expenses for the given project. */
export async function syncPlaidTransactions(projectId: string): Promise<{
  added: number;
  lastSyncedAt: string | null;
}> {
  return requestJson<{ added: number; lastSyncedAt: string | null }>(
    `/plaid/sync?projectId=${encodeURIComponent(projectId)}`,
    {
      method: "POST",
      errorMessage: "Failed to sync transactions",
    }
  );
}

/** Plaid: get last sync time for a project. */
export async function getPlaidLastSync(projectId: string): Promise<{
  lastSyncedAt: string | null;
}> {
  return requestJson<{ lastSyncedAt: string | null }>(
    `/plaid/last-sync?projectId=${encodeURIComponent(projectId)}`,
    { errorMessage: "Failed to load last sync" }
  );
}

/** Plaid: disconnect a linked account (removes link only; imported expenses remain). */
export async function disconnectPlaidLinkedAccount(
  plaidItemId: string
): Promise<void> {
  return requestVoid(
    `/plaid/linked-accounts/${encodeURIComponent(plaidItemId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to disconnect account",
    }
  );
}

export async function fetchCalendarGoogleStatus(
  projectId: string
): Promise<CalendarGoogleStatus> {
  return requestJson<CalendarGoogleStatus>(pathCalendarGoogleStatus(projectId), {
    errorMessage: "Failed to load Google Calendar status",
  });
}

export async function startGoogleCalendarConnect(
  projectId: string
): Promise<{ url: string }> {
  return requestJson<{ url: string }>(pathCalendarGoogleConnect(projectId), {
    method: "POST",
    errorMessage: "Failed to start Google Calendar connect",
  });
}

export async function fetchGoogleCalendars(
  projectId: string
): Promise<CalendarGoogleCalendar[]> {
  return requestJson<CalendarGoogleCalendar[]>(
    pathCalendarGoogleCalendars(projectId),
    { errorMessage: "Failed to load Google calendars" }
  );
}

export async function setGoogleCalendarSelection(
  projectId: string,
  googleCalendarId: string
): Promise<{ selectedCalendarId: string }> {
  return requestJson<{ selectedCalendarId: string }>(
    pathCalendarGoogleCalendarSelection(projectId),
    {
      method: "PATCH",
      body: { googleCalendarId },
      errorMessage: "Failed to update selected Google calendar",
    }
  );
}

export async function syncGoogleCalendar(
  projectId: string
): Promise<{
  upserted: number;
  deleted: number;
  lastSyncedAt: string;
  fullResync?: boolean;
}> {
  return requestJson<{
    upserted: number;
    deleted: number;
    lastSyncedAt: string;
    fullResync?: boolean;
  }>(pathCalendarGoogleSync(projectId), {
    method: "POST",
    errorMessage: "Failed to sync Google Calendar",
  });
}

export async function disconnectGoogleCalendar(
  projectId: string
): Promise<{ disconnected: boolean }> {
  return requestJson<{ disconnected: boolean }>(
    pathCalendarGoogleDisconnect(projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to disconnect Google Calendar",
    }
  );
}

export async function fetchCalendarEvents(
  projectId: string,
  start: string,
  end: string
): Promise<CalendarEvent[]> {
  return requestJson<CalendarEvent[]>(pathCalendarEvents(projectId, start, end), {
    errorMessage: "Failed to load calendar events",
  });
}

export async function createCalendarEvent(
  projectId: string,
  body: CreateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson<CalendarEvent>(pathCalendarEvents(projectId), {
    method: "POST",
    body,
    errorMessage: "Failed to create calendar event",
  });
}

export async function updateCalendarEvent(
  projectId: string,
  eventId: string,
  body: UpdateCalendarEventInput
): Promise<CalendarEvent> {
  return requestJson<CalendarEvent>(pathCalendarEventById(eventId, projectId), {
    method: "PATCH",
    body,
    errorMessage: "Failed to update calendar event",
  });
}

export async function deleteCalendarEvent(
  projectId: string,
  eventId: string
): Promise<{ deleted: boolean }> {
  return requestJson<{ deleted: boolean }>(
    pathCalendarEventById(eventId, projectId),
    {
      method: "DELETE",
      errorMessage: "Failed to delete calendar event",
    }
  );
}

export async function fetchUsers(): Promise<User[]> {
  return requestJson<User[]>(pathUsers(), {
    errorMessage: "Failed to fetch users",
  });
}

export async function fetchMyAppearancePrefs(): Promise<AppearancePreferences> {
  return requestJson<AppearancePreferences>(pathUsersMeAppearance(), {
    errorMessage: "Failed to fetch appearance preferences",
  });
}

export async function updateMyAppearancePrefs(input: {
  lightPreset: AppearancePresetId;
  darkPreset: AppearancePresetId;
}): Promise<AppearancePreferences> {
  return requestJson<AppearancePreferences>(pathUsersMeAppearance(), {
    method: "PUT",
    body: input,
    errorMessage: "Failed to save appearance preferences",
  });
}

export async function fetchIssues(projectId?: string): Promise<Issue[]> {
  return requestJson<Issue[]>(pathIssues(projectId), {
    errorMessage: "Failed to fetch issues",
  });
}

/** Fetch a single issue by id. */
export async function fetchIssue(id: string): Promise<Issue> {
  const r = await apiFetch(`${getApiBase()}${pathIssueById(id)}`);
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

/** Update only issue status (lane move). Persists to DB so it survives refresh. */
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

/** Delete all issues, optionally scoped by projectId. */
export async function deleteAllIssues(projectId?: string): Promise<void> {
  return requestVoid(pathIssuesBulk(projectId), {
    method: "DELETE",
    errorMessage: "Failed to delete issues",
  });
}

export async function runUiTest(grep: string): Promise<RunUiTestResult> {
  const body: RunUiTestInput = { grep };
  return requestJson<RunUiTestResult>(pathTestsRunUi(), {
    method: "POST",
    body,
    errorMessage: "Failed to run UI test",
  });
}

export async function runApiTest(
  testNamePattern: string
): Promise<RunApiTestResult> {
  const body: RunApiTestInput = { testNamePattern };
  return requestJson<RunApiTestResult>(pathTestsRunApi(), {
    method: "POST",
    body,
    errorMessage: "Failed to run API test",
  });
}

export type IssueCommentEditHistoryEntry = SharedIssueCommentEditHistoryEntry;
export type CommentAttachmentType = SharedCommentAttachmentType;
export type CommentAttachment = SharedCommentAttachment;
export type IssueComment = SharedIssueComment;
export {
  fetchIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  addCommentAttachment,
  deleteCommentAttachment,
  uploadIssueRecording,
  updateIssueRecording,
  deleteIssueRecording,
  getRecordingUrl,
  uploadIssueScreenshot,
  updateIssueScreenshot,
  deleteIssueScreenshot,
  getScreenshotUrl,
  uploadIssueFile,
  updateIssueFile,
  deleteIssueFile,
  getIssueFileUrl,
} from "./api/issueMedia";
