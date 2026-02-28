import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  errorCodes as documentPickerErrorCodes,
  isErrorWithCode as isDocumentPickerErrorWithCode,
  keepLocalCopy as keepPickedFileLocalCopy,
  pick as pickDocument,
  types as documentPickerTypes,
} from "@react-native-documents/picker";
import RNFS from "react-native-fs";
import { launchImageLibrary } from "react-native-image-picker";
import { launchCamera } from "react-native-image-picker";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import {
  ISSUE_STATUSES,
  addCommentAttachment,
  createBug,
  createExpense,
  createFeature,
  createIdea,
  createIssueComment,
  createIssue,
  createProject,
  createTodo,
  deleteCommentAttachment,
  deleteExpense,
  deleteFeature,
  deleteIssueFile,
  deleteIssue,
  deleteIssueComment,
  deleteIssueRecording,
  deleteIssueScreenshot,
  deleteProject,
  deleteBug,
  deleteAllIssues,
  deleteIdea,
  deleteTodo,
  fetchBugs,
  fetchExpenses,
  fetchFeatures,
  fetchIdeas,
  fetchIssueComments,
  fetchIssues,
  fetchProjects,
  fetchTodos,
  fetchUsers,
  fetchUiTestsCatalog,
  generateIdeaAssistantChat,
  runUiTest,
  runApiTest,
  uploadIssueFile,
  uploadIssueRecording,
  uploadIssueScreenshot,
  reorderBugs,
  reorderFeatures,
  reorderIdeas,
  reorderTodos,
  updateExpense,
  updateIssueFile,
  updateIssue,
  updateIssueComment,
  updateIssueRecording,
  updateIssueScreenshot,
  updateProject,
  updateBug,
  updateIdea,
  updateIssueStatus,
  updateTodo,
  updateFeature,
  getIssueFileStreamUrl,
  getRecordingStreamUrl,
  type ChecklistItem,
  type CommentAttachment,
  type Expense,
  getScreenshotStreamUrl,
  type IssueFile,
  type IssueComment,
  type IssueRecording,
  type IssueScreenshot,
  type Issue,
  type Project,
  type RunUiTestResult,
  type RunApiTestResult,
  type User,
  type UITestFile,
  type IdeaAssistantChatResult,
} from "./src/api/client";
import { AppButton } from "./src/components/ui/AppButton";
import { AppCard } from "./src/components/ui/AppCard";
import { TabSwitch } from "./src/components/ui/TabSwitch";
import { colors, radii, spacing } from "./src/theme/tokens";
import {
  AUTH_PARAM_ERROR,
  AUTH_PARAM_REDIRECT_URI,
  AUTH_PARAM_TOKEN,
  IDEAHOME_API_ORIGIN,
  IDEAHOME_WEB_ORIGIN,
  API_TESTS,
  MOBILE_ACTIVE_TAB_STORAGE_KEY,
  MOBILE_AUTH_BYPASS_STORAGE_KEY,
  MOBILE_DEEP_LINK_REDIRECT_URI,
  MOBILE_SELECTED_PROJECT_STORAGE_KEY,
  MOBILE_TOKEN_STORAGE_KEY,
  pathAuthMobile,
  readUrlParam,
  sanitizeAuthToken,
} from "@ideahome/shared-config";

type AuthProvider = "google";
type AppTab =
  | "home"
  | "projects"
  | "issues"
  | "expenses"
  | "features"
  | "todos"
  | "ideas"
  | "bugs"
  | "enhancements"
  | "tests"
  | "settings";

type ChecklistKind = "features" | "todos" | "ideas" | "bugs" | "enhancements";
type PendingCommentAttachment = {
  id: string;
  type: "screenshot" | "video";
  base64: string;
};

type TestExecutionResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
};

type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const APP_WEB_URL = IDEAHOME_WEB_ORIGIN;
const APP_API_URL = IDEAHOME_API_ORIGIN;
const TOKEN_STORAGE_KEY = MOBILE_TOKEN_STORAGE_KEY;
const AUTH_BYPASS_STORAGE_KEY = MOBILE_AUTH_BYPASS_STORAGE_KEY;
const ACTIVE_TAB_STORAGE_KEY = MOBILE_ACTIVE_TAB_STORAGE_KEY;
const SELECTED_PROJECT_STORAGE_KEY = MOBILE_SELECTED_PROJECT_STORAGE_KEY;
const UI_TEST_PATTERNS = ["login", "issues", "comments", "attachments", "smoke"];
const API_TEST_PATTERNS = ["issues", "projects", "comments", "expenses", "auth"];
const EXPENSE_CATEGORIES = ["Travel", "Supplies", "Software", "Services", "Other", "General"];

function parseTokenFromRedirect(redirectUrl: string): string {
  return sanitizeAuthToken(readUrlParam(redirectUrl, AUTH_PARAM_TOKEN));
}

function parseErrorFromRedirect(redirectUrl: string): string {
  return readUrlParam(redirectUrl, AUTH_PARAM_ERROR);
}

function buildMobileAuthUrl(provider: AuthProvider): string {
  const url = new URL(`${APP_API_URL}${pathAuthMobile(provider)}`);
  url.searchParams.set(AUTH_PARAM_REDIRECT_URI, MOBILE_DEEP_LINK_REDIRECT_URI);
  return url.toString();
}

function previousStatus(current: string): string {
  const index = ISSUE_STATUSES.findIndex((s) => s === current);
  if (index <= 0) return ISSUE_STATUSES[0];
  return ISSUE_STATUSES[index - 1];
}

function forwardStatus(current: string): string {
  const index = ISSUE_STATUSES.findIndex((s) => s === current);
  if (index < 0) return ISSUE_STATUSES[0];
  if (index >= ISSUE_STATUSES.length - 1) return ISSUE_STATUSES[ISSUE_STATUSES.length - 1];
  return ISSUE_STATUSES[index + 1];
}

function statusLabel(status: string): string {
  return status.replace("_", " ");
}

function fileNameFromUri(uri: string, fallback: string): string {
  const parts = uri.split("/");
  const raw = parts[parts.length - 1] ?? "";
  const cleaned = decodeURIComponent(raw).split("?")[0]?.trim() ?? "";
  return cleaned || fallback;
}

function normalizeFilePath(uri: string): string {
  if (uri.startsWith("file://")) return decodeURIComponent(uri.replace("file://", ""));
  return decodeURIComponent(uri);
}

function readUserIdFromToken(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return "";
    const payload = parts[1];
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded) as { sub?: unknown };
    return typeof parsed.sub === "string" ? parsed.sub.trim() : "";
  } catch {
    return "";
  }
}

function readUserEmailFromToken(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return "";
    const payload = parts[1];
    const base64Raw = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (base64Raw.length % 4)) % 4;
    const base64 = base64Raw + "=".repeat(padLen);
    const decoded = atob(base64);
    const parsed = JSON.parse(decoded) as { email?: unknown };
    return typeof parsed.email === "string" ? parsed.email.trim() : "";
  } catch {
    return "";
  }
}

function enhancementsStorageKey(projectId: string, token: string): string {
  const userId = readUserIdFromToken(token);
  return userId
    ? `ideahome-enhancements-${userId}-${projectId}`
    : `ideahome-enhancements-${projectId}`;
}

function getCommentAttachmentStreamUrl(attachment: CommentAttachment): string {
  if (attachment.type === "screenshot") {
    return getScreenshotStreamUrl(attachment.mediaUrl);
  }
  return getRecordingStreamUrl(attachment.mediaUrl);
}

function commentAttachmentLabel(attachment: CommentAttachment): string {
  const fileName = attachment.mediaUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return fileName || attachment.type;
}

function pendingCommentAttachmentDataUri(attachment: PendingCommentAttachment): string {
  if (attachment.type === "screenshot") return `data:image/jpeg;base64,${attachment.base64}`;
  return `data:video/mp4;base64,${attachment.base64}`;
}

