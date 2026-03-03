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
import { launchImageLibrary, launchCamera } from "react-native-image-picker";
import { Alert, Linking } from "react-native";
import {
  ISSUE_STATUSES,
  addCommentAttachment,
  createExpense,
  createIssueComment,
  createIssue,
  createProject,
  deleteCommentAttachment,
  deleteExpense,
  deleteIssueFile,
  deleteIssue,
  deleteIssueComment,
  deleteIssueRecording,
  deleteIssueScreenshot,
  deleteProject,
  deleteAllIssues,
  fetchExpenses,
  fetchIssueComments,
  fetchIssues,
  fetchProjects,
  fetchUsers,
  fetchUiTestsCatalog,
  runUiTest,
  runApiTest,
  uploadIssueFile,
  uploadIssueRecording,
  uploadIssueScreenshot,
  updateExpense,
  updateIssueFile,
  updateIssue,
  updateIssueComment,
  updateIssueRecording,
  updateIssueScreenshot,
  updateProject,
  updateIssueStatus,
  type Expense,
  type Issue,
  type IssueComment,
  type Project,
  type RunUiTestResult,
  type RunApiTestResult,
  type User,
  type UITestFile,
} from "../api/client";
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
import type { AppTab, AuthProvider, PendingCommentAttachment } from "../types";
import {
  ACTIVE_TAB_STORAGE_KEY,
  AUTH_BYPASS_STORAGE_KEY,
  SELECTED_PROJECT_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "../constants";
import {
  buildMobileAuthUrl,
  parseErrorFromRedirect,
  parseTokenFromRedirect,
  readUserIdFromToken,
} from "../utils/auth";
import { forwardStatus, previousStatus } from "../utils/issueStatus";
import { fileNameFromUri, normalizeFilePath } from "../utils/files";
import { parseAutomatedTestNames } from "../utils/parseAutomatedTestNames";
import { isAppTab } from "../utils/isAppTab";
import {
  addCustomList as addCustomListStorage,
  deleteCustomList as deleteCustomListStorage,
  getCustomListTabId,
  getCustomLists,
  type CustomList,
} from "../utils/customListsStorage";
import { appStyles } from "../theme/appStyles";
import { IssueBoardColumn } from "../components/IssueBoardColumn";
import { useChecklistState } from "./useChecklistState";
import { useTabOrder } from "./useTabOrder";

export function useAppState() {
  const [token, setToken] = useState("");
  const [authBypassEnabled, setAuthBypassEnabled] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState("");
  const [showAuthWebView, setShowAuthWebView] = useState(false);
  const [authUrlForWebView, setAuthUrlForWebView] = useState("");

  const [activeTab, setActiveTab] = useState<AppTab>("board");

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
  const [customLists, setCustomLists] = useState<CustomList[]>([]);

  const checklist = useChecklistState(token, selectedProjectId, activeTab);
  const {
    tabOrder,
    setTabOrder,
    hiddenTabIds,
    setHiddenTabIds,
    fullTabOrder,
    visibleTabOrder,
  } = useTabOrder(token, customLists, activeTab, setActiveTab);

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

  const loadCustomLists = useCallback(async () => {
    const userId = readUserIdFromToken(token);
    const lists = await getCustomLists(userId);
    setCustomLists(lists);
  }, [token]);

  const createCustomList = useCallback(
    async (name: string) => {
      const userId = readUserIdFromToken(token);
      const list = await addCustomListStorage(userId, name);
      await loadCustomLists();
      setActiveTab(getCustomListTabId(list.slug));
    },
    [token, loadCustomLists]
  );

  const deleteCustomListAndSwitch = useCallback(
    async (slug: string) => {
      const userId = readUserIdFromToken(token);
      await deleteCustomListStorage(userId, slug);
      await loadCustomLists();
      if (activeTab === getCustomListTabId(slug)) setActiveTab("board");
    },
    [token, activeTab, loadCustomLists]
  );

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
    loadCustomLists().catch(() => {});
  }, [loadCustomLists]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "board" || activeTab === "issues") loadIssues().catch(() => {});
    if (activeTab === "expenses") loadExpenses().catch(() => {});
  }, [activeTab, loadExpenses, loadIssues, token]);

  useEffect(() => {
    if (activeTab !== "tests") return;
    loadUiTestsCatalog().catch(() => {
      // handled in loadUiTestsCatalog
    });
  }, [activeTab, loadUiTestsCatalog]);

  useEffect(() => {
    setProjectEditName(selectedProject?.name ?? "");
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
    if (activeTab !== "board" && activeTab !== "issues") return;
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

  const onAuthSuccess = useCallback(async (nextToken: string) => {
    const normalizedToken = sanitizeAuthToken(nextToken);
    setToken(normalizedToken);
    setAuthErrorMessage("");
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken);
  }, []);

  const signOutNative = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setActiveTab("board");
    setProjects([]);
    setIssues([]);
    setUsers([]);
    setExpenses([]);
    checklist.clearChecklist();
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
  }, [checklist.clearChecklist]);

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

  const handleAuthRedirectFromWebView = useCallback(
    (url: string) => {
      handleAuthRedirectUrl(url).finally(() => setShowAuthWebView(false));
    },
    [handleAuthRedirectUrl]
  );

  const closeAuthWebView = useCallback(() => {
    setShowAuthWebView(false);
  }, []);

  const signIn = useCallback(
    async (provider: AuthProvider, options?: { inApp?: boolean; showContinueAlert?: boolean }) => {
      setAuthErrorMessage("");
      const useInApp = options?.inApp !== false;
      if (useInApp) {
        setAuthUrlForWebView(buildMobileAuthUrl(provider));
        setShowAuthWebView(true);
        setAuthInProgress(false);
        return;
      }
      setAuthInProgress(true);
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

  return {
    initializing, token, setToken, authBypassEnabled, authInProgress, signOutInProgress, authErrorMessage,
    showAuthWebView, authUrlForWebView, handleAuthRedirectFromWebView, closeAuthWebView,
    activeTab, setActiveTab, signOutNative, disableAuthBypass, enableAuthBypass, signIn,
    selectedProject, projects, projectsLoading, projectsError, selectedProjectId, setSelectedProjectId,
    loadProjects, createProjectName, setCreateProjectName, creatingProject, projectEditName, setProjectEditName,
    savingProjectEdit, deletingProject, handleCreateProject, handleUpdateProject, handleDeleteProject,
    issueSearch, setIssueSearch, loadIssues, newIssueTitle, setNewIssueTitle, newIssueDescription, setNewIssueDescription,
    newIssueAcceptanceCriteria, setNewIssueAcceptanceCriteria, newIssueDatabase, setNewIssueDatabase, newIssueApi, setNewIssueApi,
    newIssueTestCases, setNewIssueTestCases, newIssueAutomatedTest, setNewIssueAutomatedTest, newIssueQualityScore, setNewIssueQualityScore,
    newIssueAssigneeId, setNewIssueAssigneeId, usersLoading, usersError, users, creatingIssue, handleCreateIssue,
    clearingIssues, handleDeleteAllIssues, issues, issuesLoading, issuesError, filteredIssues, issuesByStatus,
    handleResetIssueBoardFilters, selectedIssueId, setSelectedIssueId, setCollapsedIssueStatuses, issueAssigneeFilter, setIssueAssigneeFilter,
    issueBoardFocus, setIssueBoardFocus, issueBoardStatuses, issueBoardKeyExtractor, renderIssueBoardColumn, selectedIssue,
    issueEditTitle, setIssueEditTitle, issueEditDescription, setIssueEditDescription, issueEditAcceptanceCriteria, setIssueEditAcceptanceCriteria,
    issueEditDatabase, setIssueEditDatabase, issueEditApi, setIssueEditApi, issueEditTestCases, setIssueEditTestCases,
    issueEditAutomatedTest, setIssueEditAutomatedTest, issueEditQualityScore, setIssueEditQualityScore, issueEditAssigneeId, setIssueEditAssigneeId,
    savingIssueEdit, deletingIssue, handleSaveIssue, handleDeleteIssue, uploadingIssueAsset, handleUploadScreenshot, handleUploadRecording,
    handleUploadFile, handleCaptureScreenshot, handleCaptureRecording, automatedTestNames, runningIssueAutomatedTests,
    runningUiTests, uiTestResults, handleRunAllIssueAutomatedTests, handleRunAutomatedTest,
    newCommentBody, setNewCommentBody, creatingComment, pendingCommentAttachments, setPendingCommentAttachments,
    handleCreateComment, handleAddPendingCommentScreenshot, handleCapturePendingCommentScreenshot, handleAddPendingCommentVideo, handleCapturePendingCommentVideo,
    issueComments, commentsLoading, commentsError, editingCommentId, commentEditBody, setCommentEditBody, setEditingCommentId,
    handleSaveComment, handleAttachCommentScreenshot, handleAttachCommentVideo, handleDeleteComment, handleDeleteCommentAttachment,
    uploadingCommentAttachmentId, editingScreenshotId, screenshotEditName, setScreenshotEditName, setEditingScreenshotId,
    handleSaveScreenshotName, handleDeleteScreenshot, editingRecordingId, recordingEditName, setRecordingEditName, setEditingRecordingId,
    handleSaveRecordingName, handleDeleteRecording, editingFileId, fileEditName, setFileEditName, setEditingFileId, handleSaveFileName, handleDeleteFile,
    createExpenseForm, setCreateExpenseForm, creatingExpense, handleCreateExpense, expensesTotal, expenseSearchQuery, setExpenseSearchQuery,
    expenseCategoryFilter, setExpenseCategoryFilter, expenses, expensesLoading, expensesError, filteredExpenses,
    editingExpenseId, expenseEditDescription, setExpenseEditDescription, expenseEditAmount, setExpenseEditAmount,
    expenseEditDate, setExpenseEditDate, expenseEditCategory, setExpenseEditCategory, savingExpenseEdit, handleSaveExpenseEdit,
    deletingExpenseId, beginEditExpense, handleDeleteExpense,
    ...checklist,
    testUiPattern, setTestUiPattern, uiTestResultEntries, uiTestPassCount, uiTestFailCount, loadUiTestsCatalog, uiTestsCatalogLoading,
    handleRunAllDiscoveredUiTests, uiTestsBusy, discoveredUiTestNames, handleClearUiTestResults, uiTestsCatalogError,
    discoveredUiTestSuites, runningUiSuiteKey, handleRunUiSuite, handleRunUiTests, latestUiTestResult, showFullUiOutput, setShowFullUiOutput,
    apiTestResultEntries, apiTestPassCount, apiTestFailCount, handleRunAllApiTests, handleClearApiTestResults,
    runningApiSuiteKey, handleRunApiSuite, apiTestsBusy, runningApiTestName, apiTestResultsByName, handleRunSingleApiTest,
    testApiPattern, setTestApiPattern, handleRunApiTests, runningTests, latestApiTestResult, showFullApiOutput, setShowFullApiOutput,
    previewUrl, setPreviewUrl, previewTitle, setPreviewTitle, setSignOutInProgress, setEditingExpenseId,
    customLists, loadCustomLists, createCustomList, deleteCustomListAndSwitch,
    tabOrder, setTabOrder, hiddenTabIds, setHiddenTabIds, visibleTabOrder, fullTabOrder,
  };
}

export type AppState = ReturnType<typeof useAppState>;

