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

function pathProjectMembers(projectId) {
  return `/projects/${enc(projectId)}/members`;
}

function pathProjectInvites(projectId) {
  return `/projects/${enc(projectId)}/invites`;
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

function pathUsersMeAppearance() {
  return "/users/me/appearance";
}

function pathSupportErrorReport() {
  return "/support/error-report";
}

function pathExpenses(projectId) {
  return projectId ? `/expenses?projectId=${enc(projectId)}` : "/expenses";
}

function pathExpenseById(expenseId) {
  return `/expenses/${enc(expenseId)}`;
}

function pathExpensesDeleteImported(projectId) {
  return `/expenses/imported?projectId=${enc(projectId)}`;
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

function pathIdeasWeather() {
  return "/ideas/weather";
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

function pathCalendarGoogleStatus(projectId) {
  return `/calendar/google/status?projectId=${enc(projectId)}`;
}

function pathCalendarGoogleConnect(projectId) {
  return `/calendar/google/connect?projectId=${enc(projectId)}`;
}

function pathCalendarGoogleCalendars(projectId) {
  return `/calendar/google/calendars?projectId=${enc(projectId)}`;
}

function pathCalendarGoogleCalendarSelection(projectId) {
  return `/calendar/google/calendar-selection?projectId=${enc(projectId)}`;
}

function pathCalendarGoogleSync(projectId) {
  return `/calendar/google/sync?projectId=${enc(projectId)}`;
}

function pathCalendarGoogleDisconnect(projectId) {
  return `/calendar/google/connection?projectId=${enc(projectId)}`;
}

function pathCalendarEvents(projectId, start, end) {
  const params = new URLSearchParams();
  params.set("projectId", String(projectId));
  if (start) params.set("start", String(start));
  if (end) params.set("end", String(end));
  return `/calendar/events?${params.toString()}`;
}

function pathCalendarEventById(eventId, projectId) {
  return `/calendar/events/${enc(eventId)}?projectId=${enc(projectId)}`;
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

const EXPENSE_CATEGORIES = [
  "Travel",
  "Supplies",
  "Software",
  "Services",
  "Other",
  "General",
];

const QUALITY_SCORE_ITEM_IDS = [
  "title",
  "description",
  "acceptanceCriteria",
  "database",
  "api",
  "testCases",
  "automatedTest",
  "assignee",
  "comments",
  "screenshots",
  "recordings",
  "files",
];

const DEFAULT_QUALITY_SCORE_WEIGHTS = {
  title: 10,
  description: 15,
  acceptanceCriteria: 15,
  database: 10,
  api: 10,
  testCases: 10,
  automatedTest: 5,
  assignee: 5,
  comments: 5,
  screenshots: 5,
  recordings: 5,
  files: 5,
};

const APPEARANCE_PRESET_IDS = ["classic", "ocean", "forest"];

function createDefaultQualityScoreConfig() {
  return {
    version: 1,
    weights: { ...DEFAULT_QUALITY_SCORE_WEIGHTS },
  };
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeQualityScoreConfig(value) {
  if (!isPlainObject(value)) return createDefaultQualityScoreConfig();
  const version = value.version === 1 ? 1 : 1;
  const rawWeights = isPlainObject(value.weights) ? value.weights : {};
  const weights = {};
  for (const itemId of QUALITY_SCORE_ITEM_IDS) {
    const raw = rawWeights[itemId];
    const n =
      typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : 0;
    weights[itemId] = Math.max(0, Math.min(100, n));
  }
  return { version, weights };
}

function isProjectQualityScoreConfig(value) {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1) return false;
  if (!isPlainObject(value.weights)) return false;
  const keys = Object.keys(value.weights);
  if (keys.length !== QUALITY_SCORE_ITEM_IDS.length) return false;
  let total = 0;
  for (const itemId of QUALITY_SCORE_ITEM_IDS) {
    const raw = value.weights[itemId];
    if (
      typeof raw !== "number" ||
      !Number.isInteger(raw) ||
      raw < 0 ||
      raw > 100
    ) {
      return false;
    }
    total += raw;
  }
  return total === 100;
}

function hasNonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyTestCases(testCasesValue) {
  if (!testCasesValue || typeof testCasesValue !== "string") return false;
  try {
    const parsed = JSON.parse(testCasesValue);
    if (Array.isArray(parsed)) {
      return parsed.some((entry) => hasNonEmptyText(String(entry ?? "")));
    }
  } catch {
    // Ignore parse errors and treat as legacy plain-text value.
  }
  return hasNonEmptyText(testCasesValue);
}

function parseAutomatedTests(raw) {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry ?? ""));
    }
  } catch {
    // Ignore parse errors and treat as legacy single string.
  }
  return [raw];
}

