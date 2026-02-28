function testNameToSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function enc(value) {
  return encodeURIComponent(String(value));
}

function readUrlParam(url, key) {
  if (!url) return "";
  const safeUrl = String(url).trim();
  if (!safeUrl) return "";

  try {
    const parsed = new URL(safeUrl);
    const queryValue = parsed.searchParams.get(key)?.trim() ?? "";
    if (queryValue) return queryValue;
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(key)?.trim() ?? "";
  } catch {
    const withoutHash = safeUrl.includes("#")
      ? safeUrl.slice(0, safeUrl.indexOf("#"))
      : safeUrl;
    const query = withoutHash.includes("?")
      ? withoutHash.slice(withoutHash.indexOf("?") + 1)
      : "";
    const queryParams = new URLSearchParams(query);
    const queryValue = queryParams.get(key)?.trim() ?? "";
    if (queryValue) return queryValue;
    const hash = safeUrl.includes("#")
      ? safeUrl.slice(safeUrl.indexOf("#") + 1)
      : "";
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(key)?.trim() ?? "";
  }
}

function sanitizeAuthToken(rawValue) {
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/#+$/g, "");
}

function projectNameToAcronym(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "PRJ";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => (w[0] ?? "").toUpperCase()).join("");
  }
  return trimmed.slice(0, 3).toUpperCase() || "PRJ";
}

function pathProjects() {
  return "/projects";
}

function pathProjectById(projectId) {
  return `/projects/${enc(projectId)}`;
}

function pathOrganizations() {
  return "/organizations";
}

function pathOrganizationsEnsure() {
  return "/organizations/ensure";
}

function pathIssues(projectId, search) {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", String(projectId));
  if (typeof search === "string" && search.trim()) params.set("search", search.trim());
  const q = params.toString();
  return q ? `/issues?${q}` : "/issues";
}

function pathIssueById(issueId) {
  return `/issues/${enc(issueId)}`;
}

function pathIssueStatus(issueId) {
  return `/issues/${enc(issueId)}/status`;
}

function pathIssuesBulk(projectId) {
  return projectId ? `/issues/bulk?projectId=${enc(projectId)}` : "/issues/bulk";
}

function pathIssueComments(issueId) {
  return `/issues/${enc(issueId)}/comments`;
}

function pathIssueCommentById(issueId, commentId) {
  return `/issues/${enc(issueId)}/comments/${enc(commentId)}`;
}

function pathCommentAttachments(issueId, commentId) {
  return `/issues/${enc(issueId)}/comments/${enc(commentId)}/attachments`;
}

function pathCommentAttachmentById(issueId, commentId, attachmentId) {
  return `${pathCommentAttachments(issueId, commentId)}/${enc(attachmentId)}`;
}

function pathTestsRunUi() {
  return "/tests/run-ui";
}

function pathTestsRunApi() {
  return "/tests/run-api";
}

function pathUsers() {
  return "/users";
}

function pathExpenses(projectId) {
  return projectId ? `/expenses?projectId=${enc(projectId)}` : "/expenses";
}

function pathExpenseById(expenseId) {
  return `/expenses/${enc(expenseId)}`;
}

function pathIssueRecordings(issueId) {
  return `/issues/${enc(issueId)}/recordings`;
}

function pathIssueRecordingById(issueId, recordingId) {
  return `${pathIssueRecordings(issueId)}/${enc(recordingId)}`;
}

function pathIssueScreenshots(issueId) {
  return `/issues/${enc(issueId)}/screenshots`;
}

function pathIssueScreenshotById(issueId, screenshotId) {
  return `${pathIssueScreenshots(issueId)}/${enc(screenshotId)}`;
}

function pathIssueFiles(issueId) {
  return `/issues/${enc(issueId)}/files`;
}

function pathIssueFileById(issueId, fileId) {
  return `${pathIssueFiles(issueId)}/${enc(fileId)}`;
}

function pathIssueFileStream(issueId, fileId) {
  return `${pathIssueFileById(issueId, fileId)}/stream`;
}

function pathRecordingStream(filename) {
  return `/issues/recordings/stream/${enc(filename)}`;
}

function pathScreenshotStream(filename) {
  return `/issues/screenshots/stream/${enc(filename)}`;
}

function pathChecklistList(resource, projectId, search) {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", String(projectId));
  if (typeof search === "string" && search.trim()) params.set("search", search.trim());
  const q = params.toString();
  return q ? `/${resource}?${q}` : `/${resource}`;
}

function pathChecklistItem(resource, itemId) {
  return `/${resource}/${enc(itemId)}`;
}

function pathChecklistReorder(resource) {
  return `/${resource}/reorder`;
}

function pathIdeaPlan(ideaId) {
  return `/ideas/${enc(ideaId)}/plan`;
}

function pathIdeaAssistantChat(ideaId) {
  return `/ideas/${enc(ideaId)}/assistant-chat`;
}

function pathIdeasAssistantChat() {
  return "/ideas/assistant-chat";
}

function pathIdeasOpenrouterModels() {
  return "/ideas/openrouter-models";
}

function pathIdeasElevenlabsVoices() {
  return "/ideas/elevenlabs-voices";
}