function parseAutomatedTestNames(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .flatMap((entry) => {
          if (typeof entry === "string") return [entry];
          if (entry && typeof entry === "object" && "name" in entry) {
            const name = (entry as { name?: unknown }).name;
            return typeof name === "string" ? [name] : [];
          }
          return [];
        })
        .map((name) => name.trim())
        .filter(Boolean);
    }
  } catch {
    // fallback below
  }
  return trimmed
    .split(/\r?\n|,/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isAppTab(value: string): value is AppTab {
  return [
    "home",
    "projects",
    "issues",
    "expenses",
    "features",
    "todos",
    "ideas",
    "bugs",
    "enhancements",
    "tests",
    "settings",
  ].includes(value);
}

export default function App() {
  const [token, setToken] = useState("");
  const [authBypassEnabled, setAuthBypassEnabled] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState("");

  const [activeTab, setActiveTab] = useState<AppTab>("home");

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [createProjectName, setCreateProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectEditName, setProjectEditName] = useState("");
  const [savingProjectEdit, setSavingProjectEdit] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState("");
  const [newIssueTitle, setNewIssueTitle] = useState("");
  const [newIssueDescription, setNewIssueDescription] = useState("");
  const [newIssueAcceptanceCriteria, setNewIssueAcceptanceCriteria] = useState("");
  const [newIssueDatabase, setNewIssueDatabase] = useState("");
  const [newIssueApi, setNewIssueApi] = useState("");
  const [newIssueTestCases, setNewIssueTestCases] = useState("");
  const [newIssueAutomatedTest, setNewIssueAutomatedTest] = useState("");
  const [newIssueQualityScore, setNewIssueQualityScore] = useState("");
  const [newIssueAssigneeId, setNewIssueAssigneeId] = useState("");
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [clearingIssues, setClearingIssues] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [issueSearch, setIssueSearch] = useState("");
  const [issueBoardFocus, setIssueBoardFocus] = useState<string>("all");
  const [issueAssigneeFilter, setIssueAssigneeFilter] = useState<string>("all");
  const [collapsedIssueStatuses, setCollapsedIssueStatuses] = useState<Record<string, boolean>>({
    backlog: false,
    todo: false,
    in_progress: false,
    done: false,
  });
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const [issueEditTitle, setIssueEditTitle] = useState("");
  const [issueEditDescription, setIssueEditDescription] = useState("");
  const [issueEditAcceptanceCriteria, setIssueEditAcceptanceCriteria] = useState("");
  const [issueEditDatabase, setIssueEditDatabase] = useState("");
  const [issueEditApi, setIssueEditApi] = useState("");
  const [issueEditTestCases, setIssueEditTestCases] = useState("");
  const [issueEditAutomatedTest, setIssueEditAutomatedTest] = useState("");
  const [issueEditQualityScore, setIssueEditQualityScore] = useState("");
  const [issueEditAssigneeId, setIssueEditAssigneeId] = useState("");
  const [savingIssueEdit, setSavingIssueEdit] = useState(false);
  const [quickEditIssueId, setQuickEditIssueId] = useState("");
  const [quickEditTitle, setQuickEditTitle] = useState("");
  const [quickEditAssigneeId, setQuickEditAssigneeId] = useState("");
  const [quickEditQualityScore, setQuickEditQualityScore] = useState("");
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [deletingIssue, setDeletingIssue] = useState(false);
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [pendingCommentAttachments, setPendingCommentAttachments] = useState<
    PendingCommentAttachment[]
  >([]);
  const [creatingComment, setCreatingComment] = useState(false);
  const [uploadingCommentAttachmentId, setUploadingCommentAttachmentId] = useState("");
  const [editingCommentId, setEditingCommentId] = useState("");
  const [commentEditBody, setCommentEditBody] = useState("");
  const [editingRecordingId, setEditingRecordingId] = useState("");
  const [recordingEditName, setRecordingEditName] = useState("");
  const [editingScreenshotId, setEditingScreenshotId] = useState("");
  const [screenshotEditName, setScreenshotEditName] = useState("");
  const [editingFileId, setEditingFileId] = useState("");
  const [fileEditName, setFileEditName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [uploadingIssueAsset, setUploadingIssueAsset] = useState(false);
  const [runningUiTests, setRunningUiTests] = useState<Record<string, boolean>>({});
  const [uiTestResults, setUiTestResults] = useState<Record<string, RunUiTestResult>>({});
  const [runningIssueAutomatedTests, setRunningIssueAutomatedTests] = useState(false);
  const [testUiPattern, setTestUiPattern] = useState("");
  const [testApiPattern, setTestApiPattern] = useState("");
  const [runningTests, setRunningTests] = useState<{ ui: boolean; api: boolean }>({
    ui: false,
    api: false,
  });
  const [runningApiTestName, setRunningApiTestName] = useState<string | null>(null);
  const [apiTestResultsByName, setApiTestResultsByName] = useState<Record<string, RunApiTestResult>>({});
  const [runningApiSuiteKey, setRunningApiSuiteKey] = useState<string | null>(null);
  const [runningAllApiTests, setRunningAllApiTests] = useState(false);
  const [latestUiTestResult, setLatestUiTestResult] = useState<RunUiTestResult | null>(null);
  const [latestApiTestResult, setLatestApiTestResult] = useState<RunApiTestResult | null>(null);
  const [showFullUiOutput, setShowFullUiOutput] = useState(false);
  const [showFullApiOutput, setShowFullApiOutput] = useState(false);
  const [uiTestsCatalog, setUiTestsCatalog] = useState<UITestFile[]>([]);
  const [uiTestsCatalogLoading, setUiTestsCatalogLoading] = useState(false);
  const [uiTestsCatalogError, setUiTestsCatalogError] = useState("");
  const [runningUiSuiteKey, setRunningUiSuiteKey] = useState<string | null>(null);
  const [runningAllUiTests, setRunningAllUiTests] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expensesError, setExpensesError] = useState("");
  const [createExpenseForm, setCreateExpenseForm] = useState({
    description: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    category: "General",
  });
  const [creatingExpense, setCreatingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [expenseEditDescription, setExpenseEditDescription] = useState("");
  const [expenseEditAmount, setExpenseEditAmount] = useState("");
  const [expenseEditDate, setExpenseEditDate] = useState("");
  const [expenseEditCategory, setExpenseEditCategory] = useState("General");
  const [savingExpenseEdit, setSavingExpenseEdit] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState("");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("all");

  const [features, setFeatures] = useState<ChecklistItem[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [creatingFeature, setCreatingFeature] = useState(false);

  const [todos, setTodos] = useState<ChecklistItem[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState("");
  const [todoName, setTodoName] = useState("");
  const [creatingTodo, setCreatingTodo] = useState(false);

  const [ideas, setIdeas] = useState<ChecklistItem[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  const [ideaName, setIdeaName] = useState("");
  const [creatingIdea, setCreatingIdea] = useState(false);
  const [ideaAssistantChatById, setIdeaAssistantChatById] = useState<
    Record<string, AssistantChatMessage[]>
  >({});
  const [ideaAssistantDraftById, setIdeaAssistantDraftById] = useState<Record<string, string>>({});
  const [ideaAssistantExpandedById, setIdeaAssistantExpandedById] = useState<
    Record<string, boolean>
  >({});
  const [ideaAssistantLoadingById, setIdeaAssistantLoadingById] = useState<
    Record<string, boolean>
  >({});

  const [bugs, setBugs] = useState<ChecklistItem[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugsError, setBugsError] = useState("");
  const [bugName, setBugName] = useState("");
  const [creatingBug, setCreatingBug] = useState(false);
  const [enhancements, setEnhancements] = useState<ChecklistItem[]>([]);
  const [enhancementsLoading, setEnhancementsLoading] = useState(false);
  const [enhancementsError, setEnhancementsError] = useState("");
  const [enhancementName, setEnhancementName] = useState("");
  const [creatingEnhancement, setCreatingEnhancement] = useState(false);
  const [clearingEnhancements, setClearingEnhancements] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<{
    kind: ChecklistKind;
    id: string;
    name: string;
  } | null>(null);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );
  const selectedIssue = useMemo(
    () => issues.find((item) => item.id === selectedIssueId) ?? null,
    [issues, selectedIssueId]
  );

  const expensesTotal = useMemo(
    () => expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [expenses]
  );
  const filteredExpenses = useMemo(() => {
    const normalizedSearch = expenseSearchQuery.trim().toLowerCase();
    return [...expenses]
      .filter((expense) => {
        if (expenseCategoryFilter !== "all" && expense.category !== expenseCategoryFilter) return false;
        if (!normalizedSearch) return true;
        const haystack = `${expense.description} ${expense.category} ${expense.date}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const left = `${a.date ?? ""} ${a.createdAt ?? ""}`;
        const right = `${b.date ?? ""} ${b.createdAt ?? ""}`;
        return right.localeCompare(left);
      });
  }, [expenseCategoryFilter, expenseSearchQuery, expenses]);
  const automatedTestNames = useMemo(
    () => parseAutomatedTestNames(issueEditAutomatedTest),
    [issueEditAutomatedTest]
  );
  const discoveredUiTestSuites = useMemo(
    () =>
      uiTestsCatalog.flatMap((file) =>
        file.suites
          .map((suite) => ({
            key: `${file.file}::${suite.name}`,
            suiteName: suite.name,
            tests: suite.tests.map((test) => test.trim()).filter(Boolean),
          }))
          .filter((suite) => suite.tests.length > 0)
      ),
    [uiTestsCatalog]
  );
  const discoveredUiTestNames = useMemo(
    () =>
      Array.from(
        new Set(discoveredUiTestSuites.flatMap((suite) => suite.tests))
      ),
    [discoveredUiTestSuites]
  );
  const uiTestsBusy = useMemo(
    () => runningAllUiTests || runningTests.ui || Object.values(runningUiTests).some(Boolean),
    [runningAllUiTests, runningTests.ui, runningUiTests]
  );
  const uiTestResultEntries = useMemo(() => Object.values(uiTestResults), [uiTestResults]);
  const uiTestPassCount = useMemo(
    () => uiTestResultEntries.filter((result) => result.success).length,
    [uiTestResultEntries]
  );
  const uiTestFailCount = useMemo(
    () => uiTestResultEntries.filter((result) => !result.success).length,
    [uiTestResultEntries]
  );
  const apiTestNames = useMemo(() => API_TESTS.flatMap((suite) => suite.tests), []);
  const apiTestsBusy = useMemo(
    () => runningAllApiTests || runningTests.api || Boolean(runningApiTestName),
    [runningAllApiTests, runningTests.api, runningApiTestName]
  );
  const apiTestResultEntries = useMemo(
    () => Object.values(apiTestResultsByName),
    [apiTestResultsByName]
  );
  const apiTestPassCount = useMemo(
    () => apiTestResultEntries.filter((result) => result.success).length,
    [apiTestResultEntries]
  );
  const apiTestFailCount = useMemo(
    () => apiTestResultEntries.filter((result) => !result.success).length,
    [apiTestResultEntries]
  );

  const filteredIssues = useMemo(() => {
    if (issueAssigneeFilter === "all") return issues;
    if (issueAssigneeFilter === "unassigned") {
      return issues.filter((issue) => !issue.assigneeId);
    }
    return issues.filter((issue) => issue.assigneeId === issueAssigneeFilter);
  }, [issueAssigneeFilter, issues]);

  const issuesByStatus = useMemo(() => {
    const map: Record<string, Issue[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      done: [],
    };
    filteredIssues.forEach((issue) => {
      if (!map[issue.status]) map[issue.status] = [];
      map[issue.status].push(issue);
    });
    Object.keys(map).forEach((status) => {
      map[status] = [...map[status]].sort((left, right) => {
        const leftDate = left.createdAt ?? "";
        const rightDate = right.createdAt ?? "";
        return rightDate.localeCompare(leftDate);
      });
    });
    return map;
  }, [filteredIssues]);

  const loadProjects = useCallback(async () => {
    if (!token) return;
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const data = await fetchProjects(token);
      setProjects(Array.isArray(data) ? data : []);
      if (!selectedProjectId && data.length > 0) setSelectedProjectId(data[0].id);
      if (selectedProjectId && !data.find((p) => p.id === selectedProjectId)) {
        setSelectedProjectId(data[0]?.id ?? "");
      }
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadIssues = useCallback(async () => {
    if (!token) return;
    setIssuesLoading(true);
    setIssuesError("");
    try {
      const data = await fetchIssues(
        token,
        selectedProjectId || undefined,
        issueSearch || undefined
      );
      setIssues(Array.isArray(data) ? data : []);
      const resolved = Array.isArray(data) ? data : [];
      if (!selectedIssueId && resolved.length > 0) setSelectedIssueId(resolved[0].id);
      if (selectedIssueId && !resolved.find((item) => item.id === selectedIssueId)) {
        setSelectedIssueId(resolved[0]?.id ?? "");
      }
    } catch (error) {
      setIssuesError(error instanceof Error ? error.message : "Failed to load issues");
    } finally {
      setIssuesLoading(false);
    }
  }, [issueSearch, selectedIssueId, selectedProjectId, token]);

  const loadExpenses = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setExpensesLoading(true);
    setExpensesError("");
    try {
      const data = await fetchExpenses(token, selectedProjectId);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      setExpensesError(error instanceof Error ? error.message : "Failed to load expenses");
    } finally {
      setExpensesLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadIssueComments = useCallback(async () => {
    if (!token || !selectedIssueId) {
      setIssueComments([]);
      return;
    }
    setCommentsLoading(true);
    setCommentsError("");
    try {
      const data = await fetchIssueComments(token, selectedIssueId);
      setIssueComments(Array.isArray(data) ? data : []);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  }, [selectedIssueId, token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      const data = await fetchUsers(token);
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  const loadUiTestsCatalog = useCallback(async () => {
    setUiTestsCatalogLoading(true);
    setUiTestsCatalogError("");
    try {
      const data = await fetchUiTestsCatalog();
      setUiTestsCatalog(Array.isArray(data) ? data : []);
    } catch (error) {
      setUiTestsCatalogError(error instanceof Error ? error.message : "Failed to load UI tests");
    } finally {
      setUiTestsCatalogLoading(false);
    }
  }, []);

  const loadFeatures = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setFeaturesLoading(true);
    setFeaturesError("");
    try {
      const data = await fetchFeatures(token, selectedProjectId);
      setFeatures(Array.isArray(data) ? data : []);
    } catch (error) {
      setFeaturesError(error instanceof Error ? error.message : "Failed to load features");
    } finally {
      setFeaturesLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadTodos = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setTodosLoading(true);
    setTodosError("");
    try {
      const data = await fetchTodos(token, selectedProjectId);
      setTodos(Array.isArray(data) ? data : []);
    } catch (error) {
      setTodosError(error instanceof Error ? error.message : "Failed to load todos");
    } finally {
      setTodosLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadIdeas = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setIdeasLoading(true);
    setIdeasError("");
    try {
      const data = await fetchIdeas(token, selectedProjectId);
      setIdeas(Array.isArray(data) ? data : []);
    } catch (error) {
      setIdeasError(error instanceof Error ? error.message : "Failed to load ideas");
    } finally {
      setIdeasLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadBugs = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setBugsLoading(true);
    setBugsError("");
    try {
      const data = await fetchBugs(token, selectedProjectId);
      setBugs(Array.isArray(data) ? data : []);
    } catch (error) {
      setBugsError(error instanceof Error ? error.message : "Failed to load bugs");
    } finally {
      setBugsLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadEnhancements = useCallback(async () => {
    if (!selectedProjectId || !token) return;
    setEnhancementsLoading(true);
    setEnhancementsError("");
    try {
      const key = enhancementsStorageKey(selectedProjectId, token);
      const raw = (await AsyncStorage.getItem(key)) ?? "[]";
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setEnhancements([]);
        return;
      }
      const normalized = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String((item as { id?: unknown }).id ?? ""),
          name: String((item as { name?: unknown }).name ?? ""),
          done: Boolean((item as { done?: unknown }).done),
          order: Number((item as { order?: unknown }).order ?? 0),
          projectId: String((item as { projectId?: unknown }).projectId ?? selectedProjectId),
          createdAt: String(
            (item as { createdAt?: unknown }).createdAt ?? new Date().toISOString()
          ),
        }))
        .filter((item) => item.id && item.name);
      setEnhancements(normalized.sort((a, b) => a.order - b.order));
    } catch {
      setEnhancementsError("Failed to load enhancements");
      setEnhancements([]);
    } finally {
      setEnhancementsLoading(false);
    }
  }, [selectedProjectId, token]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(TOKEN_STORAGE_KEY),
      AsyncStorage.getItem(AUTH_BYPASS_STORAGE_KEY),
      AsyncStorage.getItem(ACTIVE_TAB_STORAGE_KEY),
      AsyncStorage.getItem(SELECTED_PROJECT_STORAGE_KEY),
    ])
      .then(async ([storedToken, bypass, storedActiveTab, storedProjectId]) => {
        const normalized = sanitizeAuthToken(storedToken?.trim() ?? "");
        if (normalized) setToken(normalized);
        if (storedToken && storedToken !== normalized) {
          if (normalized) await AsyncStorage.setItem(TOKEN_STORAGE_KEY, normalized);
          else await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
        }
        setAuthBypassEnabled(bypass === "1");
        if (storedActiveTab && isAppTab(storedActiveTab)) setActiveTab(storedActiveTab);
        if (storedProjectId?.trim()) setSelectedProjectId(storedProjectId.trim());
      })
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab).catch(() => {
      // best effort persistence
    });
  }, [activeTab]);

  useEffect(() => {
    if (!selectedProjectId) {
      AsyncStorage.removeItem(SELECTED_PROJECT_STORAGE_KEY).catch(() => {
        // best effort persistence
      });
      return;
    }
    AsyncStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, selectedProjectId).catch(() => {
      // best effort persistence
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!token) return;
    loadProjects().catch(() => {
      // handled in loadProjects
    });
  }, [loadProjects, token]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "issues") loadIssues().catch(() => {});
    if (activeTab === "expenses") loadExpenses().catch(() => {});
    if (activeTab === "features") loadFeatures().catch(() => {});
    if (activeTab === "todos") loadTodos().catch(() => {});
    if (activeTab === "ideas") loadIdeas().catch(() => {});
    if (activeTab === "bugs") loadBugs().catch(() => {});
    if (activeTab === "enhancements") loadEnhancements().catch(() => {});
  }, [
    activeTab,
    loadBugs,
    loadEnhancements,
    loadExpenses,
    loadFeatures,
    loadIdeas,
    loadIssues,
    loadTodos,
    token,
  ]);

  useEffect(() => {
    if (activeTab !== "tests") return;
    loadUiTestsCatalog().catch(() => {
      // handled in loadUiTestsCatalog
    });
  }, [activeTab, loadUiTestsCatalog]);

  useEffect(() => {
    setProjectEditName(selectedProject?.name ?? "");
    setEditingChecklist(null);
    setIssueAssigneeFilter("all");
    setQuickEditIssueId("");
    setQuickEditTitle("");
    setQuickEditAssigneeId("");
    setQuickEditQualityScore("");
    setCollapsedIssueStatuses({
      backlog: false,
      todo: false,
      in_progress: false,
      done: false,
    });
    setIdeaAssistantChatById({});
    setIdeaAssistantDraftById({});
    setIdeaAssistantExpandedById({});
    setIdeaAssistantLoadingById({});
  }, [selectedProject?.id, selectedProject?.name]);

  useEffect(() => {
    setIssueEditTitle(selectedIssue?.title ?? "");
    setIssueEditDescription(selectedIssue?.description ?? "");
    setIssueEditAcceptanceCriteria(selectedIssue?.acceptanceCriteria ?? "");
    setIssueEditDatabase(selectedIssue?.database ?? "");
    setIssueEditApi(selectedIssue?.api ?? "");
    setIssueEditTestCases(selectedIssue?.testCases ?? "");
    setIssueEditAutomatedTest(selectedIssue?.automatedTest ?? "");
    setIssueEditAssigneeId(selectedIssue?.assigneeId ?? "");
    setIssueEditQualityScore(
      selectedIssue?.qualityScore === undefined || selectedIssue?.qualityScore === null
        ? ""
        : String(selectedIssue.qualityScore)
    );
    setEditingRecordingId("");
    setRecordingEditName("");
    setEditingScreenshotId("");
    setScreenshotEditName("");
    setEditingFileId("");
    setFileEditName("");
    setPendingCommentAttachments([]);
    setUploadingCommentAttachmentId("");
    setEditingCommentId("");
    setCommentEditBody("");
    setRunningIssueAutomatedTests(false);
    setPreviewUrl("");
    setPreviewTitle("");
    setRunningUiTests({});
    setRunningIssueAutomatedTests(false);
    setUiTestResults({});
  }, [
    selectedIssue?.acceptanceCriteria,
    selectedIssue?.api,
    selectedIssue?.assigneeId,
    selectedIssue?.automatedTest,
    selectedIssue?.database,
    selectedIssue?.description,
    selectedIssue?.id,
    selectedIssue?.qualityScore,
    selectedIssue?.testCases,
    selectedIssue?.title,
  ]);

  useEffect(() => {
    if (activeTab !== "issues") return;
    loadIssueComments().catch(() => {
      // handled in loadIssueComments
    });
    loadUsers().catch(() => {
      // handled in loadUsers
    });
  }, [activeTab, loadIssueComments, loadUsers]);

  useEffect(() => {
    if (!quickEditIssueId) return;
    if (!issues.find((issue) => issue.id === quickEditIssueId)) {
      setQuickEditIssueId("");
      setQuickEditTitle("");
      setQuickEditAssigneeId("");
      setQuickEditQualityScore("");
    }
  }, [issues, quickEditIssueId]);

  useEffect(() => {
    const ideaIds = new Set(ideas.map((idea) => idea.id));
    const pruneRecord = <T,>(source: Record<string, T>): Record<string, T> => {
      const next: Record<string, T> = {};
      Object.entries(source).forEach(([key, value]) => {
        if (ideaIds.has(key)) next[key] = value;
      });
      return next;
    };
    setIdeaAssistantChatById((current) => pruneRecord(current));
    setIdeaAssistantDraftById((current) => pruneRecord(current));
    setIdeaAssistantExpandedById((current) => pruneRecord(current));
    setIdeaAssistantLoadingById((current) => pruneRecord(current));
  }, [ideas]);

  const onAuthSuccess = useCallback(async (nextToken: string) => {
    const normalizedToken = sanitizeAuthToken(nextToken);
    setToken(normalizedToken);
    setAuthErrorMessage("");
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken);
  }, []);

  const signOutNative = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setActiveTab("home");
    setProjects([]);
    setIssues([]);
    setUsers([]);
    setExpenses([]);
    setFeatures([]);
    setTodos([]);
    setIdeas([]);
    setBugs([]);
    setEnhancements([]);
    setSelectedProjectId("");
    setSelectedIssueId("");
    setIssueComments([]);
    setPendingCommentAttachments([]);
    setUploadingCommentAttachmentId("");
    setEditingCommentId("");
    setCommentEditBody("");
    setIssueSearch("");
    setIssueBoardFocus("all");
    setIssueAssigneeFilter("all");
    setCollapsedIssueStatuses({
      backlog: false,
      todo: false,
      in_progress: false,
      done: false,
    });
    setIssueEditTitle("");
    setIssueEditDescription("");
    setIssueEditAcceptanceCriteria("");
    setIssueEditDatabase("");
    setIssueEditApi("");
    setIssueEditTestCases("");
    setIssueEditAutomatedTest("");
    setIssueEditAssigneeId("");
    setIssueEditQualityScore("");
    setQuickEditIssueId("");
    setQuickEditTitle("");
    setQuickEditAssigneeId("");
    setQuickEditQualityScore("");
    setNewIssueTitle("");
    setNewIssueDescription("");
    setNewIssueAcceptanceCriteria("");
    setNewIssueDatabase("");
    setNewIssueApi("");
    setNewIssueTestCases("");
    setNewIssueAutomatedTest("");
    setNewIssueAssigneeId("");
    setNewIssueQualityScore("");
    setNewCommentBody("");
    setEditingRecordingId("");
    setRecordingEditName("");
    setEditingScreenshotId("");
    setScreenshotEditName("");
    setEditingFileId("");
    setFileEditName("");
    setPreviewUrl("");
    setPreviewTitle("");
    setRunningUiTests({});
    setUiTestResults({});
    setUiTestsCatalog([]);
    setUiTestsCatalogError("");
    setUiTestsCatalogLoading(false);
    setRunningUiSuiteKey(null);
    setRunningAllUiTests(false);
    setTestUiPattern("");
    setTestApiPattern("");
    setRunningTests({ ui: false, api: false });
    setRunningApiTestName(null);
    setRunningApiSuiteKey(null);
    setRunningAllApiTests(false);
    setApiTestResultsByName({});
    setLatestUiTestResult(null);
    setLatestApiTestResult(null);
    setIdeaAssistantChatById({});
    setIdeaAssistantDraftById({});
    setIdeaAssistantExpandedById({});
    setIdeaAssistantLoadingById({});
    setCreateExpenseForm({
      description: "",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      category: "General",
    });
    setEditingExpenseId("");
    setExpenseEditDescription("");
    setExpenseEditAmount("");
    setExpenseEditDate("");
    setExpenseEditCategory("General");
    setExpenseSearchQuery("");
    setExpenseCategoryFilter("all");
    setEditingChecklist(null);
  }, []);

  const enableAuthBypass = useCallback(async () => {
    await AsyncStorage.setItem(AUTH_BYPASS_STORAGE_KEY, "1");
    setAuthBypassEnabled(true);
    setAuthErrorMessage("");
  }, []);

  const disableAuthBypass = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_BYPASS_STORAGE_KEY);
    setAuthBypassEnabled(false);
  }, []);

  const handleAuthRedirectUrl = useCallback(
    async (url: string): Promise<"token" | "error" | "none"> => {
      if (!url) return "none";
      const possibleError = parseErrorFromRedirect(url);
      if (possibleError) {
        setAuthErrorMessage("Sign-in was canceled or failed. Please try again.");
        Alert.alert("Sign in failed", possibleError);
        return "error";
      }

      const receivedToken = parseTokenFromRedirect(url);
      if (!receivedToken) {
        setAuthErrorMessage("No token received from sign-in. Please try again.");
        return "none";
      }

      await onAuthSuccess(receivedToken);
      return "token";
    },
    [onAuthSuccess]
  );

  useEffect(() => {
    const handleUrlEvent = (event: { url: string }) => {
      handleAuthRedirectUrl(event.url).catch(() => {
        // Ignore deep-link parse failures.
      });
    };
    const subscription = Linking.addEventListener("url", handleUrlEvent);
    Linking.getInitialURL()
      .then((initialUrl) => {
        if (!initialUrl) return;
        return handleAuthRedirectUrl(initialUrl);
      })
      .catch(() => {
        // Ignore initial URL read failures.
      });
    return () => {
      subscription.remove();
    };
  }, [handleAuthRedirectUrl]);

  const signIn = useCallback(
    async (provider: AuthProvider, options?: { showContinueAlert?: boolean }) => {
      setAuthInProgress(true);
      setAuthErrorMessage("");
      try {
        const authUrl = buildMobileAuthUrl(provider);
        await Linking.openURL(authUrl);
        if (options?.showContinueAlert ?? true) {
          Alert.alert(
            "Continue in Safari",
            "Complete Google sign-in in Safari. If the app does not reopen automatically, tap the Open IdeaHome App button in Safari."
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown auth error";
        setAuthErrorMessage("Unable to start sign-in. Please try again.");
        Alert.alert("Sign in failed", message);
      } finally {
        setAuthInProgress(false);
      }
    },
    []
  );

  const handleCreateProject = useCallback(async () => {
    const name = createProjectName.trim();
    if (!name || !token) return;
    setCreatingProject(true);
    try {
      const created = await createProject(token, name);
      setCreateProjectName("");
      setSelectedProjectId(created.id);
      await loadProjects();
    } catch (error) {
      Alert.alert("Create project failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setCreatingProject(false);
    }
  }, [createProjectName, loadProjects, token]);

  const handleUpdateProject = useCallback(async () => {
    if (!token || !selectedProject) return;
    const nextName = projectEditName.trim();
    if (!nextName) return;
    setSavingProjectEdit(true);
    try {
      await updateProject(token, selectedProject.id, { name: nextName });
      await loadProjects();
    } catch (error) {
      Alert.alert("Update project failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingProjectEdit(false);
    }
  }, [loadProjects, projectEditName, selectedProject, token]);

  const handleDeleteProject = useCallback(async () => {
    if (!token || !selectedProject) return;
    setDeletingProject(true);
    try {
      await deleteProject(token, selectedProject.id);
      setSelectedProjectId("");
      setSelectedIssueId("");
      await loadProjects();
    } catch (error) {
      Alert.alert("Delete project failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setDeletingProject(false);
    }
  }, [loadProjects, selectedProject, token]);

  const handleCreateIssue = useCallback(async () => {
    const title = newIssueTitle.trim();
    if (!title || !token || !selectedProjectId) return;
    const parsedQuality = Number(newIssueQualityScore);
    setCreatingIssue(true);
    try {
      await createIssue(token, {
        title,
        projectId: selectedProjectId,
        description: newIssueDescription.trim() || undefined,
        acceptanceCriteria: newIssueAcceptanceCriteria.trim() || undefined,
        database: newIssueDatabase.trim() || undefined,
        api: newIssueApi.trim() || undefined,
        testCases: newIssueTestCases.trim() || undefined,
        automatedTest: newIssueAutomatedTest.trim() || undefined,
        assigneeId: newIssueAssigneeId || undefined,
        qualityScore:
          newIssueQualityScore.trim() === ""
            ? undefined
            : Number.isFinite(parsedQuality)
              ? parsedQuality
              : undefined,
      });
      setNewIssueTitle("");
      setNewIssueDescription("");
      setNewIssueAcceptanceCriteria("");
      setNewIssueDatabase("");
      setNewIssueApi("");
      setNewIssueTestCases("");
      setNewIssueAutomatedTest("");
      setNewIssueQualityScore("");
      setNewIssueAssigneeId("");
      await loadIssues();
    } catch (error) {
      Alert.alert("Create issue failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setCreatingIssue(false);
    }
  }, [
    loadIssues,
    newIssueAcceptanceCriteria,
    newIssueApi,
    newIssueAssigneeId,
    newIssueAutomatedTest,
    newIssueDatabase,
    newIssueDescription,
    newIssueQualityScore,
    newIssueTestCases,
    newIssueTitle,
    selectedProjectId,
    token,
  ]);

  const handleMoveIssue = useCallback(
    async (issue: Issue, direction: "backward" | "forward") => {
      if (!token) return;
      const target =
        direction === "backward" ? previousStatus(issue.status) : forwardStatus(issue.status);
      if (target === issue.status) return;
      try {
        await updateIssueStatus(token, issue.id, target);
        await loadIssues();
      } catch (error) {
        Alert.alert("Move issue failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [loadIssues, token]
  );

  const handleStartQuickEditIssue = useCallback((issue: Issue) => {
    setQuickEditIssueId(issue.id);
    setQuickEditTitle(issue.title ?? "");
    setQuickEditAssigneeId(issue.assigneeId ?? "");
    setQuickEditQualityScore(
      issue.qualityScore === undefined || issue.qualityScore === null
        ? ""
        : String(issue.qualityScore)
    );
  }, []);

  const handleCancelQuickEditIssue = useCallback(() => {
    setQuickEditIssueId("");
    setQuickEditTitle("");
    setQuickEditAssigneeId("");
    setQuickEditQualityScore("");
  }, []);

  const handleSaveQuickEditIssue = useCallback(
    async (issueId: string) => {
      if (!token) return;
      const title = quickEditTitle.trim();
      if (!title) return;
      const qualityRaw = quickEditQualityScore.trim();
      const parsedQuality = qualityRaw ? Number(qualityRaw) : undefined;
      const qualityScore =
        parsedQuality !== undefined && !Number.isNaN(parsedQuality) ? parsedQuality : undefined;
      setSavingQuickEdit(true);
      try {
        await updateIssue(token, issueId, {
          title,
          assigneeId: quickEditAssigneeId || undefined,
          qualityScore,
        });
        await loadIssues();
        handleCancelQuickEditIssue();
      } catch (error) {
        Alert.alert("Quick edit failed", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setSavingQuickEdit(false);
      }
    },
    [
      handleCancelQuickEditIssue,
      loadIssues,
      quickEditAssigneeId,
      quickEditQualityScore,
      quickEditTitle,
      token,
    ]
  );

  const clearEnhancementsForProject = useCallback(async () => {
    if (!selectedProjectId || !token) return;
    setClearingEnhancements(true);
    try {
      const key = enhancementsStorageKey(selectedProjectId, token);
      await AsyncStorage.removeItem(key);
      setEnhancements([]);
      Alert.alert("Enhancements cleared", "Local enhancements were removed for this project.");
    } catch (error) {
      Alert.alert(
        "Clear enhancements failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setClearingEnhancements(false);
    }
  }, [selectedProjectId, token]);

  const handleSaveIssue = useCallback(async () => {
    if (!token || !selectedIssue) return;
    const title = issueEditTitle.trim();
    if (!title) return;
    const parsedQuality = Number(issueEditQualityScore);
    setSavingIssueEdit(true);
    try {
      await updateIssue(token, selectedIssue.id, {
        title,
        description: issueEditDescription.trim() || "",
        acceptanceCriteria: issueEditAcceptanceCriteria.trim() || "",
        database: issueEditDatabase.trim() || "",
        api: issueEditApi.trim() || "",
        testCases: issueEditTestCases.trim() || "",
        automatedTest: issueEditAutomatedTest.trim() || "",
        assigneeId: issueEditAssigneeId || null,
        qualityScore:
          issueEditQualityScore.trim() === ""
            ? undefined
            : Number.isFinite(parsedQuality)
              ? parsedQuality
              : undefined,
      });
      await loadIssues();
    } catch (error) {
      Alert.alert("Save issue failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingIssueEdit(false);
    }
  }, [
    issueEditAcceptanceCriteria,
    issueEditApi,
    issueEditAutomatedTest,
    issueEditAssigneeId,
    issueEditDatabase,
    issueEditDescription,
    issueEditQualityScore,
    issueEditTestCases,
    issueEditTitle,
    loadIssues,
    selectedIssue,
    token,
  ]);

  const handleDeleteIssue = useCallback(async () => {
    if (!token || !selectedIssue) return;
    setDeletingIssue(true);
    try {
      await deleteIssue(token, selectedIssue.id);
      setSelectedIssueId("");
      await loadIssues();
    } catch (error) {
      Alert.alert("Delete issue failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setDeletingIssue(false);
    }
  }, [loadIssues, selectedIssue, token]);

  const handleDeleteAllIssues = useCallback(async () => {
    if (!token) return;
    Alert.alert(
      "Delete all issues",
      "This will permanently remove all issues in the selected project.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setClearingIssues(true);
            deleteAllIssues(token, selectedProjectId || undefined)
              .then(async () => {
                setSelectedIssueId("");
                await loadIssues();
              })
              .catch((error: unknown) => {
                Alert.alert(
                  "Delete all issues failed",
                  error instanceof Error ? error.message : "Unknown error"
                );
              })
              .finally(() => setClearingIssues(false));
          },
        },
      ]
    );
  }, [loadIssues, selectedProjectId, token]);

  const handleResetIssueBoardFilters = useCallback(() => {
    setIssueSearch("");
    setIssueBoardFocus("all");
    setIssueAssigneeFilter("all");
    setCollapsedIssueStatuses({
      backlog: false,
      todo: false,
      in_progress: false,
      done: false,
    });
  }, []);

  const handleCreateComment = useCallback(async () => {
    if (!token || !selectedIssue) return;
    const body = newCommentBody.trim();
    if (!body && pendingCommentAttachments.length === 0) return;
    setCreatingComment(true);
    try {
      const created = await createIssueComment(token, selectedIssue.id, body || " ");
      for (const attachment of pendingCommentAttachments) {
        if (attachment.type === "screenshot") {
          await addCommentAttachment(token, selectedIssue.id, created.id, {
            type: "screenshot",
            imageBase64: attachment.base64,
          });
        } else {
          await addCommentAttachment(token, selectedIssue.id, created.id, {
            type: "video",
            videoBase64: attachment.base64,
          });
        }
      }
      setNewCommentBody("");
      setPendingCommentAttachments([]);
      await loadIssueComments();
    } catch (error) {
      Alert.alert("Create comment failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setCreatingComment(false);
    }
  }, [loadIssueComments, newCommentBody, pendingCommentAttachments, selectedIssue, token]);

  const handleAddPendingCommentScreenshot = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
        quality: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const imageBase64 = await readBase64FromUri(asset.uri);
      if (!imageBase64?.trim()) {
        Alert.alert("Attach image failed", "Unable to read selected image.");
        return;
      }
      setPendingCommentAttachments((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, type: "screenshot", base64: imageBase64 },
      ]);
    } catch (error) {
      Alert.alert(
        "Attach image failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [readBase64FromUri]);

  const handleAddPendingCommentVideo = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: "video",
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const videoBase64 = await readBase64FromUri(asset.uri);
      if (!videoBase64?.trim()) {
        Alert.alert("Attach video failed", "Unable to read selected video.");
        return;
      }
      setPendingCommentAttachments((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, type: "video", base64: videoBase64 },
      ]);
    } catch (error) {
      Alert.alert(
        "Attach video failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [readBase64FromUri]);

  const handleCapturePendingCommentScreenshot = useCallback(async () => {
    try {
      const result = await launchCamera({
        mediaType: "photo",
        saveToPhotos: false,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const imageBase64 = await readBase64FromUri(asset.uri);
      if (!imageBase64?.trim()) {
        Alert.alert("Capture image failed", "Unable to read captured image.");
        return;
      }
      setPendingCommentAttachments((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, type: "screenshot", base64: imageBase64 },
      ]);
    } catch (error) {
      Alert.alert(
        "Capture image failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [readBase64FromUri]);

  const handleCapturePendingCommentVideo = useCallback(async () => {
    try {
      const result = await launchCamera({
        mediaType: "video",
        videoQuality: "high",
        durationLimit: 120,
        saveToPhotos: false,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const videoBase64 = await readBase64FromUri(asset.uri);
      if (!videoBase64?.trim()) {
        Alert.alert("Capture video failed", "Unable to read captured video.");
        return;
      }
      setPendingCommentAttachments((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, type: "video", base64: videoBase64 },
      ]);
    } catch (error) {
      Alert.alert(
        "Capture video failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [readBase64FromUri]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!token || !selectedIssue) return;
      try {
        await deleteIssueComment(token, selectedIssue.id, commentId);
        await loadIssueComments();
      } catch (error) {
        Alert.alert("Delete comment failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [loadIssueComments, selectedIssue, token]
  );

  const handleSaveComment = useCallback(async () => {
    if (!token || !selectedIssue || !editingCommentId) return;
    const body = commentEditBody.trim();
    if (!body) return;
    try {
      await updateIssueComment(token, selectedIssue.id, editingCommentId, body);
      setEditingCommentId("");
      setCommentEditBody("");
      await loadIssueComments();
    } catch (error) {
      Alert.alert("Update comment failed", error instanceof Error ? error.message : "Unknown error");
    }
  }, [commentEditBody, editingCommentId, loadIssueComments, selectedIssue, token]);

  const handleDeleteCommentAttachment = useCallback(
    async (commentId: string, attachmentId: string) => {
      if (!token || !selectedIssue) return;
      try {
        await deleteCommentAttachment(token, selectedIssue.id, commentId, attachmentId);
        await loadIssueComments();
      } catch (error) {
        Alert.alert(
          "Delete attachment failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [loadIssueComments, selectedIssue, token]
  );

  const handleAttachCommentScreenshot = useCallback(
    async (commentId: string) => {
      if (!token || !selectedIssue) return;
      try {
        const result = await launchImageLibrary({
          mediaType: "photo",
          selectionLimit: 1,
          quality: 1,
        });
        if (result.didCancel) return;
        const asset = result.assets?.[0];
        if (!asset?.uri) return;
        setUploadingCommentAttachmentId(commentId);
        const imageBase64 = await readBase64FromUri(asset.uri);
        if (!imageBase64?.trim()) {
          Alert.alert("Upload failed", "Unable to read selected image.");
          return;
        }
        await addCommentAttachment(token, selectedIssue.id, commentId, {
          type: "screenshot",
          imageBase64,
        });
        await loadIssueComments();
      } catch (error) {
        Alert.alert(
          "Attach image failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setUploadingCommentAttachmentId("");
      }
    },
    [loadIssueComments, readBase64FromUri, selectedIssue, token]
  );

  const handleAttachCommentVideo = useCallback(
    async (commentId: string) => {
      if (!token || !selectedIssue) return;
      try {
        const result = await launchImageLibrary({
          mediaType: "video",
          selectionLimit: 1,
        });
        if (result.didCancel) return;
        const asset = result.assets?.[0];
        if (!asset?.uri) return;
        setUploadingCommentAttachmentId(commentId);
        const videoBase64 = await readBase64FromUri(asset.uri);
        if (!videoBase64?.trim()) {
          Alert.alert("Upload failed", "Unable to read selected video.");
          return;
        }
        await addCommentAttachment(token, selectedIssue.id, commentId, {
          type: "video",
          videoBase64,
        });
        await loadIssueComments();
      } catch (error) {
        Alert.alert(
          "Attach video failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setUploadingCommentAttachmentId("");
      }
    },
    [loadIssueComments, readBase64FromUri, selectedIssue, token]
  );

  const handleSaveRecordingName = useCallback(async () => {
    if (!token || !selectedIssue || !editingRecordingId) return;
    try {
      await updateIssueRecording(token, selectedIssue.id, editingRecordingId, {
        name: recordingEditName.trim() || null,
      });
      setEditingRecordingId("");
      setRecordingEditName("");
      await loadIssues();
    } catch (error) {
      Alert.alert(
        "Update recording failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [editingRecordingId, loadIssues, recordingEditName, selectedIssue, token]);

  const handleDeleteRecording = useCallback(
    async (recordingId: string) => {
      if (!token || !selectedIssue) return;
      try {
        await deleteIssueRecording(token, selectedIssue.id, recordingId);
        if (editingRecordingId === recordingId) {
          setEditingRecordingId("");
          setRecordingEditName("");
        }
        await loadIssues();
      } catch (error) {
        Alert.alert(
          "Delete recording failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [editingRecordingId, loadIssues, selectedIssue, token]
  );

  const handleSaveScreenshotName = useCallback(async () => {
    if (!token || !selectedIssue || !editingScreenshotId) return;
    try {
      await updateIssueScreenshot(token, selectedIssue.id, editingScreenshotId, {
        name: screenshotEditName.trim() || null,
      });
      setEditingScreenshotId("");
      setScreenshotEditName("");
      await loadIssues();
    } catch (error) {
      Alert.alert(
        "Update screenshot failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }, [editingScreenshotId, loadIssues, screenshotEditName, selectedIssue, token]);

  const handleDeleteScreenshot = useCallback(
    async (screenshotId: string) => {
      if (!token || !selectedIssue) return;
      try {
        await deleteIssueScreenshot(token, selectedIssue.id, screenshotId);
        if (editingScreenshotId === screenshotId) {
          setEditingScreenshotId("");
          setScreenshotEditName("");
        }
        await loadIssues();
      } catch (error) {
        Alert.alert(
          "Delete screenshot failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [editingScreenshotId, loadIssues, selectedIssue, token]
  );

  const handleSaveFileName = useCallback(async () => {
    if (!token || !selectedIssue || !editingFileId) return;
    const fileName = fileEditName.trim();
    if (!fileName) return;
    try {
      await updateIssueFile(token, selectedIssue.id, editingFileId, { fileName });
      setEditingFileId("");
      setFileEditName("");
      await loadIssues();
    } catch (error) {
      Alert.alert("Update file failed", error instanceof Error ? error.message : "Unknown error");
    }
  }, [editingFileId, fileEditName, loadIssues, selectedIssue, token]);

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      if (!token || !selectedIssue) return;
      try {
        await deleteIssueFile(token, selectedIssue.id, fileId);
        if (editingFileId === fileId) {
          setEditingFileId("");
          setFileEditName("");
        }
        await loadIssues();
      } catch (error) {
        Alert.alert("Delete file failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [editingFileId, loadIssues, selectedIssue, token]
  );

  const readBase64FromUri = useCallback(async (uri: string) => {
    const path = normalizeFilePath(uri);
    return RNFS.readFile(path, "base64");
  }, []);

  const handleUploadScreenshot = useCallback(async () => {
    if (!token || !selectedIssue) return;
    try {
      const result = await launchImageLibrary({
        mediaType: "photo",
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setUploadingIssueAsset(true);
      const imageBase64 = asset.base64 || (await readBase64FromUri(asset.uri));
      if (!imageBase64?.trim()) {
        Alert.alert("Upload failed", "Unable to read selected image.");
        return;
      }
      await uploadIssueScreenshot(
        token,
        selectedIssue.id,
        imageBase64,
        asset.fileName ?? fileNameFromUri(asset.uri, "screenshot.png")
      );
      await loadIssues();
    } catch (error) {
      Alert.alert("Upload screenshot failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUploadingIssueAsset(false);
    }
  }, [loadIssues, readBase64FromUri, selectedIssue, token]);

  const handleUploadRecording = useCallback(async () => {
    if (!token || !selectedIssue) return;
    try {
      const result = await launchImageLibrary({
        mediaType: "video",
        selectionLimit: 1,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setUploadingIssueAsset(true);
      const videoBase64 = await readBase64FromUri(asset.uri);
      if (!videoBase64?.trim()) {
        Alert.alert("Upload failed", "Unable to read selected video.");
        return;
      }
      await uploadIssueRecording(
        token,
        selectedIssue.id,
        videoBase64,
        "video",
        "screen",
        asset.fileName ?? fileNameFromUri(asset.uri, "recording.webm")
      );
      await loadIssues();
    } catch (error) {
      Alert.alert("Upload recording failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUploadingIssueAsset(false);
    }
  }, [loadIssues, readBase64FromUri, selectedIssue, token]);

  const handleCaptureScreenshot = useCallback(async () => {
    if (!token || !selectedIssue) return;
    try {
      const result = await launchCamera({
        mediaType: "photo",
        saveToPhotos: false,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setUploadingIssueAsset(true);
      const imageBase64 = asset.base64 || (await readBase64FromUri(asset.uri));
      if (!imageBase64?.trim()) {
        Alert.alert("Upload failed", "Unable to read captured image.");
        return;
      }
      await uploadIssueScreenshot(
        token,
        selectedIssue.id,
        imageBase64,
        asset.fileName ?? fileNameFromUri(asset.uri, "capture.png")
      );
      await loadIssues();
    } catch (error) {
      Alert.alert(
        "Capture screenshot failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setUploadingIssueAsset(false);
    }
  }, [loadIssues, readBase64FromUri, selectedIssue, token]);

  const handleCaptureRecording = useCallback(async () => {
    if (!token || !selectedIssue) return;
    try {
      const result = await launchCamera({
        mediaType: "video",
        videoQuality: "high",
        durationLimit: 120,
        saveToPhotos: false,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setUploadingIssueAsset(true);
      const videoBase64 = await readBase64FromUri(asset.uri);
      if (!videoBase64?.trim()) {
        Alert.alert("Upload failed", "Unable to read captured video.");
        return;
      }
      await uploadIssueRecording(
        token,
        selectedIssue.id,
        videoBase64,
        "video",
        "camera",
        asset.fileName ?? fileNameFromUri(asset.uri, "capture.mov")
      );
      await loadIssues();
    } catch (error) {
      Alert.alert(
        "Capture recording failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setUploadingIssueAsset(false);
    }
  }, [loadIssues, readBase64FromUri, selectedIssue, token]);

  const handleUploadFile = useCallback(async () => {
    if (!token || !selectedIssue) return;
    try {
      const picked = await pickDocument({
        type: [documentPickerTypes.allFiles],
        allowMultiSelection: false,
      });
      const item = picked[0];
      const copyName = item?.name?.trim() || "file.bin";
      const copied = await keepPickedFileLocalCopy({
        files: [{ uri: item.uri, fileName: copyName }],
        destination: "cachesDirectory",
      });
      const copiedFile = copied[0];
      const uri = copiedFile?.status === "success" ? copiedFile.localUri : item?.uri;
      const name = item?.name?.trim() || (uri ? fileNameFromUri(uri, "file.bin") : "");
      if (!uri || !name) return;
      setUploadingIssueAsset(true);
      const fileBase64 = await readBase64FromUri(uri);
      if (!fileBase64?.trim()) {
        Alert.alert("Upload failed", "Unable to read selected file.");
        return;
      }
      await uploadIssueFile(token, selectedIssue.id, fileBase64, name);
      await loadIssues();
    } catch (error) {
      if (
        isDocumentPickerErrorWithCode(error) &&
        error.code === documentPickerErrorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      Alert.alert("Upload file failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUploadingIssueAsset(false);
    }
  }, [loadIssues, readBase64FromUri, selectedIssue, token]);

  const handleRunAutomatedTest = useCallback(
    async (testName: string) => {
      if (!token) return;
      const key = testName.trim();
      if (!key) return;
      setRunningUiTests((prev) => ({ ...prev, [key]: true }));
      try {
        const result = await runUiTest(token, key);
        setUiTestResults((prev) => ({ ...prev, [key]: result }));
      } catch (error) {
        setUiTestResults((prev) => ({
          ...prev,
          [key]: {
            success: false,
            exitCode: 1,
            output: "",
            errorOutput: error instanceof Error ? error.message : "Unknown error",
          },
        }));
      } finally {
        setRunningUiTests((prev) => ({ ...prev, [key]: false }));
      }
    },
    [token]
  );

  const handleRunAllIssueAutomatedTests = useCallback(async () => {
    if (runningIssueAutomatedTests) return;
    const tests = automatedTestNames.map((test) => test.trim()).filter(Boolean);
    if (!tests.length) return;
    setRunningIssueAutomatedTests(true);
    try {
      for (const testName of tests) {
        await handleRunAutomatedTest(testName);
      }
    } finally {
      setRunningIssueAutomatedTests(false);
    }
  }, [automatedTestNames, handleRunAutomatedTest, runningIssueAutomatedTests]);

  const handleRunUiSuite = useCallback(
    async (suiteKey: string, tests: string[]) => {
      if (!tests.length || uiTestsBusy) return;
      setRunningUiSuiteKey(suiteKey);
      try {
        for (const testName of tests) {
          const normalized = testName.trim();
          if (!normalized) continue;
          await handleRunAutomatedTest(normalized);
        }
      } finally {
        setRunningUiSuiteKey(null);
      }
    },
    [handleRunAutomatedTest, uiTestsBusy]
  );

  const handleRunAllDiscoveredUiTests = useCallback(async () => {
    if (uiTestsBusy || !discoveredUiTestNames.length) return;
    setRunningAllUiTests(true);
    try {
      for (const testName of discoveredUiTestNames) {
        await handleRunAutomatedTest(testName);
      }
    } finally {
      setRunningAllUiTests(false);
    }
  }, [discoveredUiTestNames, handleRunAutomatedTest, uiTestsBusy]);

  const handleRunUiTests = useCallback(async () => {
    if (!token) return;
    const grep = testUiPattern.trim();
    if (!grep) return;
    setShowFullUiOutput(false);
    setRunningTests((prev) => ({ ...prev, ui: true }));
    try {
      const result = await runUiTest(token, grep);
      setLatestUiTestResult(result);
    } catch (error) {
      setLatestUiTestResult({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRunningTests((prev) => ({ ...prev, ui: false }));
    }
  }, [testUiPattern, token]);

  const handleRunApiTests = useCallback(async () => {
    if (!token) return;
    const pattern = testApiPattern.trim();
    if (!pattern) return;
    setShowFullApiOutput(false);
    setRunningTests((prev) => ({ ...prev, api: true }));
    try {
      const result = await runApiTest(token, pattern);
      setLatestApiTestResult(result);
    } catch (error) {
      setLatestApiTestResult({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRunningTests((prev) => ({ ...prev, api: false }));
    }
  }, [testApiPattern, token]);

  const handleRunSingleApiTest = useCallback(
    async (testName: string) => {
      if (!token) return;
      const key = testName.trim();
      if (!key) return;
      if (runningApiTestName) return;
      setRunningApiTestName(key);
      try {
        const result = await runApiTest(token, key);
        setApiTestResultsByName((current) => ({ ...current, [key]: result }));
      } catch (error) {
        setApiTestResultsByName((current) => ({
          ...current,
          [key]: {
            success: false,
            exitCode: 1,
            output: "",
            errorOutput: error instanceof Error ? error.message : "Unknown error",
          },
        }));
      } finally {
        setRunningApiTestName(null);
      }
    },
    [runningApiTestName, token]
  );

  const handleRunApiSuite = useCallback(
    async (suiteKey: string, tests: string[]) => {
      if (!tests.length || apiTestsBusy) return;
      setRunningApiSuiteKey(suiteKey);
      try {
        for (const testName of tests) {
          await handleRunSingleApiTest(testName);
        }
      } finally {
        setRunningApiSuiteKey(null);
      }
    },
    [apiTestsBusy, handleRunSingleApiTest]
  );

  const handleRunAllApiTests = useCallback(async () => {
    if (apiTestsBusy || !apiTestNames.length) return;
    setRunningAllApiTests(true);
    try {
      for (const testName of apiTestNames) {
        await handleRunSingleApiTest(testName);
      }
    } finally {
      setRunningAllApiTests(false);
    }
  }, [apiTestNames, apiTestsBusy, handleRunSingleApiTest]);

  const handleClearUiTestResults = useCallback(() => {
    setRunningUiTests({});
    setUiTestResults({});
    setLatestUiTestResult(null);
    setShowFullUiOutput(false);
    setRunningUiSuiteKey(null);
    setRunningAllUiTests(false);
  }, []);

  const handleClearApiTestResults = useCallback(() => {
    setRunningApiTestName(null);
    setRunningApiSuiteKey(null);
    setRunningAllApiTests(false);
    setApiTestResultsByName({});
    setLatestApiTestResult(null);
    setShowFullApiOutput(false);
  }, []);

  const handleCreateExpense = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    const description = createExpenseForm.description.trim();
    const amount = Number(createExpenseForm.amount);
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid expense", "Enter a description and amount greater than 0.");
      return;
    }

    setCreatingExpense(true);
    try {
      await createExpense(token, {
        projectId: selectedProjectId,
        description,
        amount,
        date: createExpenseForm.date,
        category: createExpenseForm.category || "General",
      });
      setCreateExpenseForm((current) => ({ ...current, description: "", amount: "" }));
      await loadExpenses();
    } catch (error) {
      Alert.alert("Create expense failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setCreatingExpense(false);
    }
  }, [createExpenseForm, loadExpenses, selectedProjectId, token]);

  const beginEditExpense = useCallback((expense: Expense) => {
    setEditingExpenseId(expense.id);
    setExpenseEditDescription(expense.description ?? "");
    setExpenseEditAmount(String(expense.amount ?? ""));
    setExpenseEditDate(expense.date ?? new Date().toISOString().slice(0, 10));
    setExpenseEditCategory(expense.category || "General");
  }, []);

  const handleSaveExpenseEdit = useCallback(async () => {
    if (!token || !editingExpenseId) return;
    const description = expenseEditDescription.trim();
    const amount = Number(expenseEditAmount);
    const date = expenseEditDate.trim() || new Date().toISOString().slice(0, 10);
    const category = expenseEditCategory.trim() || "General";
    if (!description || !Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Invalid expense", "Enter a description and amount greater than 0.");
      return;
    }
    setSavingExpenseEdit(true);
    try {
      await updateExpense(token, editingExpenseId, { description, amount, date, category });
      setEditingExpenseId("");
      setExpenseEditDescription("");
      setExpenseEditAmount("");
      setExpenseEditDate("");
      setExpenseEditCategory("General");
      await loadExpenses();
    } catch (error) {
      Alert.alert("Update expense failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSavingExpenseEdit(false);
    }
  }, [
    editingExpenseId,
    expenseEditAmount,
    expenseEditCategory,
    expenseEditDate,
    expenseEditDescription,
    loadExpenses,
    token,
  ]);

  const handleDeleteExpense = useCallback(
    async (expenseId: string) => {
      if (!token) return;
      setDeletingExpenseId(expenseId);
      try {
        await deleteExpense(token, expenseId);
        if (editingExpenseId === expenseId) {
          setEditingExpenseId("");
          setExpenseEditDescription("");
          setExpenseEditAmount("");
          setExpenseEditDate("");
          setExpenseEditCategory("General");
        }
        await loadExpenses();
      } catch (error) {
        Alert.alert("Delete expense failed", error instanceof Error ? error.message : "Unknown error");
      } finally {
        setDeletingExpenseId("");
      }
    },
    [editingExpenseId, loadExpenses, token]
  );

  const createAssistantMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const buildIdeaAssistantContext = useCallback(
    (messages: AssistantChatMessage[], nextPrompt: string) => {
      const recent = messages.slice(-8);
      const transcript = recent
        .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`)
        .join("\n");
      return [
        "Continue this conversation and answer the latest user request.",
        transcript ? `Conversation:\n${transcript}` : null,
        `User: ${nextPrompt}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    },
    []
  );

  const handleIdeaAssistantSend = useCallback(
    async (idea: ChecklistItem) => {
      if (!token) return;
      const draft = (ideaAssistantDraftById[idea.id] ?? "").trim();
      if (!draft) return;
      if (ideaAssistantLoadingById[idea.id]) return;
      const prior = ideaAssistantChatById[idea.id] ?? [];
      const context = buildIdeaAssistantContext(prior, draft);
      const userMessage: AssistantChatMessage = {
        id: createAssistantMessageId(),
        role: "user",
        text: draft,
      };
      setIdeaAssistantExpandedById((current) => ({ ...current, [idea.id]: true }));
      setIdeaAssistantDraftById((current) => ({ ...current, [idea.id]: "" }));
      setIdeaAssistantChatById((current) => ({
        ...current,
        [idea.id]: [...(current[idea.id] ?? []), userMessage],
      }));
      setIdeaAssistantLoadingById((current) => ({ ...current, [idea.id]: true }));
      try {
        const result: IdeaAssistantChatResult = await generateIdeaAssistantChat(token, idea.id, context);
        const assistantText =
          typeof result.message === "string" && result.message.trim()
            ? result.message.trim()
            : "No assistant response text was returned.";
        setIdeaAssistantChatById((current) => ({
          ...current,
          [idea.id]: [
            ...(current[idea.id] ?? []),
            { id: createAssistantMessageId(), role: "assistant", text: assistantText },
          ],
        }));
      } catch (error) {
        setIdeaAssistantChatById((current) => ({
          ...current,
          [idea.id]: [
            ...(current[idea.id] ?? []),
            {
              id: createAssistantMessageId(),
              role: "assistant",
              text: error instanceof Error ? error.message : "Failed to generate AI assistant response",
            },
          ],
        }));
      } finally {
        setIdeaAssistantLoadingById((current) => ({ ...current, [idea.id]: false }));
      }
    },
    [
      buildIdeaAssistantContext,
      createAssistantMessageId,
      ideaAssistantChatById,
      ideaAssistantDraftById,
      ideaAssistantLoadingById,
      token,
    ]
  );

  const handleChecklistReorder = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem, direction: "up" | "down") => {
      if (!token || !selectedProjectId) return;
      const items =
        kind === "features"
          ? features
          : kind === "enhancements"
            ? enhancements
          : kind === "todos"
            ? todos
            : kind === "ideas"
              ? ideas
              : bugs;
      const sorted = [...items].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((entry) => entry.id === item.id);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;
      const swapped = [...sorted];
      const tmp = swapped[index];
      swapped[index] = swapped[targetIndex];
      swapped[targetIndex] = tmp;
      const ids = swapped.map((entry) => entry.id);
      try {
        if (kind === "features") {
          await reorderFeatures(token, selectedProjectId, ids);
          await loadFeatures();
        }
        if (kind === "todos") {
          await reorderTodos(token, selectedProjectId, ids);
          await loadTodos();
        }
        if (kind === "ideas") {
          await reorderIdeas(token, selectedProjectId, ids);
          await loadIdeas();
        }
        if (kind === "bugs") {
          await reorderBugs(token, selectedProjectId, ids);
          await loadBugs();
        }
        if (kind === "enhancements") {
          const reordered = swapped.map((entry, reorderIndex) => ({
            ...entry,
            order: reorderIndex,
          }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(reordered));
          setEnhancements(reordered);
        }
      } catch (error) {
        Alert.alert("Reorder failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [
      bugs,
      enhancements,
      features,
      ideas,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todos,
      token,
    ]
  );

  const handleChecklistCreate = useCallback(
    async (kind: ChecklistKind) => {
      if (!token || !selectedProjectId) return;
      if (kind === "features") {
        const name = featureName.trim();
        if (!name) return;
        setCreatingFeature(true);
        try {
          await createFeature(token, { projectId: selectedProjectId, name });
          setFeatureName("");
          await loadFeatures();
        } catch (error) {
          Alert.alert("Create feature failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingFeature(false);
        }
      }

      if (kind === "enhancements") {
        const name = enhancementName.trim();
        if (!name) return;
        setCreatingEnhancement(true);
        try {
          const nextItem: ChecklistItem = {
            id: `enh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name,
            done: false,
            order: enhancements.length,
            projectId: selectedProjectId,
            createdAt: new Date().toISOString(),
          };
          const next = [...enhancements, nextItem];
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
          setEnhancementName("");
        } catch (error) {
          Alert.alert(
            "Create enhancement failed",
            error instanceof Error ? error.message : "Unknown error"
          );
        } finally {
          setCreatingEnhancement(false);
        }
      }

      if (kind === "todos") {
        const name = todoName.trim();
        if (!name) return;
        setCreatingTodo(true);
        try {
          await createTodo(token, { projectId: selectedProjectId, name });
          setTodoName("");
          await loadTodos();
        } catch (error) {
          Alert.alert("Create todo failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingTodo(false);
        }
      }

      if (kind === "ideas") {
        const name = ideaName.trim();
        if (!name) return;
        setCreatingIdea(true);
        try {
          await createIdea(token, { projectId: selectedProjectId, name });
          setIdeaName("");
          await loadIdeas();
        } catch (error) {
          Alert.alert("Create idea failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingIdea(false);
        }
      }

      if (kind === "bugs") {
        const name = bugName.trim();
        if (!name) return;
        setCreatingBug(true);
        try {
          await createBug(token, { projectId: selectedProjectId, name });
          setBugName("");
          await loadBugs();
        } catch (error) {
          Alert.alert("Create bug failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingBug(false);
        }
      }
    },
    [
      bugName,
      enhancementName,
      enhancements,
      featureName,
      ideaName,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todoName,
      token,
    ]
  );

  const handleChecklistToggle = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem) => {
      if (!token) return;
      try {
        if (kind === "features") {
          await updateFeature(token, item.id, { done: !item.done });
          await loadFeatures();
        }
        if (kind === "todos") {
          await updateTodo(token, item.id, { done: !item.done });
          await loadTodos();
        }
        if (kind === "ideas") {
          await updateIdea(token, item.id, { done: !item.done });
          await loadIdeas();
        }
        if (kind === "bugs") {
          await updateBug(token, item.id, { done: !item.done });
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements.map((entry) =>
            entry.id === item.id ? { ...entry, done: !entry.done } : entry
          );
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [enhancements, loadBugs, loadFeatures, loadIdeas, loadTodos, selectedProjectId, token]
  );

  const handleChecklistDelete = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem) => {
      if (!token) return;
      try {
        if (kind === "features") {
          await deleteFeature(token, item.id);
          await loadFeatures();
        }
        if (kind === "todos") {
          await deleteTodo(token, item.id);
          await loadTodos();
        }
        if (kind === "ideas") {
          await deleteIdea(token, item.id);
          await loadIdeas();
        }
        if (kind === "bugs") {
          await deleteBug(token, item.id);
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements
            .filter((entry) => entry.id !== item.id)
            .map((entry, index) => ({ ...entry, order: index }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [enhancements, loadBugs, loadFeatures, loadIdeas, loadTodos, selectedProjectId, token]
  );

  const handleChecklistClearDone = useCallback(
    async (kind: ChecklistKind) => {
      if (!token) return;
      const list =
        kind === "features"
          ? features
          : kind === "enhancements"
            ? enhancements
            : kind === "todos"
              ? todos
              : kind === "ideas"
                ? ideas
                : bugs;
      const completed = list.filter((item) => item.done);
      if (!completed.length) return;
      try {
        if (kind === "features") {
          await Promise.all(completed.map((item) => deleteFeature(token, item.id)));
          await loadFeatures();
          return;
        }
        if (kind === "todos") {
          await Promise.all(completed.map((item) => deleteTodo(token, item.id)));
          await loadTodos();
          return;
        }
        if (kind === "ideas") {
          await Promise.all(completed.map((item) => deleteIdea(token, item.id)));
          await loadIdeas();
          return;
        }
        if (kind === "bugs") {
          await Promise.all(completed.map((item) => deleteBug(token, item.id)));
          await loadBugs();
          return;
        }
        if (kind === "enhancements") {
          const next = enhancements
            .filter((entry) => !entry.done)
            .map((entry, index) => ({ ...entry, order: index }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert(
          "Clear completed failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [
      bugs,
      enhancements,
      features,
      ideas,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todos,
      token,
    ]
  );

  const startChecklistEdit = useCallback((kind: ChecklistKind, item: ChecklistItem) => {
    setEditingChecklist({ kind, id: item.id, name: item.name });
  }, []);

  const cancelChecklistEdit = useCallback(() => {
    setEditingChecklist(null);
  }, []);

  const saveChecklistEdit = useCallback(
    async (kind: ChecklistKind) => {
      if (!token || !editingChecklist || editingChecklist.kind !== kind) return;
      const name = editingChecklist.name.trim();
      if (!name) return;
      try {
        if (kind === "features") {
          await updateFeature(token, editingChecklist.id, { name });
          await loadFeatures();
        }
        if (kind === "todos") {
          await updateTodo(token, editingChecklist.id, { name });
          await loadTodos();
        }
        if (kind === "ideas") {
          await updateIdea(token, editingChecklist.id, { name });
          await loadIdeas();
        }
        if (kind === "bugs") {
          await updateBug(token, editingChecklist.id, { name });
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements.map((entry) =>
            entry.id === editingChecklist.id ? { ...entry, name } : entry
          );
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
        setEditingChecklist(null);
      } catch (error) {
        Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [
      editingChecklist,
      enhancements,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      token,
    ]
  );

  if (initializing) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centeredFill}>
          <ActivityIndicator />
          <Text style={styles.subtle}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token && !authBypassEnabled) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.authContainer}>
          <Text style={styles.title}>IdeaHome</Text>
          <Text style={styles.body}>Sign in with Google using secure native authentication.</Text>
          <AppButton
            label={authInProgress ? "Signing in..." : "Continue with Google"}
            disabled={authInProgress}
            onPress={() => {
              signIn("google").catch(() => {
                // handled in signIn
              });
            }}
          />
          <Text style={styles.subtle}>We use Safari for secure Google authentication.</Text>
          <AppButton
            label="Continue without login (testing)"
            variant="secondary"
            onPress={() => {
              enableAuthBypass().catch(() => {
                Alert.alert("Unable to enable test mode");
              });
            }}
          />
          {authErrorMessage ? <Text style={styles.errorText}>{authErrorMessage}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topBar}>
        <Text style={styles.brand}>IdeaHome</Text>
        <AppButton
          label={
            signOutInProgress
              ? "Signing out..."
              : token
              ? "Sign out"
              : authBypassEnabled
              ? "Exit test mode"
              : "Sign out"
          }
          variant="secondary"
          disabled={signOutInProgress}
          onPress={() => {
            if (!token && authBypassEnabled) {
              disableAuthBypass().catch(() => {
                Alert.alert("Unable to disable test mode");
              });
              return;
            }
            setSignOutInProgress(true);
            signOutNative()
              .catch(() => {
                Alert.alert("Unable to clear session");
              })
              .finally(() => setSignOutInProgress(false));
          }}
        />
      </View>

      <TabSwitch<AppTab>
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "home", label: "Home" },
          { value: "projects", label: "Projects" },
          { value: "issues", label: "Issues" },
          { value: "expenses", label: "Expenses" },
          { value: "features", label: "Features" },
          { value: "todos", label: "Todos" },
          { value: "ideas", label: "Ideas" },
          { value: "bugs", label: "Bugs" },
          { value: "enhancements", label: "Enhancements" },
          { value: "tests", label: "Tests" },
          { value: "settings", label: "Settings" },
        ]}
      />

      <View style={styles.content}>
        <ProjectPicker
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onRefresh={() => {
            loadProjects().catch(() => {
              // handled in loadProjects
            });
          }}
          loading={projectsLoading}
          error={projectsError}
        />

        {activeTab === "home" ? (
          <View style={styles.stack}>
            <AppCard title="Projects">
              <Text style={styles.bigValue}>{projects.length}</Text>
            </AppCard>
            <AppCard title="Current Project">
              <Text style={styles.valueText}>{selectedProject?.name ?? "No project selected"}</Text>
            </AppCard>
            <AppCard title="Summary">
              <Text style={styles.body}>Issues: {issues.length}</Text>
              <Text style={styles.body}>Expenses: ${expensesTotal.toFixed(2)}</Text>
              <Text style={styles.body}>Features: {features.length}</Text>
              <Text style={styles.body}>Todos: {todos.length}</Text>
              <Text style={styles.body}>Ideas: {ideas.length}</Text>
              <Text style={styles.body}>Bugs: {bugs.length}</Text>
              <Text style={styles.body}>Enhancements: {enhancements.length}</Text>
            </AppCard>
          </View>
        ) : null}

        {activeTab === "projects" ? (
          <View style={styles.stackFill}>
            <AppCard title="Create Project">
              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.input}
                  value={createProjectName}
                  onChangeText={setCreateProjectName}
                  placeholder="Project name"
                  placeholderTextColor="#94a3b8"
                />
                <AppButton
                  label={creatingProject ? "Adding..." : "Add"}
                  disabled={creatingProject || !createProjectName.trim()}
                  onPress={() => {
                    handleCreateProject().catch(() => {
                      // handled
                    });
                  }}
                />
              </View>
            </AppCard>
            <AppCard title="Project Settings">
              {selectedProject ? (
                <View style={styles.stack}>
                  <TextInput
                    style={styles.input}
                    value={projectEditName}
                    onChangeText={setProjectEditName}
                    placeholder="Project name"
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.inlineRow}>
                    <AppButton
                      label={savingProjectEdit ? "Saving..." : "Save Name"}
                      disabled={
                        savingProjectEdit ||
                        !projectEditName.trim() ||
                        projectEditName.trim() === selectedProject.name
                      }
                      onPress={() => {
                        handleUpdateProject().catch(() => {
                          // handled
                        });
                      }}
                    />
                    <AppButton
                      label={deletingProject ? "Deleting..." : "Delete Project"}
                      variant="secondary"
                      disabled={deletingProject}
                      onPress={() => {
                        handleDeleteProject().catch(() => {
                          // handled
                        });
                      }}
                    />
                  </View>
                </View>
              ) : (
                <Text style={styles.subtle}>Select a project to edit or delete it.</Text>
              )}
            </AppCard>
            <AppCard title="Projects" style={styles.fillCard}>
              <FlatList
                data={projects}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.listItem,
                      item.id === selectedProjectId ? styles.listItemSelected : null,
                    ]}
                    onPress={() => setSelectedProjectId(item.id)}
                  >
                    <Text style={styles.listItemTitle}>{item.name}</Text>
                    <Text style={styles.listItemMeta}>{item.id}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.subtle}>No projects yet.</Text>}
              />
            </AppCard>
          </View>
        ) : null}

        {activeTab === "issues" ? (
          <View style={styles.stackFill}>
            <AppCard title="Create Issue">
              <View style={styles.stack}>
                <TextInput
                  style={styles.input}
                  value={issueSearch}
                  onChangeText={setIssueSearch}
                  placeholder="Search issues"
                  placeholderTextColor="#94a3b8"
                />
                <AppButton
                  label="Apply Search"
                  variant="secondary"
                  onPress={() => {
                    loadIssues().catch(() => {
                      // handled
                    });
                  }}
                />
                <TextInput
                  style={styles.input}
                  value={newIssueTitle}
                  onChangeText={setNewIssueTitle}
                  placeholder="Issue title"
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newIssueDescription}
                  onChangeText={setNewIssueDescription}
                  placeholder="Issue description"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newIssueAcceptanceCriteria}
                  onChangeText={setNewIssueAcceptanceCriteria}
                  placeholder="Acceptance criteria"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <TextInput
                  style={styles.input}
                  value={newIssueDatabase}
                  onChangeText={setNewIssueDatabase}
                  placeholder="Database notes"
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  style={styles.input}
                  value={newIssueApi}
                  onChangeText={setNewIssueApi}
                  placeholder="API notes"
                  placeholderTextColor="#94a3b8"
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newIssueTestCases}
                  onChangeText={setNewIssueTestCases}
                  placeholder="Test cases"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={newIssueAutomatedTest}
                  onChangeText={setNewIssueAutomatedTest}
                  placeholder="Automated tests"
                  placeholderTextColor="#94a3b8"
                  multiline
                />
                <TextInput
                  style={styles.input}
                  value={newIssueQualityScore}
                  onChangeText={setNewIssueQualityScore}
                  keyboardType="decimal-pad"
                  placeholder="Quality score (0-100)"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.sectionLabel}>Assignee</Text>
                {usersLoading ? <ActivityIndicator /> : null}
                {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
                <View style={styles.chipWrap}>
                  <Pressable
                    style={[styles.chip, !newIssueAssigneeId ? styles.chipActive : null]}
                    onPress={() => setNewIssueAssigneeId("")}
                  >
                    <Text style={[styles.chipText, !newIssueAssigneeId ? styles.chipTextActive : null]}>
                      Unassigned
                    </Text>
                  </Pressable>
                  {users.map((user) => (
                    <Pressable
                      key={user.id}
                      style={[styles.chip, newIssueAssigneeId === user.id ? styles.chipActive : null]}
                      onPress={() => setNewIssueAssigneeId(user.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          newIssueAssigneeId === user.id ? styles.chipTextActive : null,
                        ]}
                      >
                        {user.name || user.email}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={[styles.inlineRowWrap, styles.spaceTop]}>
                <AppButton
                  label={creatingIssue ? "Creating..." : "Create"}
                  disabled={creatingIssue || !newIssueTitle.trim() || !selectedProjectId}
                  onPress={() => {
                    handleCreateIssue().catch(() => {
                      // handled
                    });
                  }}
                />
                <AppButton
                  label={clearingIssues ? "Deleting..." : "Delete All Issues"}
                  variant="secondary"
                  disabled={clearingIssues || !issues.length}
                  onPress={() => {
                    handleDeleteAllIssues().catch(() => {
                      // handled
                    });
                  }}
                />
              </View>
            </AppCard>

            <AppCard title="Issue Board" style={styles.fillCard}>
              {issuesLoading ? <ActivityIndicator /> : null}
              {issuesError ? <Text style={styles.errorText}>{issuesError}</Text> : null}
              <View style={styles.issueMetaRow}>
                <View style={styles.issueMetaPill}>
                  <Text style={styles.listItemMeta}>Total: {filteredIssues.length}</Text>
                </View>
                <View style={styles.issueMetaPill}>
                  <Text style={styles.listItemMeta}>
                    Open: {(issuesByStatus.backlog?.length ?? 0) + (issuesByStatus.todo?.length ?? 0) + (issuesByStatus.in_progress?.length ?? 0)}
                  </Text>
                </View>
                <View style={styles.issueMetaPill}>
                  <Text style={styles.listItemMeta}>Done: {issuesByStatus.done?.length ?? 0}</Text>
                </View>
              </View>
              <View style={styles.inlineRowWrap}>
                <AppButton
                  label="Refresh Board"
                  variant="secondary"
                  onPress={() => {
                    loadIssues().catch(() => {
                      // handled
                    });
                  }}
                />
                <AppButton
                  label="Reset Filters"
                  variant="secondary"
                  onPress={handleResetIssueBoardFilters}
                />
                <AppButton
                  label="Clear Selection"
                  variant="secondary"
                  disabled={!selectedIssueId}
                  onPress={() => setSelectedIssueId("")}
                />
                <AppButton
                  label="Collapse All"
                  variant="secondary"
                  onPress={() =>
                    setCollapsedIssueStatuses({
                      backlog: true,
                      todo: true,
                      in_progress: true,
                      done: true,
                    })
                  }
                />
                <AppButton
                  label="Expand All"
                  variant="secondary"
                  onPress={() =>
                    setCollapsedIssueStatuses({
                      backlog: false,
                      todo: false,
                      in_progress: false,
                      done: false,
                    })
                  }
                />
              </View>
              <Text style={styles.sectionLabel}>Assignee Filter</Text>
              <View style={styles.chipWrap}>
                <Pressable
                  style={[styles.chip, issueAssigneeFilter === "all" ? styles.chipActive : null]}
                  onPress={() => setIssueAssigneeFilter("all")}
                >
                  <Text style={[styles.chipText, issueAssigneeFilter === "all" ? styles.chipTextActive : null]}>
                    All
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.chip, issueAssigneeFilter === "unassigned" ? styles.chipActive : null]}
                  onPress={() => setIssueAssigneeFilter("unassigned")}
                >
                  <Text
                    style={[
                      styles.chipText,
                      issueAssigneeFilter === "unassigned" ? styles.chipTextActive : null,
                    ]}
                  >
                    Unassigned
                  </Text>
                </Pressable>
                {users.map((user) => (
                  <Pressable
                    key={`board-filter-${user.id}`}
                    style={[styles.chip, issueAssigneeFilter === user.id ? styles.chipActive : null]}
                    onPress={() => setIssueAssigneeFilter(user.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        issueAssigneeFilter === user.id ? styles.chipTextActive : null,
                      ]}
                    >
                      {user.name || user.email}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.chipWrap}>
                <Pressable
                  style={[styles.chip, issueBoardFocus === "all" ? styles.chipActive : null]}
                  onPress={() => setIssueBoardFocus("all")}
                >
                  <Text style={[styles.chipText, issueBoardFocus === "all" ? styles.chipTextActive : null]}>
                    All
                  </Text>
                </Pressable>
                {ISSUE_STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.chip, issueBoardFocus === status ? styles.chipActive : null]}
                    onPress={() => setIssueBoardFocus(status)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        issueBoardFocus === status ? styles.chipTextActive : null,
                      ]}
                    >
                      {statusLabel(status)} ({(issuesByStatus[status] ?? []).length})
                    </Text>
                  </Pressable>
                ))}
              </View>
              <FlatList
                data={ISSUE_STATUSES.filter((status) => issueBoardFocus === "all" || issueBoardFocus === status)}
                keyExtractor={(status) => status}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item: status }) => (
                  <View style={styles.issueGroup}>
                    <View style={styles.issueGroupHeader}>
                      <Text style={styles.issueGroupTitle}>
                        {statusLabel(status)} ({(issuesByStatus[status] ?? []).length})
                      </Text>
                      <AppButton
                        label={collapsedIssueStatuses[status] ? "Expand" : "Collapse"}
                        variant="secondary"
                        onPress={() =>
                          setCollapsedIssueStatuses((current) => ({
                            ...current,
                            [status]: !current[status],
                          }))
                        }
                      />
                    </View>
                    {!collapsedIssueStatuses[status]
                      ? (issuesByStatus[status] ?? []).map((issue) => (
                          <View
                            key={issue.id}
                            style={[
                              styles.issueItem,
                              issue.id === selectedIssueId ? styles.listItemSelected : null,
                            ]}
                          >
                            <View style={styles.issueItemMain}>
                              {quickEditIssueId === issue.id ? (
                                <View style={styles.stack}>
                                  <TextInput
                                    style={styles.input}
                                    value={quickEditTitle}
                                    onChangeText={setQuickEditTitle}
                                    placeholder="Issue title"
                                    placeholderTextColor="#94a3b8"
                                  />
                                  <TextInput
                                    style={styles.input}
                                    value={quickEditQualityScore}
                                    onChangeText={setQuickEditQualityScore}
                                    keyboardType="decimal-pad"
                                    placeholder="Quality score"
                                    placeholderTextColor="#94a3b8"
                                  />
                                  <View style={styles.chipWrap}>
                                    <Pressable
                                      style={[
                                        styles.chip,
                                        !quickEditAssigneeId ? styles.chipActive : null,
                                      ]}
                                      onPress={() => setQuickEditAssigneeId("")}
                                    >
                                      <Text
                                        style={[
                                          styles.chipText,
                                          !quickEditAssigneeId ? styles.chipTextActive : null,
                                        ]}
                                      >
                                        Unassigned
                                      </Text>
                                    </Pressable>
                                    {users.map((user) => (
                                      <Pressable
                                        key={`quick-edit-${issue.id}-${user.id}`}
                                        style={[
                                          styles.chip,
                                          quickEditAssigneeId === user.id ? styles.chipActive : null,
                                        ]}
                                        onPress={() => setQuickEditAssigneeId(user.id)}
                                      >
                                        <Text
                                          style={[
                                            styles.chipText,
                                            quickEditAssigneeId === user.id
                                              ? styles.chipTextActive
                                              : null,
                                          ]}
                                        >
                                          {user.name || user.email}
                                        </Text>
                                      </Pressable>
                                    ))}
                                  </View>
                                </View>
                              ) : (
                                <>
                                  <Pressable onPress={() => setSelectedIssueId(issue.id)}>
                                    <Text style={styles.listItemTitle}>{issue.title}</Text>
                                  </Pressable>
                                  <Text style={styles.listItemMeta}>
                                    Assignee:{" "}
                                    {issue.assignee?.name ?? issue.assignee?.email ?? "Unassigned"}
                                  </Text>
                                  <Text style={styles.listItemMeta}>
                                    Quality: {issue.qualityScore ?? "n/a"}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.badge,
                                      {
                                        color:
                                          colors.status[issue.status as keyof typeof colors.status] ??
                                          colors.textMuted,
                                      },
                                    ]}
                                  >
                                    {statusLabel(issue.status)}
                                  </Text>
                                </>
                              )}
                            </View>
                            <View style={styles.inlineRowWrap}>
                              {quickEditIssueId === issue.id ? (
                                <>
                                  <AppButton
                                    label={savingQuickEdit ? "Saving..." : "Save"}
                                    disabled={savingQuickEdit || !quickEditTitle.trim()}
                                    onPress={() => {
                                      handleSaveQuickEditIssue(issue.id).catch(() => {
                                        // handled
                                      });
                                    }}
                                  />
                                  <AppButton
                                    label="Cancel"
                                    variant="secondary"
                                    disabled={savingQuickEdit}
                                    onPress={handleCancelQuickEditIssue}
                                  />
                                </>
                              ) : (
                                <>
                                  <AppButton
                                    label="Quick Edit"
                                    variant="secondary"
                                    onPress={() => handleStartQuickEditIssue(issue)}
                                  />
                                  <AppButton
                                    label="Back"
                                    variant="secondary"
                                    disabled={issue.status === ISSUE_STATUSES[0]}
                                    onPress={() => {
                                      handleMoveIssue(issue, "backward").catch(() => {
                                        // handled
                                      });
                                    }}
                                  />
                                  <AppButton
                                    label="Forward"
                                    variant="secondary"
                                    disabled={
                                      issue.status ===
                                      ISSUE_STATUSES[ISSUE_STATUSES.length - 1]
                                    }
                                    onPress={() => {
                                      handleMoveIssue(issue, "forward").catch(() => {
                                        // handled
                                      });
                                    }}
                                  />
                                </>
                              )}
                            </View>
                          </View>
                        ))
                      : null}
                    {!(issuesByStatus[status] ?? []).length ? (
                      <Text style={styles.subtle}>No issues</Text>
                    ) : null}
                    {collapsedIssueStatuses[status] && (issuesByStatus[status] ?? []).length > 0 ? (
                      <Text style={styles.subtle}>Lane collapsed</Text>
                    ) : null}
                  </View>
                )}
              />
            </AppCard>

            <AppCard title="Issue Details">
              {selectedIssue ? (
                <View style={styles.stack}>
                  <View style={styles.issueMetaRow}>
                    <View style={styles.issueMetaPill}>
                      <Text style={styles.listItemMeta}>Key: {selectedIssue.key ?? "N/A"}</Text>
                    </View>
                    <View style={styles.issueMetaPill}>
                      <Text style={styles.listItemMeta}>Status: {statusLabel(selectedIssue.status)}</Text>
                    </View>
                    <View style={styles.issueMetaPill}>
                      <Text style={styles.listItemMeta}>
                        Assignee:{" "}
                        {selectedIssue.assignee?.name ??
                          selectedIssue.assignee?.email ??
                          "Unassigned"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Overview</Text>
                  <TextInput
                    style={styles.input}
                    value={issueEditTitle}
                    onChangeText={setIssueEditTitle}
                    placeholder="Issue title"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditDescription}
                    onChangeText={setIssueEditDescription}
                    placeholder="Issue description"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Specification</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditAcceptanceCriteria}
                    onChangeText={setIssueEditAcceptanceCriteria}
                    placeholder="Acceptance criteria"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditDatabase}
                    onChangeText={setIssueEditDatabase}
                    placeholder="Database notes"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditApi}
                    onChangeText={setIssueEditApi}
                    placeholder="API notes"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditTestCases}
                    onChangeText={setIssueEditTestCases}
                    placeholder="Test cases"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    value={issueEditAutomatedTest}
                    onChangeText={setIssueEditAutomatedTest}
                    placeholder="Automated tests"
                    placeholderTextColor="#94a3b8"
                    multiline
                  />
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Quality & Ownership</Text>
                  <TextInput
                    style={styles.input}
                    value={issueEditQualityScore}
                    onChangeText={setIssueEditQualityScore}
                    keyboardType="decimal-pad"
                    placeholder="Quality score (0-100)"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.sectionLabel}>Assignee</Text>
                  {usersLoading ? <ActivityIndicator /> : null}
                  {usersError ? <Text style={styles.errorText}>{usersError}</Text> : null}
                  <View style={styles.chipWrap}>
                    <Pressable
                      style={[styles.chip, !issueEditAssigneeId ? styles.chipActive : null]}
                      onPress={() => setIssueEditAssigneeId("")}
                    >
                      <Text style={[styles.chipText, !issueEditAssigneeId ? styles.chipTextActive : null]}>
                        Unassigned
                      </Text>
                    </Pressable>
                    {users.map((user) => (
                      <Pressable
                        key={user.id}
                        style={[styles.chip, issueEditAssigneeId === user.id ? styles.chipActive : null]}
                        onPress={() => setIssueEditAssigneeId(user.id)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            issueEditAssigneeId === user.id ? styles.chipTextActive : null,
                          ]}
                        >
                          {user.name || user.email}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.inlineRow}>
                    <AppButton
                      label={savingIssueEdit ? "Saving..." : "Save Issue"}
                      disabled={savingIssueEdit || !issueEditTitle.trim()}
                      onPress={() => {
                        handleSaveIssue().catch(() => {
                          // handled
                        });
                      }}
                    />
                    <AppButton
                      label={deletingIssue ? "Deleting..." : "Delete Issue"}
                      variant="secondary"
                      disabled={deletingIssue}
                      onPress={() => {
                        handleDeleteIssue().catch(() => {
                          // handled
                        });
                      }}
                    />
                  </View>
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Add Media</Text>
                    <View style={styles.inlineRowWrap}>
                      <AppButton
                        label={uploadingIssueAsset ? "Uploading..." : "Upload Screenshot"}
                        variant="secondary"
                        disabled={uploadingIssueAsset}
                        onPress={() => {
                          handleUploadScreenshot().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label={uploadingIssueAsset ? "Uploading..." : "Upload Recording"}
                        variant="secondary"
                        disabled={uploadingIssueAsset}
                        onPress={() => {
                          handleUploadRecording().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label={uploadingIssueAsset ? "Uploading..." : "Upload File"}
                        variant="secondary"
                        disabled={uploadingIssueAsset}
                        onPress={() => {
                          handleUploadFile().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label={uploadingIssueAsset ? "Uploading..." : "Capture Photo"}
                        variant="secondary"
                        disabled={uploadingIssueAsset}
                        onPress={() => {
                          handleCaptureScreenshot().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label={uploadingIssueAsset ? "Uploading..." : "Record Video"}
                        variant="secondary"
                        disabled={uploadingIssueAsset}
                        onPress={() => {
                          handleCaptureRecording().catch(() => {
                            // handled
                          });
                        }}
                      />
                    </View>
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Automated Tests</Text>
                    <View style={styles.inlineRowWrap}>
                      <AppButton
                        label={
                          runningIssueAutomatedTests
                            ? "Running all tests..."
                            : "Run All Automated Tests"
                        }
                        variant="secondary"
                        disabled={runningIssueAutomatedTests || !automatedTestNames.length}
                        onPress={() => {
                          handleRunAllIssueAutomatedTests().catch(() => {
                            // handled
                          });
                        }}
                      />
                    </View>
                    {automatedTestNames.length ? (
                      automatedTestNames.map((testName) => {
                        const result = uiTestResults[testName];
                        const running = runningUiTests[testName] === true;
                        return (
                          <View key={testName} style={styles.listItem}>
                            <Text style={styles.listItemTitle}>{testName}</Text>
                            <View style={styles.inlineRowWrap}>
                              <AppButton
                                label={running ? "Running..." : "Run Test"}
                                variant="secondary"
                                disabled={running || runningIssueAutomatedTests}
                                onPress={() => {
                                  handleRunAutomatedTest(testName).catch(() => {
                                    // handled
                                  });
                                }}
                              />
                              {result ? (
                                <Text
                                  style={[
                                    styles.listItemMeta,
                                    !result.success ? styles.errorText : null,
                                  ]}
                                >
                                  {result.success ? "Passed" : "Failed"} (exit: {result.exitCode ?? "n/a"})
                                </Text>
                              ) : null}
                            </View>
                            {result?.errorOutput ? (
                              <Text style={styles.errorText}>{result.errorOutput}</Text>
                            ) : null}
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.subtle}>
                        Add automated tests in the issue field above to run them.
                      </Text>
                    )}
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Comments</Text>
                    <View style={styles.inlineRow}>
                      <TextInput
                        style={styles.input}
                        value={newCommentBody}
                        onChangeText={setNewCommentBody}
                        placeholder="Add a comment"
                        placeholderTextColor="#94a3b8"
                      />
                      <AppButton
                        label={creatingComment ? "Posting..." : "Post"}
                        disabled={
                          creatingComment ||
                          (!newCommentBody.trim() && pendingCommentAttachments.length === 0)
                        }
                        onPress={() => {
                          handleCreateComment().catch(() => {
                            // handled
                          });
                        }}
                      />
                    </View>
                    <View style={styles.inlineRowWrap}>
                      <AppButton
                        label="Add Photo"
                        variant="secondary"
                        onPress={() => {
                          handleAddPendingCommentScreenshot().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label="Capture Photo"
                        variant="secondary"
                        onPress={() => {
                          handleCapturePendingCommentScreenshot().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label="Add Video"
                        variant="secondary"
                        onPress={() => {
                          handleAddPendingCommentVideo().catch(() => {
                            // handled
                          });
                        }}
                      />
                      <AppButton
                        label="Record Video"
                        variant="secondary"
                        onPress={() => {
                          handleCapturePendingCommentVideo().catch(() => {
                            // handled
                          });
                        }}
                      />
                      {pendingCommentAttachments.length ? (
                        <AppButton
                          label={`Clear (${pendingCommentAttachments.length})`}
                          variant="secondary"
                          onPress={() => setPendingCommentAttachments([])}
                        />
                      ) : null}
                    </View>
                    {pendingCommentAttachments.length ? (
                      <View style={styles.stack}>
                        {pendingCommentAttachments.map((attachment, index) => (
                          <View key={attachment.id} style={styles.pendingAttachmentChip}>
                            <View style={styles.flex}>
                              <Text style={styles.listItemMeta}>
                                {attachment.type === "screenshot" ? "Photo" : "Video"} #{index + 1}
                              </Text>
                              {attachment.type === "screenshot" ? (
                                <Image
                                  source={{ uri: pendingCommentAttachmentDataUri(attachment) }}
                                  style={styles.pendingAttachmentPreview}
                                  resizeMode="cover"
                                />
                              ) : null}
                            </View>
                            <AppButton
                              label="Open"
                              variant="secondary"
                              onPress={() => {
                                setPreviewTitle(
                                  attachment.type === "screenshot"
                                    ? "Pending comment photo"
                                    : "Pending comment video"
                                );
                                setPreviewUrl(pendingCommentAttachmentDataUri(attachment));
                              }}
                            />
                            <AppButton
                              label="Remove"
                              variant="secondary"
                              onPress={() => {
                                setPendingCommentAttachments((prev) =>
                                  prev.filter((item) => item.id !== attachment.id)
                                );
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {commentsLoading ? <ActivityIndicator /> : null}
                    {commentsError ? <Text style={styles.errorText}>{commentsError}</Text> : null}
                    {issueComments.map((comment) => (
                      <View key={comment.id} style={styles.stack}>
                        {editingCommentId === comment.id ? (
                          <View style={styles.commentItem}>
                            <View style={styles.flex}>
                              <TextInput
                                style={[styles.input, styles.multilineInput]}
                                value={commentEditBody}
                                onChangeText={setCommentEditBody}
                                placeholder="Comment"
                                placeholderTextColor="#94a3b8"
                                multiline
                              />
                              <View style={styles.inlineRowWrap}>
                                <AppButton label="Save" onPress={() => {
                                  handleSaveComment().catch(() => {
                                    // handled
                                  });
                                }} />
                                <AppButton
                                  label="Cancel"
                                  variant="secondary"
                                  onPress={() => {
                                    setEditingCommentId("");
                                    setCommentEditBody("");
                                  }}
                                />
                              </View>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.commentItem}>
                            <View style={styles.flex}>
                              <Text style={styles.listItemTitle}>{comment.body}</Text>
                              <Text style={styles.listItemMeta}>{comment.createdAt}</Text>
                            </View>
                            <View style={styles.inlineRowWrap}>
                              <AppButton
                                label="Edit"
                                variant="secondary"
                                onPress={() => {
                                  setEditingCommentId(comment.id);
                                  setCommentEditBody(comment.body);
                                }}
                              />
                              <AppButton
                                label={
                                  uploadingCommentAttachmentId === comment.id
                                    ? "Uploading..."
                                    : "Attach Photo"
                                }
                                variant="secondary"
                                disabled={uploadingCommentAttachmentId === comment.id}
                                onPress={() => {
                                  handleAttachCommentScreenshot(comment.id).catch(() => {
                                    // handled
                                  });
                                }}
                              />
                              <AppButton
                                label={
                                  uploadingCommentAttachmentId === comment.id
                                    ? "Uploading..."
                                    : "Attach Video"
                                }
                                variant="secondary"
                                disabled={uploadingCommentAttachmentId === comment.id}
                                onPress={() => {
                                  handleAttachCommentVideo(comment.id).catch(() => {
                                    // handled
                                  });
                                }}
                              />
                              <AppButton
                                label="Delete"
                                variant="secondary"
                                onPress={() => {
                                  handleDeleteComment(comment.id).catch(() => {
                                    // handled
                                  });
                                }}
                              />
                            </View>
                          </View>
                        )}
                        {(comment.attachments ?? []).map((attachment: CommentAttachment) => (
                          <View key={attachment.id} style={styles.commentAttachmentRow}>
                            <View style={styles.stackFill}>
                              <Text style={styles.listItemMeta}>
                                Attachment: {attachment.type} • {commentAttachmentLabel(attachment)}
                              </Text>
                              {attachment.type === "screenshot" ? (
                                <Pressable
                                  onPress={() => {
                                    const streamUrl = getCommentAttachmentStreamUrl(attachment);
                                    setPreviewTitle("Comment screenshot");
                                    setPreviewUrl(streamUrl);
                                  }}
                                >
                                  <Image
                                    source={{
                                      uri: getCommentAttachmentStreamUrl(attachment),
                                      headers: { Authorization: `Bearer ${token}` },
                                    }}
                                    style={styles.commentAttachmentPreview}
                                    resizeMode="cover"
                                  />
                                </Pressable>
                              ) : null}
                            </View>
                            <AppButton
                              label="Open"
                              variant="secondary"
                              onPress={() => {
                                const streamUrl = getCommentAttachmentStreamUrl(attachment);
                                setPreviewTitle(`Comment attachment (${attachment.type})`);
                                setPreviewUrl(streamUrl);
                              }}
                            />
                            <AppButton
                              label="Delete"
                              variant="secondary"
                              onPress={() => {
                                handleDeleteCommentAttachment(comment.id, attachment.id).catch(() => {
                                  // handled
                                });
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    ))}
                    {!commentsLoading && !issueComments.length ? (
                      <Text style={styles.subtle}>No comments yet.</Text>
                    ) : null}
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Screenshots</Text>
                    {(selectedIssue.screenshots ?? []).map((screenshot: IssueScreenshot) => (
                      <View key={screenshot.id} style={styles.stack}>
                        <Image
                          source={{
                            uri: getScreenshotStreamUrl(screenshot.imageUrl),
                            headers: { Authorization: `Bearer ${token}` },
                          }}
                          style={styles.screenshotPreview}
                          resizeMode="cover"
                        />
                        {editingScreenshotId === screenshot.id ? (
                          <View style={styles.inlineRowWrap}>
                            <TextInput
                              style={styles.input}
                              value={screenshotEditName}
                              onChangeText={setScreenshotEditName}
                              placeholder="Screenshot name"
                              placeholderTextColor="#94a3b8"
                            />
                            <AppButton label="Save" onPress={() => {
                              handleSaveScreenshotName().catch(() => {
                                // handled
                              });
                            }} />
                            <AppButton
                              label="Cancel"
                              variant="secondary"
                              onPress={() => {
                                setEditingScreenshotId("");
                                setScreenshotEditName("");
                              }}
                            />
                          </View>
                        ) : (
                          <View style={styles.inlineRowWrap}>
                            <Text style={styles.listItemMeta}>{screenshot.name ?? screenshot.imageUrl}</Text>
                            <AppButton
                              label="Edit Name"
                              variant="secondary"
                              onPress={() => {
                                setEditingScreenshotId(screenshot.id);
                                setScreenshotEditName(screenshot.name ?? "");
                              }}
                            />
                            <AppButton
                              label="Delete"
                              variant="secondary"
                              onPress={() => {
                                handleDeleteScreenshot(screenshot.id).catch(() => {
                                  // handled
                                });
                              }}
                            />
                          </View>
                        )}
                      </View>
                    ))}
                    {!(selectedIssue.screenshots ?? []).length ? (
                      <Text style={styles.subtle}>No screenshots attached.</Text>
                    ) : null}
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Recordings</Text>
                    {(selectedIssue.recordings ?? []).map((recording: IssueRecording) => (
                      <View key={recording.id} style={styles.listItem}>
                        <Text style={styles.listItemMeta}>
                          {recording.recordingType ?? recording.mediaType ?? "recording"} • {recording.createdAt}
                        </Text>
                        {editingRecordingId === recording.id ? (
                          <View style={styles.inlineRowWrap}>
                            <TextInput
                              style={styles.input}
                              value={recordingEditName}
                              onChangeText={setRecordingEditName}
                              placeholder="Recording name"
                              placeholderTextColor="#94a3b8"
                            />
                            <AppButton label="Save" onPress={() => {
                              handleSaveRecordingName().catch(() => {
                                // handled
                              });
                            }} />
                            <AppButton
                              label="Cancel"
                              variant="secondary"
                              onPress={() => {
                                setEditingRecordingId("");
                                setRecordingEditName("");
                              }}
                            />
                          </View>
                        ) : (
                          <View style={styles.inlineRowWrap}>
                            <Text style={styles.listItemTitle}>{recording.name ?? recording.videoUrl}</Text>
                            <AppButton
                              label="Edit Name"
                              variant="secondary"
                              onPress={() => {
                                setEditingRecordingId(recording.id);
                                setRecordingEditName(recording.name ?? "");
                              }}
                            />
                            <AppButton
                              label="Preview"
                              variant="secondary"
                              onPress={() => {
                                setPreviewTitle(recording.name ?? "Recording");
                                setPreviewUrl(getRecordingStreamUrl(recording.videoUrl));
                              }}
                            />
                            <AppButton
                              label="Delete"
                              variant="secondary"
                              onPress={() => {
                                handleDeleteRecording(recording.id).catch(() => {
                                  // handled
                                });
                              }}
                            />
                          </View>
                        )}
                      </View>
                    ))}
                    {!(selectedIssue.recordings ?? []).length ? (
                      <Text style={styles.subtle}>No recordings attached.</Text>
                    ) : null}
                  </View>
                  <View style={styles.issueDetailSection}>
                    <Text style={styles.sectionLabel}>Files</Text>
                    {(selectedIssue.files ?? []).map((file: IssueFile) => (
                      <View key={file.id} style={styles.listItem}>
                        {editingFileId === file.id ? (
                          <View style={styles.inlineRowWrap}>
                            <TextInput
                              style={styles.input}
                              value={fileEditName}
                              onChangeText={setFileEditName}
                              placeholder="File name"
                              placeholderTextColor="#94a3b8"
                            />
                            <AppButton label="Save" onPress={() => {
                              handleSaveFileName().catch(() => {
                                // handled
                              });
                            }} />
                            <AppButton
                              label="Cancel"
                              variant="secondary"
                              onPress={() => {
                                setEditingFileId("");
                                setFileEditName("");
                              }}
                            />
                          </View>
                        ) : (
                          <View style={styles.inlineRowWrap}>
                            <Text style={styles.listItemTitle}>{file.fileName}</Text>
                            <AppButton
                              label="Edit Name"
                              variant="secondary"
                              onPress={() => {
                                setEditingFileId(file.id);
                                setFileEditName(file.fileName);
                              }}
                            />
                            <AppButton
                              label="Open"
                              variant="secondary"
                              onPress={() => {
                                setPreviewTitle(file.fileName);
                                setPreviewUrl(getIssueFileStreamUrl(selectedIssue.id, file.id));
                              }}
                            />
                            <AppButton
                              label="Delete"
                              variant="secondary"
                              onPress={() => {
                                handleDeleteFile(file.id).catch(() => {
                                  // handled
                                });
                              }}
                            />
                          </View>
                        )}
                      </View>
                    ))}
                    {!(selectedIssue.files ?? []).length ? (
                      <Text style={styles.subtle}>No files attached.</Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Text style={styles.subtle}>Select an issue from the board to edit it.</Text>
              )}
            </AppCard>
          </View>
        ) : null}

        {activeTab === "expenses" ? (
          <View style={styles.stackFill}>
            <AppCard title="Create Expense">
              <View style={styles.stack}>
                <TextInput
                  style={styles.input}
                  value={createExpenseForm.description}
                  onChangeText={(value) =>
                    setCreateExpenseForm((current) => ({ ...current, description: value }))
                  }
                  placeholder="Description"
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.inlineRow}>
                  <TextInput
                    style={[styles.input, styles.flex]}
                    value={createExpenseForm.amount}
                    onChangeText={(value) =>
                      setCreateExpenseForm((current) => ({ ...current, amount: value }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="Amount"
                    placeholderTextColor="#94a3b8"
                  />
                  <TextInput
                    style={[styles.input, styles.flex]}
                    value={createExpenseForm.date}
                    onChangeText={(value) =>
                      setCreateExpenseForm((current) => ({ ...current, date: value }))
                    }
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <TextInput
                  style={styles.input}
                  value={createExpenseForm.category}
                  onChangeText={(value) =>
                    setCreateExpenseForm((current) => ({ ...current, category: value }))
                  }
                  placeholder="Category"
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.chipWrap}>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <Pressable
                      key={`create-expense-category-${category}`}
                      style={[
                        styles.chip,
                        createExpenseForm.category === category ? styles.chipActive : null,
                      ]}
                      onPress={() =>
                        setCreateExpenseForm((current) => ({ ...current, category }))
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          createExpenseForm.category === category ? styles.chipTextActive : null,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <AppButton
                  label={creatingExpense ? "Saving..." : "Save Expense"}
                  disabled={creatingExpense || !selectedProjectId}
                  onPress={() => {
                    handleCreateExpense().catch(() => {
                      // handled
                    });
                  }}
                />
              </View>
            </AppCard>

            <AppCard title={`Expenses ($${expensesTotal.toFixed(2)})`} style={styles.fillCard}>
              <View style={styles.stack}>
                <TextInput
                  style={styles.input}
                  value={expenseSearchQuery}
                  onChangeText={setExpenseSearchQuery}
                  placeholder="Search expenses"
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.chipWrap}>
                  <Pressable
                    style={[styles.chip, expenseCategoryFilter === "all" ? styles.chipActive : null]}
                    onPress={() => setExpenseCategoryFilter("all")}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        expenseCategoryFilter === "all" ? styles.chipTextActive : null,
                      ]}
                    >
                      All ({expenses.length})
                    </Text>
                  </Pressable>
                  {EXPENSE_CATEGORIES.map((category) => {
                    const count = expenses.filter((expense) => expense.category === category).length;
                    return (
                      <Pressable
                        key={`expense-filter-${category}`}
                        style={[
                          styles.chip,
                          expenseCategoryFilter === category ? styles.chipActive : null,
                        ]}
                        onPress={() => setExpenseCategoryFilter(category)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            expenseCategoryFilter === category ? styles.chipTextActive : null,
                          ]}
                        >
                          {category} ({count})
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {expensesLoading ? <ActivityIndicator /> : null}
              {expensesError ? <Text style={styles.errorText}>{expensesError}</Text> : null}
              <FlatList
                data={filteredExpenses}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => (
                  <View style={[styles.listItem, item.id === editingExpenseId ? styles.listItemSelected : null]}>
                    {item.id === editingExpenseId ? (
                      <View style={styles.stack}>
                        <TextInput
                          style={styles.input}
                          value={expenseEditDescription}
                          onChangeText={setExpenseEditDescription}
                          placeholder="Description"
                          placeholderTextColor="#94a3b8"
                        />
                        <TextInput
                          style={styles.input}
                          value={expenseEditAmount}
                          onChangeText={setExpenseEditAmount}
                          keyboardType="decimal-pad"
                          placeholder="Amount"
                          placeholderTextColor="#94a3b8"
                        />
                        <TextInput
                          style={styles.input}
                          value={expenseEditDate}
                          onChangeText={setExpenseEditDate}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor="#94a3b8"
                        />
                        <TextInput
                          style={styles.input}
                          value={expenseEditCategory}
                          onChangeText={setExpenseEditCategory}
                          placeholder="Category"
                          placeholderTextColor="#94a3b8"
                        />
                        <View style={styles.chipWrap}>
                          {EXPENSE_CATEGORIES.map((category) => (
                            <Pressable
                              key={`edit-expense-${item.id}-${category}`}
                              style={[
                                styles.chip,
                                expenseEditCategory === category ? styles.chipActive : null,
                              ]}
                              onPress={() => setExpenseEditCategory(category)}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  expenseEditCategory === category ? styles.chipTextActive : null,
                                ]}
                              >
                                {category}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.inlineRowWrap}>
                          <AppButton
                            label={savingExpenseEdit ? "Saving..." : "Save"}
                            disabled={savingExpenseEdit}
                            onPress={() => {
                              handleSaveExpenseEdit().catch(() => {
                                // handled
                              });
                            }}
                          />
                          <AppButton
                            label="Cancel"
                            variant="secondary"
                            onPress={() => {
                              setEditingExpenseId("");
                              setExpenseEditDescription("");
                              setExpenseEditAmount("");
                              setExpenseEditDate("");
                              setExpenseEditCategory("General");
                            }}
                          />
                          <AppButton
                            label={deletingExpenseId === item.id ? "Deleting..." : "Delete"}
                            variant="secondary"
                            disabled={deletingExpenseId === item.id}
                            onPress={() => {
                              handleDeleteExpense(item.id).catch(() => {
                                // handled
                              });
                            }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.stack}>
                        <Text style={styles.listItemTitle}>{item.description}</Text>
                        <Text style={styles.valueText}>${Number(item.amount).toFixed(2)}</Text>
                        <Text style={styles.listItemMeta}>
                          {item.category} • {item.date}
                        </Text>
                        <View style={styles.inlineRowWrap}>
                          <AppButton
                            label="Edit"
                            variant="secondary"
                            onPress={() => beginEditExpense(item)}
                          />
                          <AppButton
                            label={deletingExpenseId === item.id ? "Deleting..." : "Delete"}
                            variant="secondary"
                            disabled={deletingExpenseId === item.id}
                            onPress={() => {
                              handleDeleteExpense(item.id).catch(() => {
                                // handled
                              });
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.subtle}>
                    {expenseSearchQuery.trim() || expenseCategoryFilter !== "all"
                      ? "No matching expenses."
                      : "No expenses yet."}
                  </Text>
                }
              />
            </AppCard>
          </View>
        ) : null}

        {activeTab === "features" ? (
          <ChecklistSection
            title="Features"
            itemName={featureName}
            setItemName={setFeatureName}
            creating={creatingFeature}
            loading={featuresLoading}
            error={featuresError}
            items={features}
            selectedProjectId={selectedProjectId}
            editingId={editingChecklist?.kind === "features" ? editingChecklist.id : ""}
            editingName={editingChecklist?.kind === "features" ? editingChecklist.name : ""}
            setEditingName={(value) =>
              setEditingChecklist((current) =>
                current?.kind === "features" ? { ...current, name: value } : current
              )
            }
            onCreate={() => handleChecklistCreate("features")}
            onToggle={(item) => handleChecklistToggle("features", item)}
            onDelete={(item) => handleChecklistDelete("features", item)}
            onClearDone={() => {
              handleChecklistClearDone("features").catch(() => {
                // handled
              });
            }}
            onReorder={(item, direction) => handleChecklistReorder("features", item, direction)}
            onStartEdit={(item) => startChecklistEdit("features", item)}
            onSaveEdit={() => saveChecklistEdit("features")}
            onCancelEdit={cancelChecklistEdit}
          />
        ) : null}

        {activeTab === "todos" ? (
          <ChecklistSection
            title="Todos"
            itemName={todoName}
            setItemName={setTodoName}
            creating={creatingTodo}
            loading={todosLoading}
            error={todosError}
            items={todos}
            selectedProjectId={selectedProjectId}
            editingId={editingChecklist?.kind === "todos" ? editingChecklist.id : ""}
            editingName={editingChecklist?.kind === "todos" ? editingChecklist.name : ""}
            setEditingName={(value) =>
              setEditingChecklist((current) =>
                current?.kind === "todos" ? { ...current, name: value } : current
              )
            }
            onCreate={() => handleChecklistCreate("todos")}
            onToggle={(item) => handleChecklistToggle("todos", item)}
            onDelete={(item) => handleChecklistDelete("todos", item)}
            onClearDone={() => {
              handleChecklistClearDone("todos").catch(() => {
                // handled
              });
            }}
            onReorder={(item, direction) => handleChecklistReorder("todos", item, direction)}
            onStartEdit={(item) => startChecklistEdit("todos", item)}
            onSaveEdit={() => saveChecklistEdit("todos")}
            onCancelEdit={cancelChecklistEdit}
          />
        ) : null}

        {activeTab === "ideas" ? (
          <ChecklistSection
            title="Ideas"
            itemName={ideaName}
            setItemName={setIdeaName}
            creating={creatingIdea}
            loading={ideasLoading}
            error={ideasError}
            items={ideas}
            selectedProjectId={selectedProjectId}
            editingId={editingChecklist?.kind === "ideas" ? editingChecklist.id : ""}
            editingName={editingChecklist?.kind === "ideas" ? editingChecklist.name : ""}
            setEditingName={(value) =>
              setEditingChecklist((current) =>
                current?.kind === "ideas" ? { ...current, name: value } : current
              )
            }
            onCreate={() => handleChecklistCreate("ideas")}
            onToggle={(item) => handleChecklistToggle("ideas", item)}
            onDelete={(item) => handleChecklistDelete("ideas", item)}
            onClearDone={() => {
              handleChecklistClearDone("ideas").catch(() => {
                // handled
              });
            }}
            onReorder={(item, direction) => handleChecklistReorder("ideas", item, direction)}
            onStartEdit={(item) => startChecklistEdit("ideas", item)}
            onSaveEdit={() => saveChecklistEdit("ideas")}
            onCancelEdit={cancelChecklistEdit}
            assistant={{
              title: "Idea Assistant",
              chatsById: ideaAssistantChatById,
              draftsById: ideaAssistantDraftById,
              loadingById: ideaAssistantLoadingById,
              expandedById: ideaAssistantExpandedById,
              onToggle: (itemId) => {
                setIdeaAssistantExpandedById((current) => ({
                  ...current,
                  [itemId]: !current[itemId],
                }));
              },
              onDraftChange: (itemId, value) => {
                setIdeaAssistantDraftById((current) => ({ ...current, [itemId]: value }));
              },
              onSend: (item) => {
                handleIdeaAssistantSend(item).catch(() => {
                  // handled
                });
              },
            }}
          />
        ) : null}

        {activeTab === "bugs" ? (
          <ChecklistSection
            title="Bugs"
            itemName={bugName}
            setItemName={setBugName}
            creating={creatingBug}
            loading={bugsLoading}
            error={bugsError}
            items={bugs}
            selectedProjectId={selectedProjectId}
            editingId={editingChecklist?.kind === "bugs" ? editingChecklist.id : ""}
            editingName={editingChecklist?.kind === "bugs" ? editingChecklist.name : ""}
            setEditingName={(value) =>
              setEditingChecklist((current) =>
                current?.kind === "bugs" ? { ...current, name: value } : current
              )
            }
            onCreate={() => handleChecklistCreate("bugs")}
            onToggle={(item) => handleChecklistToggle("bugs", item)}
            onDelete={(item) => handleChecklistDelete("bugs", item)}
            onClearDone={() => {
              handleChecklistClearDone("bugs").catch(() => {
                // handled
              });
            }}
            onReorder={(item, direction) => handleChecklistReorder("bugs", item, direction)}
            onStartEdit={(item) => startChecklistEdit("bugs", item)}
            onSaveEdit={() => saveChecklistEdit("bugs")}
            onCancelEdit={cancelChecklistEdit}
          />
        ) : null}

        {activeTab === "enhancements" ? (
          <ChecklistSection
            title="Enhancements"
            itemName={enhancementName}
            setItemName={setEnhancementName}
            creating={creatingEnhancement}
            loading={enhancementsLoading}
            error={enhancementsError}
            items={enhancements}
            selectedProjectId={selectedProjectId}
            editingId={editingChecklist?.kind === "enhancements" ? editingChecklist.id : ""}
            editingName={editingChecklist?.kind === "enhancements" ? editingChecklist.name : ""}
            setEditingName={(value) =>
              setEditingChecklist((current) =>
                current?.kind === "enhancements" ? { ...current, name: value } : current
              )
            }
            onCreate={() => handleChecklistCreate("enhancements")}
            onToggle={(item) => handleChecklistToggle("enhancements", item)}
            onDelete={(item) => handleChecklistDelete("enhancements", item)}
            onClearDone={() => {
              handleChecklistClearDone("enhancements").catch(() => {
                // handled
              });
            }}
            onReorder={(item, direction) =>
              handleChecklistReorder("enhancements", item, direction)
            }
            onStartEdit={(item) => startChecklistEdit("enhancements", item)}
            onSaveEdit={() => saveChecklistEdit("enhancements")}
            onCancelEdit={cancelChecklistEdit}
          />
        ) : null}

        {activeTab === "tests" ? (
          <View style={styles.stackFill}>
            <AppCard title="Run UI Tests">
              <View style={styles.stack}>
                <View style={styles.issueMetaRow}>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Results: {uiTestResultEntries.length}</Text>
                  </View>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Passed: {uiTestPassCount}</Text>
                  </View>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Failed: {uiTestFailCount}</Text>
                  </View>
                </View>
                <TextInput
                  style={styles.input}
                  value={testUiPattern}
                  onChangeText={setTestUiPattern}
                  placeholder='grep pattern, e.g. "login"'
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.inlineRowWrap}>
                  {UI_TEST_PATTERNS.map((pattern) => (
                    <AppButton
                      key={pattern}
                      label={pattern}
                      variant="secondary"
                      onPress={() => setTestUiPattern(pattern)}
                    />
                  ))}
                  <AppButton
                    label="Clear"
                    variant="secondary"
                    onPress={() => setTestUiPattern("")}
                  />
                </View>
                <View style={styles.inlineRowWrap}>
                  <AppButton
                    label={uiTestsCatalogLoading ? "Refreshing UI tests..." : "Refresh UI Tests List"}
                    variant="secondary"
                    disabled={uiTestsCatalogLoading}
                    onPress={() => {
                      loadUiTestsCatalog().catch(() => {
                        // handled
                      });
                    }}
                  />
                  <AppButton
                    label={runningAllUiTests ? "Running all UI tests..." : "Run All UI Tests"}
                    variant="secondary"
                    disabled={uiTestsBusy || !discoveredUiTestNames.length}
                    onPress={() => {
                      handleRunAllDiscoveredUiTests().catch(() => {
                        // handled
                      });
                    }}
                  />
                  <AppButton
                    label="Clear UI Results"
                    variant="secondary"
                    disabled={uiTestsBusy && !uiTestResultEntries.length}
                    onPress={handleClearUiTestResults}
                  />
                </View>
                {uiTestsCatalogError ? <Text style={styles.errorText}>{uiTestsCatalogError}</Text> : null}
                {discoveredUiTestSuites.length ? (
                  <View style={styles.stack}>
                    {discoveredUiTestSuites.map((suite) => (
                      <View key={suite.key} style={styles.testSuitePanel}>
                        <View style={styles.inlineRowWrap}>
                          <Text style={styles.sectionLabel}>{suite.suiteName}</Text>
                          <AppButton
                            label={runningUiSuiteKey === suite.key ? "Running..." : "Run Suite"}
                            variant="secondary"
                            disabled={uiTestsBusy}
                            onPress={() => {
                              handleRunUiSuite(suite.key, suite.tests).catch(() => {
                                // handled
                              });
                            }}
                          />
                        </View>
                        <View style={styles.stack}>
                          {suite.tests.map((testName) => {
                            const result = uiTestResults[testName];
                            const running = runningUiTests[testName];
                            return (
                              <View key={`${suite.key}-${testName}`} style={styles.listItem}>
                                <Text style={styles.listItemTitle}>{testName}</Text>
                                <View style={styles.inlineRowWrap}>
                                  <AppButton
                                    label={running ? "Running..." : result ? "Run Again" : "Run"}
                                    variant="secondary"
                                    disabled={uiTestsBusy}
                                    onPress={() => {
                                      setTestUiPattern(testName);
                                      handleRunAutomatedTest(testName).catch(() => {
                                        // handled
                                      });
                                    }}
                                  />
                                  <AppButton
                                    label="Use Pattern"
                                    variant="secondary"
                                    onPress={() => setTestUiPattern(testName)}
                                  />
                                  {result ? (
                                    <Text style={result.success ? styles.subtle : styles.errorText}>
                                      {result.success ? "Passed" : "Failed"}
                                      {result.exitCode !== null ? ` (exit ${result.exitCode})` : ""}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.subtle}>
                    {uiTestsCatalogLoading ? "Loading discovered UI tests..." : "No discovered UI tests."}
                  </Text>
                )}
                <AppButton
                  label={runningTests.ui ? "Running UI tests..." : "Run UI Tests"}
                  disabled={uiTestsBusy || !testUiPattern.trim()}
                  onPress={() => {
                    handleRunUiTests().catch(() => {
                      // handled
                    });
                  }}
                />
                {latestUiTestResult ? (
                  <TestResultPanel
                    result={latestUiTestResult}
                    expanded={showFullUiOutput}
                    onToggleExpanded={() => setShowFullUiOutput((current) => !current)}
                  />
                ) : null}
              </View>
            </AppCard>

            <AppCard title="Run API Tests">
              <View style={styles.stack}>
                <View style={styles.issueMetaRow}>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Results: {apiTestResultEntries.length}</Text>
                  </View>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Passed: {apiTestPassCount}</Text>
                  </View>
                  <View style={styles.issueMetaPill}>
                    <Text style={styles.listItemMeta}>Failed: {apiTestFailCount}</Text>
                  </View>
                </View>
                <View style={styles.inlineRowWrap}>
                  <AppButton
                    label={runningAllApiTests ? "Running all API tests..." : "Run All API Tests"}
                    variant="secondary"
                    disabled={apiTestsBusy || !apiTestNames.length}
                    onPress={() => {
                      handleRunAllApiTests().catch(() => {
                        // handled
                      });
                    }}
                  />
                  <AppButton
                    label="Clear API Results"
                    variant="secondary"
                    disabled={apiTestsBusy && !apiTestResultEntries.length}
                    onPress={handleClearApiTestResults}
                  />
                </View>
                {API_TESTS.map((suite) => (
                  <View key={suite.suite} style={styles.testSuitePanel}>
                    <View style={styles.inlineRowWrap}>
                      <Text style={styles.sectionLabel}>{suite.suite}</Text>
                      <AppButton
                        label={runningApiSuiteKey === suite.suite ? "Running..." : "Run Suite"}
                        variant="secondary"
                        disabled={apiTestsBusy}
                        onPress={() => {
                          handleRunApiSuite(suite.suite, suite.tests).catch(() => {
                            // handled
                          });
                        }}
                      />
                    </View>
                    <View style={styles.stack}>
                      {suite.tests.map((testName) => {
                        const isRunning = runningApiTestName === testName;
                        const result = apiTestResultsByName[testName];
                        return (
                          <View key={testName} style={styles.listItem}>
                            <Text style={styles.listItemTitle}>{testName}</Text>
                            <View style={styles.inlineRowWrap}>
                              <AppButton
                                label={isRunning ? "Running..." : result ? "Run Again" : "Run"}
                                variant="secondary"
                                disabled={apiTestsBusy}
                                onPress={() => {
                                  handleRunSingleApiTest(testName).catch(() => {
                                    // handled
                                  });
                                }}
                              />
                              {result ? (
                                <Text style={result.success ? styles.subtle : styles.errorText}>
                                  {result.success ? "Passed" : "Failed"}
                                  {result.exitCode !== null ? ` (exit ${result.exitCode})` : ""}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
                <TextInput
                  style={styles.input}
                  value={testApiPattern}
                  onChangeText={setTestApiPattern}
                  placeholder='test name pattern, e.g. "issues"'
                  placeholderTextColor="#94a3b8"
                />
                <View style={styles.inlineRowWrap}>
                  {API_TEST_PATTERNS.map((pattern) => (
                    <AppButton
                      key={pattern}
                      label={pattern}
                      variant="secondary"
                      onPress={() => setTestApiPattern(pattern)}
                    />
                  ))}
                  <AppButton
                    label="Clear"
                    variant="secondary"
                    onPress={() => setTestApiPattern("")}
                  />
                </View>
                <AppButton
                  label={runningTests.api ? "Running API tests..." : "Run API Tests"}
                  disabled={apiTestsBusy || !testApiPattern.trim()}
                  onPress={() => {
                    handleRunApiTests().catch(() => {
                      // handled
                    });
                  }}
                />
                {latestApiTestResult ? (
                  <TestResultPanel
                    result={latestApiTestResult}
                    expanded={showFullApiOutput}
                    onToggleExpanded={() => setShowFullApiOutput((current) => !current)}
                  />
                ) : null}
              </View>
            </AppCard>
          </View>
        ) : null}

        {activeTab === "settings" ? (
          <View style={styles.stack}>
            <AppCard title="Workspace">
              <Text style={styles.body}>User ID: {readUserIdFromToken(token) || "unknown"}</Text>
              <Text style={styles.body}>Email: {readUserEmailFromToken(token) || "unknown"}</Text>
              <Text style={styles.body}>Current project: {selectedProject?.name ?? "none"}</Text>
            </AppCard>
            <AppCard title="Actions">
              <View style={styles.inlineRowWrap}>
                <AppButton
                  label="Open Web in Safari"
                  variant="secondary"
                  onPress={() => {
                    Linking.openURL(APP_WEB_URL).catch(() => {
                      Alert.alert("Unable to open Safari");
                    });
                  }}
                />
                <AppButton
                  label="Reload Projects"
                  variant="secondary"
                  onPress={() => {
                    loadProjects().catch(() => {
                      // handled
                    });
                  }}
                />
                <AppButton
                  label="Reload Issues"
                  variant="secondary"
                  onPress={() => {
                    loadIssues().catch(() => {
                      // handled
                    });
                  }}
                />
                <AppButton
                  label={clearingEnhancements ? "Clearing..." : "Clear Enhancements Cache"}
                  variant="secondary"
                  disabled={clearingEnhancements || !selectedProjectId}
                  onPress={() => {
                    clearEnhancementsForProject().catch(() => {
                      // handled
                    });
                  }}
                />
              </View>
            </AppCard>
          </View>
        ) : null}
      </View>

      <Modal visible={Boolean(previewUrl)} transparent animationType="slide">
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.topBar}>
              <Text style={styles.listItemTitle}>{previewTitle || "Preview"}</Text>
              <AppButton
                label="Close"
                variant="secondary"
                onPress={() => {
                  setPreviewUrl("");
                  setPreviewTitle("");
                }}
              />
            </View>
            {previewUrl ? (
              <WebView
                source={{
                  uri: previewUrl,
                  headers: { Authorization: `Bearer ${token}` },
                }}
                style={styles.previewWebView}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ProjectPicker({
  projects,
  selectedProjectId,
  onSelect,
  onRefresh,
  loading,
  error,
}: {
  projects: Project[];
  selectedProjectId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <AppCard title="Project Scope">
      <View style={styles.inlineRowWrap}>
        <AppButton label="Refresh Projects" variant="secondary" onPress={onRefresh} />
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {projects.length ? (
        <View style={styles.chipWrap}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              style={[styles.chip, project.id === selectedProjectId ? styles.chipActive : null]}
              onPress={() => onSelect(project.id)}
            >
              <Text style={[styles.chipText, project.id === selectedProjectId ? styles.chipTextActive : null]}>
                {project.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.subtle}>Create a project to continue.</Text>
      )}
    </AppCard>
  );
}

function ChecklistSection({
  title,
  itemName,
  setItemName,
  creating,
  loading,
  error,
  items,
  selectedProjectId,
  editingId,
  editingName,
  setEditingName,
  onCreate,
  onToggle,
  onDelete,
  onClearDone,
  onReorder,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  assistant,
}: {
  title: string;
  itemName: string;
  setItemName: (value: string) => void;
  creating: boolean;
  loading: boolean;
  error: string;
  items: ChecklistItem[];
  selectedProjectId: string;
  editingId: string;
  editingName: string;
  setEditingName: (value: string) => void;
  onCreate: () => void;
  onToggle: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
  onClearDone: () => void;
  onReorder: (item: ChecklistItem, direction: "up" | "down") => void;
  onStartEdit: (item: ChecklistItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  assistant?: {
    title: string;
    chatsById: Record<string, AssistantChatMessage[]>;
    draftsById: Record<string, string>;
    loadingById: Record<string, boolean>;
    expandedById: Record<string, boolean>;
    onToggle: (itemId: string) => void;
    onDraftChange: (itemId: string, value: string) => void;
    onSend: (item: ChecklistItem) => void;
  };
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "pending" | "done">("all");
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.order - b.order), [items]);
  const filteredItems = useMemo(
    () =>
      sortedItems.filter((item) => {
        if (visibilityFilter === "pending" && item.done) return false;
        if (visibilityFilter === "done" && !item.done) return false;
        if (!normalizedSearch) return true;
        return item.name.toLowerCase().includes(normalizedSearch);
      }),
    [normalizedSearch, sortedItems, visibilityFilter]
  );
  const pendingCount = sortedItems.filter((item) => !item.done).length;
  const doneCount = sortedItems.filter((item) => item.done).length;
  const canReorder = visibilityFilter === "all" && !searchQuery.trim();

  return (
    <View style={styles.stackFill}>
      <AppCard title={`Create ${title.slice(0, -1)}`}>
        <View style={styles.inlineRow}>
          <TextInput
            style={styles.input}
            value={itemName}
            onChangeText={setItemName}
            placeholder={`${title.slice(0, -1)} name`}
            placeholderTextColor="#94a3b8"
          />
          <AppButton
            label={creating ? "Adding..." : "Add"}
            disabled={creating || !itemName.trim() || !selectedProjectId}
            onPress={onCreate}
          />
        </View>
      </AppCard>

      <AppCard title={title} style={styles.fillCard}>
        <View style={styles.stack}>
          <TextInput
            style={styles.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${title.toLowerCase()}`}
            placeholderTextColor="#94a3b8"
          />
          <View style={styles.inlineRowWrap}>
            <Pressable
              style={[styles.chip, visibilityFilter === "all" ? styles.chipActive : null]}
              onPress={() => setVisibilityFilter("all")}
            >
              <Text
                style={[
                  styles.chipText,
                  visibilityFilter === "all" ? styles.chipTextActive : null,
                ]}
              >
                All ({sortedItems.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, visibilityFilter === "pending" ? styles.chipActive : null]}
              onPress={() => setVisibilityFilter("pending")}
            >
              <Text
                style={[
                  styles.chipText,
                  visibilityFilter === "pending" ? styles.chipTextActive : null,
                ]}
              >
                Pending ({pendingCount})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.chip, visibilityFilter === "done" ? styles.chipActive : null]}
              onPress={() => setVisibilityFilter("done")}
            >
              <Text
                style={[
                  styles.chipText,
                  visibilityFilter === "done" ? styles.chipTextActive : null,
                ]}
              >
                Done ({doneCount})
              </Text>
            </Pressable>
            <AppButton label="Clear Done" variant="secondary" disabled={!doneCount} onPress={onClearDone} />
          </View>
        </View>
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!canReorder ? (
          <Text style={styles.subtle}>Reorder is available only in All view with no search.</Text>
        ) : null}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item, index }) => (
            <View style={styles.checklistItem}>
              {editingId === item.id ? (
                <View style={styles.stack}>
                  <TextInput
                    style={styles.input}
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder={`${title.slice(0, -1)} name`}
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={styles.inlineRowWrap}>
                    <AppButton label="Save" onPress={onSaveEdit} />
                    <AppButton label="Cancel" variant="secondary" onPress={onCancelEdit} />
                    <AppButton label="Delete" variant="secondary" onPress={() => onDelete(item)} />
                  </View>
                </View>
              ) : (
                <>
                  <Pressable style={styles.checklistMain} onPress={() => onToggle(item)}>
                    <Text style={[styles.listItemTitle, item.done ? styles.doneText : null]}>
                      {item.name}
                    </Text>
                    <Text style={styles.listItemMeta}>{item.done ? "Done" : "Pending"}</Text>
                  </Pressable>
                  <View style={styles.inlineRowWrap}>
                    <AppButton
                      label="Edit"
                      variant="secondary"
                      onPress={() => onStartEdit(item)}
                    />
                    <AppButton
                      label="Up"
                      variant="secondary"
                      disabled={!canReorder || index === 0}
                      onPress={() => onReorder(item, "up")}
                    />
                    <AppButton
                      label="Down"
                      variant="secondary"
                      disabled={!canReorder || index === filteredItems.length - 1}
                      onPress={() => onReorder(item, "down")}
                    />
                    <AppButton
                      label="Delete"
                      variant="secondary"
                      onPress={() => onDelete(item)}
                    />
                    {assistant ? (
                      <AppButton
                        label={assistant.expandedById[item.id] ? "Hide AI" : "Ask AI"}
                        variant="secondary"
                        onPress={() => assistant.onToggle(item.id)}
                      />
                    ) : null}
                  </View>
                  {assistant && assistant.expandedById[item.id] ? (
                    <View style={styles.assistantPanel}>
                      <Text style={styles.sectionLabel}>{assistant.title}</Text>
                      {(assistant.chatsById[item.id] ?? []).length ? (
                        <View style={styles.stack}>
                          {(assistant.chatsById[item.id] ?? []).map((message) => (
                            <View key={message.id} style={styles.assistantMessage}>
                              <Text style={styles.listItemMeta}>
                                {message.role === "user" ? "You" : "Assistant"}
                              </Text>
                              <Text style={styles.body}>{message.text}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.subtle}>No messages yet.</Text>
                      )}
                      <TextInput
                        style={styles.input}
                        value={assistant.draftsById[item.id] ?? ""}
                        onChangeText={(value) => assistant.onDraftChange(item.id, value)}
                        placeholder="Ask the assistant for next steps"
                        placeholderTextColor="#94a3b8"
                        editable={!assistant.loadingById[item.id]}
                        multiline
                      />
                      <AppButton
                        label={assistant.loadingById[item.id] ? "Thinking..." : "Send"}
                        disabled={
                          assistant.loadingById[item.id] ||
                          !(assistant.draftsById[item.id] ?? "").trim()
                        }
                        onPress={() => assistant.onSend(item)}
                      />
                    </View>
                  ) : null}
                </>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.subtle}>
              {searchQuery.trim() || visibilityFilter !== "all" ? "No matching items." : "No items yet."}
            </Text>
          }
        />
      </AppCard>
    </View>
  );
}

function TestResultPanel({
  result,
  expanded,
  onToggleExpanded,
}: {
  result: TestExecutionResult;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const output = result.output?.trim() ?? "";
  const errorOutput = result.errorOutput?.trim() ?? "";
  const visibleOutput = expanded ? output : output.slice(0, 2500);
  const canExpand = output.length > 2500;

  return (
    <View style={styles.testResultPanel}>
      <Text style={result.success ? styles.subtle : styles.errorText}>
        {result.success ? "Passed" : "Failed"} (exit: {result.exitCode ?? "n/a"})
      </Text>
      {errorOutput ? <Text style={styles.errorText}>{errorOutput}</Text> : null}
      {output ? (
        <View style={styles.stack}>
          <Text style={styles.testOutputText}>{visibleOutput}</Text>
          {canExpand ? (
            <AppButton
              label={expanded ? "Show less output" : "Show full output"}
              variant="secondary"
              onPress={onToggleExpanded}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.bgCard,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brand: {
    color: colors.accentStrong,
    fontSize: 24,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  centeredFill: {
    alignItems: "center",
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center",
  },
  authContainer: {
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    color: colors.accentStrong,
    fontSize: 34,
    fontWeight: "700",
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  subtle: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
  },
  stack: {
    gap: spacing.sm,
  },
  stackFill: {
    flex: 1,
    gap: spacing.sm,
  },
  inlineRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  inlineRowWrap: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  spaceTop: {
    marginTop: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderInput,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  sectionLabel: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: "#f3f4f6",
    borderRadius: radii.small,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.accentStrong,
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  fillCard: {
    flex: 1,
    minHeight: 180,
  },
  listContainer: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  listItem: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  listItemSelected: {
    borderColor: colors.accent,
  },
  listItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  listItemMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  issueGroup: {
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  issueGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  issueGroupTitle: {
    color: colors.accentStrong,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  issueMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  issueMetaPill: {
    backgroundColor: "#eff6ff",
    borderColor: colors.border,
    borderRadius: radii.small,
    borderWidth: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
  },
  issueDetailSection: {
    backgroundColor: "#f8fafc",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  issueItem: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  commentItem: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  commentAttachmentRow: {
    alignItems: "flex-start",
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.small,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.xs,
  },
  commentAttachmentPreview: {
    borderColor: colors.border,
    borderRadius: radii.small,
    borderWidth: 1,
    height: 88,
    marginTop: spacing.xs,
    width: 140,
  },
  pendingAttachmentChip: {
    alignItems: "flex-start",
    backgroundColor: "#eef2ff",
    borderColor: colors.border,
    borderRadius: radii.small,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  pendingAttachmentPreview: {
    borderColor: colors.border,
    borderRadius: radii.small,
    borderWidth: 1,
    height: 70,
    marginTop: spacing.xs,
    width: 110,
  },
  testResultPanel: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  testSuitePanel: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  testOutputText: {
    color: colors.textMuted,
    fontFamily: "Menlo",
    fontSize: 11,
    lineHeight: 15,
  },
  screenshotPreview: {
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    height: 120,
    width: "100%",
  },
  issueItemMain: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
  },
  checklistItem: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  checklistMain: {
    flex: 1,
  },
  assistantPanel: {
    backgroundColor: "#f9fafb",
    borderColor: colors.border,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    width: "100%",
  },
  assistantMessage: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  doneText: {
    textDecorationLine: "line-through",
    opacity: 0.7,
  },
  bigValue: {
    color: colors.accentStrong,
    fontSize: 34,
    fontWeight: "700",
  },
  valueText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  previewOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  previewCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.card,
    flex: 1,
    maxHeight: "85%",
    overflow: "hidden",
    width: "100%",
  },
  previewWebView: {
    flex: 1,
  },
});