function hasAutomatedTests(automatedTestValue) {
  return parseAutomatedTests(automatedTestValue).some((entry) =>
    hasNonEmptyText(entry)
  );
}

function relationCount(issue, key, fallbackArrayKey) {
  const countObj = isPlainObject(issue._count) ? issue._count : null;
  const countValue = countObj && typeof countObj[key] === "number" ? countObj[key] : null;
  if (typeof countValue === "number" && Number.isFinite(countValue)) {
    return countValue;
  }
  const directCountKey = `${key}Count`;
  const directCount = issue[directCountKey];
  if (typeof directCount === "number" && Number.isFinite(directCount)) {
    return directCount;
  }
  const list = issue[fallbackArrayKey];
  if (Array.isArray(list)) return list.length;
  return 0;
}

function isQualityScoreItemComplete(issue, itemId) {
  switch (itemId) {
    case "title":
      return hasNonEmptyText(issue.title);
    case "description":
      return hasNonEmptyText(issue.description);
    case "acceptanceCriteria":
      return hasNonEmptyText(issue.acceptanceCriteria);
    case "database":
      return hasNonEmptyText(issue.database);
    case "api":
      return hasNonEmptyText(issue.api);
    case "testCases":
      return hasNonEmptyTestCases(issue.testCases);
    case "automatedTest":
      return hasAutomatedTests(issue.automatedTest);
    case "assignee":
      return hasNonEmptyText(issue.assigneeId);
    case "comments":
      return relationCount(issue, "comments", "comments") > 0;
    case "screenshots":
      return relationCount(issue, "screenshots", "screenshots") > 0;
    case "recordings":
      return relationCount(issue, "recordings", "recordings") > 0;
    case "files":
      return relationCount(issue, "files", "files") > 0;
    default:
      return false;
  }
}

function computeQualityScorePercent(issue, config) {
  const normalized = normalizeQualityScoreConfig(config);
  let total = 0;
  for (const itemId of QUALITY_SCORE_ITEM_IDS) {
    if (isQualityScoreItemComplete(issue, itemId)) {
      total += normalized.weights[itemId] || 0;
    }
  }
  return Math.max(0, Math.min(100, Math.round(total)));
}

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
  EXPENSE_CATEGORIES,
  IDEAHOME_API_ORIGIN,
  IDEAHOME_APP_ORIGIN,
  IDEAHOME_WEB_ORIGIN,
  QUALITY_SCORE_ITEM_IDS,
  DEFAULT_QUALITY_SCORE_WEIGHTS,
  APPEARANCE_PRESET_IDS,
  createDefaultQualityScoreConfig,
  normalizeQualityScoreConfig,
  isProjectQualityScoreConfig,
  isQualityScoreItemComplete,
  computeQualityScorePercent,
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
  pathExpensesDeleteImported,
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
  pathCalendarGoogleStatus,
  pathCalendarGoogleConnect,
  pathCalendarGoogleCalendars,
  pathCalendarGoogleCalendarSelection,
  pathCalendarGoogleSync,
  pathCalendarGoogleDisconnect,
  pathCalendarEvents,
  pathCalendarEventById,
  pathIdeaAssistantChat,
  pathIdeaPlan,
  pathIdeasAssistantChat,
  pathIdeasElevenlabsVoices,
  pathIdeasOpenrouterModels,
  pathIdeasTts,
  pathIdeasWeather,
  pathOrganizations,
  pathOrganizationsEnsure,
  pathProjectById,
  pathProjectInvites,
  pathProjectMembers,
  pathProjects,
  pathTestsRunApi,
  pathTestsRunUi,
  pathSupportErrorReport,
  pathUsers,
  pathUsersMeAppearance,
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