function pathIdeasTts() {
  return "/ideas/tts";
}

function pathAuthProviders() {
  return "/auth/providers";
}

function pathAuthGoogle() {
  return "/auth/google";
}

function pathAuthApple() {
  return "/auth/apple";
}

function pathAuthGithub() {
  return "/auth/github";
}

function pathAuthMobile(provider) {
  return `/auth/mobile/${enc(provider)}`;
}

function pathApiUiTests() {
  return "/api/ui-tests";
}

const ISSUE_STATUS_IDS = ["backlog", "todo", "in_progress", "done"];
const STATUS_OPTIONS = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];
const AUTH_TOKEN_KEY = "ideahome_token";
const AUTH_TOKEN_SESSION_KEY = "ideahome_token_session";
const AUTH_TOKEN_COOKIE_KEY = "ideahome_token";
const API_REQUEST_HEADER = "X-Ideahome-Api";
const AUTH_CHANGE_EVENT = "ideahome-auth-change";
const ASSISTANT_VOICE_CHANGE_EVENT = "ideahome-assistant-voice-change";
const MOBILE_TOKEN_STORAGE_KEY = "ideahome_mobile_token";
const MOBILE_AUTH_BYPASS_STORAGE_KEY = "ideahome_mobile_auth_bypass";
const MOBILE_ACTIVE_TAB_STORAGE_KEY = "ideahome_mobile_active_tab";
const MOBILE_SELECTED_PROJECT_STORAGE_KEY = "ideahome_mobile_selected_project";
const JUST_LOGGED_IN_SESSION_KEY = "ideahome-just-logged-in";
const AUTH_PARAM_TOKEN = "token";
const AUTH_PARAM_ERROR = "error";
const AUTH_PARAM_REDIRECT_URI = "redirect_uri";
const MOBILE_DEEP_LINK_REDIRECT_URI = "ideahome://auth";
const NATIVE_BRIDGE_AUTH_CHANGE = "auth-change";
const NATIVE_BRIDGE_AUTH_ERROR = "auth-error";
const IDEAHOME_APP_ORIGIN = "https://ideahome.vercel.app";
const IDEAHOME_API_ORIGIN = IDEAHOME_APP_ORIGIN;
const IDEAHOME_WEB_ORIGIN = IDEAHOME_APP_ORIGIN;

const sharedConfig = {
  AUTH_PARAM_ERROR,
  AUTH_PARAM_REDIRECT_URI,
  AUTH_PARAM_TOKEN,
  API_REQUEST_HEADER,
  ASSISTANT_VOICE_CHANGE_EVENT,
  AUTH_CHANGE_EVENT,
  AUTH_TOKEN_COOKIE_KEY,
  AUTH_TOKEN_KEY,
  AUTH_TOKEN_SESSION_KEY,
  ISSUE_STATUS_IDS,
  IDEAHOME_API_ORIGIN,
  IDEAHOME_APP_ORIGIN,
  IDEAHOME_WEB_ORIGIN,
  JUST_LOGGED_IN_SESSION_KEY,
  MOBILE_ACTIVE_TAB_STORAGE_KEY,
  MOBILE_AUTH_BYPASS_STORAGE_KEY,
  MOBILE_DEEP_LINK_REDIRECT_URI,
  MOBILE_SELECTED_PROJECT_STORAGE_KEY,
  MOBILE_TOKEN_STORAGE_KEY,
  NATIVE_BRIDGE_AUTH_CHANGE,
  NATIVE_BRIDGE_AUTH_ERROR,
  readUrlParam,
  sanitizeAuthToken,
  pathCommentAttachmentById,
  pathCommentAttachments,
  pathExpenseById,
  pathExpenses,
  pathIssueFileById,
  pathIssueFiles,
  pathIssueFileStream,
  pathIssueRecordingById,
  pathIssueRecordings,
  pathIssueScreenshotById,
  pathIssueScreenshots,
  pathIssueById,
  pathIssueCommentById,
  pathIssueComments,
  pathIssueStatus,
  pathIssues,
  pathIssuesBulk,
  pathRecordingStream,
  pathScreenshotStream,
  pathChecklistItem,
  pathChecklistList,
  pathChecklistReorder,
  pathAuthApple,
  pathAuthGithub,
  pathAuthGoogle,
  pathAuthMobile,
  pathApiUiTests,
  pathIdeaAssistantChat,
  pathIdeaPlan,
  pathIdeasAssistantChat,
  pathIdeasElevenlabsVoices,
  pathIdeasOpenrouterModels,
  pathIdeasTts,
  pathOrganizations,
  pathOrganizationsEnsure,
  pathProjectById,
  pathProjects,
  pathTestsRunApi,
  pathTestsRunUi,
  pathUsers,
  pathAuthProviders,
  projectNameToAcronym,
  STATUS_OPTIONS,
  testNameToSlug,
};

Object.defineProperty(sharedConfig, "UI_TESTS", {
  enumerable: true,
  get() {
    return require("./ui-tests").UI_TESTS;
  },
});

Object.defineProperty(sharedConfig, "API_TESTS", {
  enumerable: true,
  get() {
    return require("./api-tests").API_TESTS;
  },
});

module.exports = sharedConfig;
