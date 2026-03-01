import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
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
import { buildIdeaChatContext } from "@ideahome/shared-assistant";
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
import type {
  AppTab,
  AssistantChatMessage,
  ChecklistKind,
  PendingCommentAttachment,
  TestExecutionResult,
} from "./src/types";
import {
  ACTIVE_TAB_STORAGE_KEY,
  API_TEST_PATTERNS,
  APP_API_URL,
  APP_WEB_URL,
  AUTH_BYPASS_STORAGE_KEY,
  EXPENSE_CATEGORIES,
  SELECTED_PROJECT_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  UI_TEST_PATTERNS,
} from "./src/constants";
import {
  buildMobileAuthUrl,
  parseErrorFromRedirect,
  parseTokenFromRedirect,
  readUserEmailFromToken,
  readUserIdFromToken,
} from "./src/utils/auth";
import { forwardStatus, previousStatus, statusLabel } from "./src/utils/issueStatus";
import { fileNameFromUri, normalizeFilePath } from "./src/utils/files";
import {
  commentAttachmentLabel,
  getCommentAttachmentStreamUrl,
  pendingCommentAttachmentDataUri,
} from "./src/utils/commentAttachment";
import { enhancementsStorageKey } from "./src/utils/enhancementsStorage";
import { parseAutomatedTestNames } from "./src/utils/parseAutomatedTestNames";
import { isAppTab } from "./src/utils/isAppTab";
import { appStyles } from "./src/theme/appStyles";
import { HomeTab } from "./src/screens/HomeTab";
import { ProjectsTab } from "./src/screens/ProjectsTab";
import { ExpensesTab } from "./src/screens/ExpensesTab";
import { SettingsTab } from "./src/screens/SettingsTab";
import { TestsTab } from "./src/screens/TestsTab";
import { IssuesTab } from "./src/screens/IssuesTab";
import {
  ChecklistSection,
  type ChecklistSectionProps,
} from "./src/components/ChecklistSection";
import { IssueBoardColumn } from "./src/components/IssueBoardColumn";
import { ProjectPicker } from "./src/components/ProjectPicker";
import { TestResultPanel } from "./src/components/TestResultPanel";
import { UserChip } from "./src/components/UserChip";
import type { AuthProvider } from "./src/types";

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

  const issueBoardStatuses = useMemo(
    () =>
      ISSUE_STATUSES.filter(
        (status) => issueBoardFocus === "all" || issueBoardFocus === status
      ),
    [issueBoardFocus]
  );

  const issueBoardKeyExtractor = useCallback((status: string) => status, []);

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
            "Complete Google sign-in in Safari. If the app does not reopen automatically, tap the Open Idea Home App button in Safari."
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

  const renderIssueBoardColumn = useCallback(
    ({ item: status }: { item: string }) => (
      <IssueBoardColumn
        status={status}
        issues={issuesByStatus[status] ?? []}
        collapsed={!!collapsedIssueStatuses[status]}
        onToggleCollapse={() =>
          setCollapsedIssueStatuses((current) => ({
            ...current,
            [status]: !current[status],
          }))
        }
        selectedIssueId={selectedIssueId}
        quickEditIssueId={quickEditIssueId}
        quickEditTitle={quickEditTitle}
        quickEditQualityScore={quickEditQualityScore}
        quickEditAssigneeId={quickEditAssigneeId}
        users={users}
        savingQuickEdit={savingQuickEdit}
        onQuickEditTitleChange={setQuickEditTitle}
        onQuickEditQualityScoreChange={setQuickEditQualityScore}
        onQuickEditAssigneeChange={setQuickEditAssigneeId}
        onSelectIssue={setSelectedIssueId}
        onStartQuickEdit={handleStartQuickEditIssue}
        onCancelQuickEdit={handleCancelQuickEditIssue}
        onSaveQuickEdit={(issueId) =>
          handleSaveQuickEditIssue(issueId).catch(() => {})
        }
        onMoveIssue={(issue, direction) =>
          handleMoveIssue(issue, direction).catch(() => {})
        }
      />
    ),
    [
      issuesByStatus,
      collapsedIssueStatuses,
      selectedIssueId,
      quickEditIssueId,
      quickEditTitle,
      quickEditQualityScore,
      quickEditAssigneeId,
      users,
      savingQuickEdit,
      handleStartQuickEditIssue,
      handleCancelQuickEditIssue,
      handleSaveQuickEditIssue,
      handleMoveIssue,
    ]
  );

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

  const readBase64FromUri = useCallback(async (uri: string) => {
    const path = normalizeFilePath(uri);
    return RNFS.readFile(path, "base64");
  }, []);

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

  const handleIdeaAssistantSend = useCallback(
    async (idea: ChecklistItem) => {
      if (!token) return;
      const draft = (ideaAssistantDraftById[idea.id] ?? "").trim();
      if (!draft) return;
      if (ideaAssistantLoadingById[idea.id]) return;
      const prior = ideaAssistantChatById[idea.id] ?? [];
      const context = buildIdeaChatContext(prior, draft);
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

  const CHECKLIST_TABS: ChecklistKind[] = [
    "features",
    "todos",
    "ideas",
    "bugs",
    "enhancements",
  ];
  const isChecklistTab = (tab: AppTab): tab is ChecklistKind =>
    CHECKLIST_TABS.includes(tab as ChecklistKind);

  const checklistSectionPropsByKind = useMemo((): Record<
    ChecklistKind,
    ChecklistSectionProps
  > => {
    const base = (kind: ChecklistKind) => ({
      selectedProjectId,
      editingId: editingChecklist?.kind === kind ? editingChecklist.id : "",
      editingName: editingChecklist?.kind === kind ? editingChecklist.name : "",
      setEditingName: (value: string) =>
        setEditingChecklist((current) =>
          current?.kind === kind ? { ...current, name: value } : current
        ),
      onCreate: () => handleChecklistCreate(kind),
      onToggle: (item: ChecklistItem) => handleChecklistToggle(kind, item),
      onDelete: (item: ChecklistItem) => handleChecklistDelete(kind, item),
      onClearDone: () => {
        handleChecklistClearDone(kind).catch(() => {});
      },
      onReorder: (item: ChecklistItem, direction: "up" | "down") =>
        handleChecklistReorder(kind, item, direction),
      onStartEdit: (item: ChecklistItem) => startChecklistEdit(kind, item),
      onSaveEdit: () => saveChecklistEdit(kind),
      onCancelEdit: cancelChecklistEdit,
    });
    return {
      features: {
        title: "Features",
        itemName: featureName,
        setItemName: setFeatureName,
        creating: creatingFeature,
        loading: featuresLoading,
        error: featuresError,
        items: features,
        ...base("features"),
      },
      todos: {
        title: "Todos",
        itemName: todoName,
        setItemName: setTodoName,
        creating: creatingTodo,
        loading: todosLoading,
        error: todosError,
        items: todos,
        ...base("todos"),
      },
      ideas: {
        title: "Ideas",
        itemName: ideaName,
        setItemName: setIdeaName,
        creating: creatingIdea,
        loading: ideasLoading,
        error: ideasError,
        items: ideas,
        ...base("ideas"),
        assistant: {
          title: "Idea Assistant",
          chatsById: ideaAssistantChatById,
          draftsById: ideaAssistantDraftById,
          loadingById: ideaAssistantLoadingById,
          expandedById: ideaAssistantExpandedById,
          onToggle: (itemId: string) =>
            setIdeaAssistantExpandedById((current) => ({
              ...current,
              [itemId]: !current[itemId],
            })),
          onDraftChange: (itemId: string, value: string) =>
            setIdeaAssistantDraftById((current) => ({ ...current, [itemId]: value })),
          onSend: (item: ChecklistItem) => {
            handleIdeaAssistantSend(item).catch(() => {});
          },
        },
      },
      bugs: {
        title: "Bugs",
        itemName: bugName,
        setItemName: setBugName,
        creating: creatingBug,
        loading: bugsLoading,
        error: bugsError,
        items: bugs,
        ...base("bugs"),
      },
      enhancements: {
        title: "Enhancements",
        itemName: enhancementName,
        setItemName: setEnhancementName,
        creating: creatingEnhancement,
        loading: enhancementsLoading,
        error: enhancementsError,
        items: enhancements,
        ...base("enhancements"),
      },
    };
  }, [
    bugName,
    bugs,
    bugsLoading,
    bugsError,
    cancelChecklistEdit,
    creatingBug,
    creatingEnhancement,
    creatingFeature,
    creatingIdea,
    creatingTodo,
    editingChecklist,
    enhancementName,
    enhancements,
    enhancementsLoading,
    enhancementsError,
    featureName,
    features,
    featuresLoading,
    featuresError,
    handleChecklistClearDone,
    handleChecklistCreate,
    handleChecklistDelete,
    handleChecklistReorder,
    handleChecklistToggle,
    handleIdeaAssistantSend,
    ideaAssistantChatById,
    ideaAssistantDraftById,
    ideaAssistantExpandedById,
    ideaAssistantLoadingById,
    ideaName,
    ideas,
    ideasLoading,
    ideasError,
    selectedProjectId,
    saveChecklistEdit,
    setEditingChecklist,
    startChecklistEdit,
    todoName,
    todos,
    todosLoading,
    todosError,
  ]);

  if (initializing) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={appStyles.centeredFill}>
          <ActivityIndicator />
          <Text style={appStyles.subtle}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!token && !authBypassEnabled) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={appStyles.authContainer}>
          <Text style={appStyles.title}>Idea Home</Text>
          <Text style={appStyles.body}>Sign in with Google using secure native authentication.</Text>
          <AppButton
            label={authInProgress ? "Signing in..." : "Continue with Google"}
            disabled={authInProgress}
            onPress={() => {
              signIn("google").catch(() => {
                // handled in signIn
              });
            }}
          />
          <Text style={appStyles.subtle}>We use Safari for secure Google authentication.</Text>
          <AppButton
            label="Continue without login (testing)"
            variant="secondary"
            onPress={() => {
              enableAuthBypass().catch(() => {
                Alert.alert("Unable to enable test mode");
              });
            }}
          />
          {authErrorMessage ? <Text style={appStyles.errorText}>{authErrorMessage}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={appStyles.screen} edges={["top", "left", "right", "bottom"]}>
      <StatusBar barStyle="dark-content" />

      <View style={appStyles.topBar}>
        <Text style={appStyles.brand}>Idea Home</Text>
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

      <View style={appStyles.content}>
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
          <HomeTab
            projectCount={projects.length}
            selectedProjectName={selectedProject?.name ?? "No project selected"}
            issuesCount={issues.length}
            expensesTotal={expensesTotal}
            featuresCount={features.length}
            todosCount={todos.length}
            ideasCount={ideas.length}
            bugsCount={bugs.length}
            enhancementsCount={enhancements.length}
          />
        ) : null}

        {activeTab === "projects" ? (
          <ProjectsTab
            projects={projects}
            selectedProjectId={selectedProjectId}
            selectedProject={selectedProject}
            createProjectName={createProjectName}
            setCreateProjectName={setCreateProjectName}
            creatingProject={creatingProject}
            projectEditName={projectEditName}
            setProjectEditName={setProjectEditName}
            savingProjectEdit={savingProjectEdit}
            deletingProject={deletingProject}
            onSelectProject={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        ) : null}

        {activeTab === "issues" ? (
          <IssuesTab
            token={token}
            issueSearch={issueSearch}
            setIssueSearch={setIssueSearch}
            loadIssues={loadIssues}
            newIssueTitle={newIssueTitle}
            setNewIssueTitle={setNewIssueTitle}
            newIssueDescription={newIssueDescription}
            setNewIssueDescription={setNewIssueDescription}
            newIssueAcceptanceCriteria={newIssueAcceptanceCriteria}
            setNewIssueAcceptanceCriteria={setNewIssueAcceptanceCriteria}
            newIssueDatabase={newIssueDatabase}
            setNewIssueDatabase={setNewIssueDatabase}
            newIssueApi={newIssueApi}
            setNewIssueApi={setNewIssueApi}
            newIssueTestCases={newIssueTestCases}
            setNewIssueTestCases={setNewIssueTestCases}
            newIssueAutomatedTest={newIssueAutomatedTest}
            setNewIssueAutomatedTest={setNewIssueAutomatedTest}
            newIssueQualityScore={newIssueQualityScore}
            setNewIssueQualityScore={setNewIssueQualityScore}
            newIssueAssigneeId={newIssueAssigneeId}
            setNewIssueAssigneeId={setNewIssueAssigneeId}
            usersLoading={usersLoading}
            usersError={usersError}
            users={users}
            creatingIssue={creatingIssue}
            selectedProjectId={selectedProjectId}
            handleCreateIssue={handleCreateIssue}
            clearingIssues={clearingIssues}
            issues={issues}
            handleDeleteAllIssues={handleDeleteAllIssues}
            issuesLoading={issuesLoading}
            issuesError={issuesError}
            filteredIssues={filteredIssues}
            issuesByStatus={issuesByStatus}
            handleResetIssueBoardFilters={handleResetIssueBoardFilters}
            selectedIssueId={selectedIssueId}
            setSelectedIssueId={setSelectedIssueId}
            setCollapsedIssueStatuses={setCollapsedIssueStatuses}
            issueAssigneeFilter={issueAssigneeFilter}
            setIssueAssigneeFilter={setIssueAssigneeFilter}
            issueBoardFocus={issueBoardFocus}
            setIssueBoardFocus={setIssueBoardFocus}
            issueBoardStatuses={issueBoardStatuses}
            issueBoardKeyExtractor={issueBoardKeyExtractor}
            renderIssueBoardColumn={renderIssueBoardColumn}
            selectedIssue={selectedIssue}
            issueEditTitle={issueEditTitle}
            setIssueEditTitle={setIssueEditTitle}
            issueEditDescription={issueEditDescription}
            setIssueEditDescription={setIssueEditDescription}
            issueEditAcceptanceCriteria={issueEditAcceptanceCriteria}
            setIssueEditAcceptanceCriteria={setIssueEditAcceptanceCriteria}
            issueEditDatabase={issueEditDatabase}
            setIssueEditDatabase={setIssueEditDatabase}
            issueEditApi={issueEditApi}
            setIssueEditApi={setIssueEditApi}
            issueEditTestCases={issueEditTestCases}
            setIssueEditTestCases={setIssueEditTestCases}
            issueEditAutomatedTest={issueEditAutomatedTest}
            setIssueEditAutomatedTest={setIssueEditAutomatedTest}
            issueEditQualityScore={issueEditQualityScore}
            setIssueEditQualityScore={setIssueEditQualityScore}
            issueEditAssigneeId={issueEditAssigneeId}
            setIssueEditAssigneeId={setIssueEditAssigneeId}
            savingIssueEdit={savingIssueEdit}
            deletingIssue={deletingIssue}
            handleSaveIssue={handleSaveIssue}
            handleDeleteIssue={handleDeleteIssue}
            uploadingIssueAsset={uploadingIssueAsset}
            handleUploadScreenshot={handleUploadScreenshot}
            handleUploadRecording={handleUploadRecording}
            handleUploadFile={handleUploadFile}
            handleCaptureScreenshot={handleCaptureScreenshot}
            handleCaptureRecording={handleCaptureRecording}
            automatedTestNames={automatedTestNames}
            runningIssueAutomatedTests={runningIssueAutomatedTests}
            runningUiTests={runningUiTests}
            uiTestResults={uiTestResults}
            handleRunAllIssueAutomatedTests={handleRunAllIssueAutomatedTests}
            handleRunAutomatedTest={handleRunAutomatedTest}
            setPreviewTitle={setPreviewTitle}
            setPreviewUrl={setPreviewUrl}
            newCommentBody={newCommentBody}
            setNewCommentBody={setNewCommentBody}
            creatingComment={creatingComment}
            pendingCommentAttachments={pendingCommentAttachments}
            setPendingCommentAttachments={setPendingCommentAttachments}
            handleCreateComment={handleCreateComment}
            handleAddPendingCommentScreenshot={handleAddPendingCommentScreenshot}
            handleCapturePendingCommentScreenshot={handleCapturePendingCommentScreenshot}
            handleAddPendingCommentVideo={handleAddPendingCommentVideo}
            handleCapturePendingCommentVideo={handleCapturePendingCommentVideo}
            issueComments={issueComments}
            commentsLoading={commentsLoading}
            commentsError={commentsError}
            editingCommentId={editingCommentId}
            commentEditBody={commentEditBody}
            setCommentEditBody={setCommentEditBody}
            setEditingCommentId={setEditingCommentId}
            handleSaveComment={handleSaveComment}
            handleAttachCommentScreenshot={handleAttachCommentScreenshot}
            handleAttachCommentVideo={handleAttachCommentVideo}
            handleDeleteComment={handleDeleteComment}
            handleDeleteCommentAttachment={handleDeleteCommentAttachment}
            uploadingCommentAttachmentId={uploadingCommentAttachmentId}
            editingScreenshotId={editingScreenshotId}
            screenshotEditName={screenshotEditName}
            setScreenshotEditName={setScreenshotEditName}
            setEditingScreenshotId={setEditingScreenshotId}
            handleSaveScreenshotName={handleSaveScreenshotName}
            handleDeleteScreenshot={handleDeleteScreenshot}
            editingRecordingId={editingRecordingId}
            recordingEditName={recordingEditName}
            setRecordingEditName={setRecordingEditName}
            setEditingRecordingId={setEditingRecordingId}
            handleSaveRecordingName={handleSaveRecordingName}
            handleDeleteRecording={handleDeleteRecording}
            editingFileId={editingFileId}
            fileEditName={fileEditName}
            setFileEditName={setFileEditName}
            setEditingFileId={setEditingFileId}
            handleSaveFileName={handleSaveFileName}
            handleDeleteFile={handleDeleteFile}
          />
        ) : null}

        {activeTab === "expenses" ? (
          <ExpensesTab
            createExpenseForm={createExpenseForm}
            setCreateExpenseForm={setCreateExpenseForm}
            creatingExpense={creatingExpense}
            selectedProjectId={selectedProjectId}
            handleCreateExpense={handleCreateExpense}
            expensesTotal={expensesTotal}
            expenseSearchQuery={expenseSearchQuery}
            setExpenseSearchQuery={setExpenseSearchQuery}
            expenseCategoryFilter={expenseCategoryFilter}
            setExpenseCategoryFilter={setExpenseCategoryFilter}
            expenses={expenses}
            expensesLoading={expensesLoading}
            expensesError={expensesError}
            filteredExpenses={filteredExpenses}
            editingExpenseId={editingExpenseId}
            expenseEditDescription={expenseEditDescription}
            setExpenseEditDescription={setExpenseEditDescription}
            expenseEditAmount={expenseEditAmount}
            setExpenseEditAmount={setExpenseEditAmount}
            expenseEditDate={expenseEditDate}
            setExpenseEditDate={setExpenseEditDate}
            expenseEditCategory={expenseEditCategory}
            setExpenseEditCategory={setExpenseEditCategory}
            savingExpenseEdit={savingExpenseEdit}
            handleSaveExpenseEdit={handleSaveExpenseEdit}
            deletingExpenseId={deletingExpenseId}
            beginEditExpense={beginEditExpense}
            handleDeleteExpense={handleDeleteExpense}
            onCancelExpenseEdit={() => {
              setEditingExpenseId("");
              setExpenseEditDescription("");
              setExpenseEditAmount("");
              setExpenseEditDate("");
              setExpenseEditCategory("General");
            }}
          />
        ) : null}

        {isChecklistTab(activeTab) ? (
          <ChecklistSection {...checklistSectionPropsByKind[activeTab]} />
        ) : null}

        {activeTab === "tests" ? (
          <TestsTab
            testUiPattern={testUiPattern}
            setTestUiPattern={setTestUiPattern}
            uiTestResultEntries={uiTestResultEntries}
            uiTestPassCount={uiTestPassCount}
            uiTestFailCount={uiTestFailCount}
            loadUiTestsCatalog={loadUiTestsCatalog}
            uiTestsCatalogLoading={uiTestsCatalogLoading}
            handleRunAllDiscoveredUiTests={handleRunAllDiscoveredUiTests}
            uiTestsBusy={uiTestsBusy}
            discoveredUiTestNames={discoveredUiTestNames}
            handleClearUiTestResults={handleClearUiTestResults}
            uiTestsCatalogError={uiTestsCatalogError}
            discoveredUiTestSuites={discoveredUiTestSuites}
            runningUiSuiteKey={runningUiSuiteKey}
            handleRunUiSuite={handleRunUiSuite}
            runningUiTests={runningUiTests}
            uiTestResults={uiTestResults}
            handleRunAutomatedTest={handleRunAutomatedTest}
            handleRunUiTests={handleRunUiTests}
            latestUiTestResult={latestUiTestResult}
            showFullUiOutput={showFullUiOutput}
            setShowFullUiOutput={setShowFullUiOutput}
            apiTestResultEntries={apiTestResultEntries}
            apiTestPassCount={apiTestPassCount}
            apiTestFailCount={apiTestFailCount}
            handleRunAllApiTests={handleRunAllApiTests}
            handleClearApiTestResults={handleClearApiTestResults}
            runningApiSuiteKey={runningApiSuiteKey}
            handleRunApiSuite={handleRunApiSuite}
            apiTestsBusy={apiTestsBusy}
            runningApiTestName={runningApiTestName}
            apiTestResultsByName={apiTestResultsByName}
            handleRunSingleApiTest={handleRunSingleApiTest}
            testApiPattern={testApiPattern}
            setTestApiPattern={setTestApiPattern}
            handleRunApiTests={handleRunApiTests}
            runningTests={runningTests}
            latestApiTestResult={latestApiTestResult}
            showFullApiOutput={showFullApiOutput}
            setShowFullApiOutput={setShowFullApiOutput}
          />
        ) : null}

        {activeTab === "settings" ? (
          <SettingsTab
            token={token}
            selectedProject={selectedProject}
            loadProjects={loadProjects}
            loadIssues={loadIssues}
            clearingEnhancements={clearingEnhancements}
            selectedProjectId={selectedProjectId}
            clearEnhancementsForProject={clearEnhancementsForProject}
          />
        ) : null}
      </View>

      <Modal visible={Boolean(previewUrl)} transparent animationType="slide">
        <View style={appStyles.previewOverlay}>
          <View style={appStyles.previewCard}>
            <View style={appStyles.topBar}>
              <Text style={appStyles.listItemTitle}>{previewTitle || "Preview"}</Text>
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
                style={appStyles.previewWebView}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
