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
import { useAppState } from "./src/hooks/useAppState";
import { IssueBoardColumn } from "./src/components/IssueBoardColumn";
import { ProjectPicker } from "./src/components/ProjectPicker";
import { TestResultPanel } from "./src/components/TestResultPanel";
import { UserChip } from "./src/components/UserChip";
import type { AuthProvider } from "./src/types";

export default function App() {
  const state = useAppState();
  const {
    initializing,
    token,
    setToken,
    authBypassEnabled,
    authInProgress,
    signOutInProgress,
    authErrorMessage,
    activeTab,
    setActiveTab,
    signOutNative,
    disableAuthBypass,
    enableAuthBypass,
    signIn,
    selectedProject,
    projects,
    projectsLoading,
    projectsError,
    selectedProjectId,
    setSelectedProjectId,
    loadProjects,
    createProjectName,
    setCreateProjectName,
    creatingProject,
    projectEditName,
    setProjectEditName,
    savingProjectEdit,
    deletingProject,
    handleCreateProject,
    handleUpdateProject,
    handleDeleteProject,
    issueSearch,
    setIssueSearch,
    loadIssues,
    newIssueTitle,
    setNewIssueTitle,
    newIssueDescription,
    setNewIssueDescription,
    newIssueAcceptanceCriteria,
    setNewIssueAcceptanceCriteria,
    newIssueDatabase,
    setNewIssueDatabase,
    newIssueApi,
    setNewIssueApi,
    newIssueTestCases,
    setNewIssueTestCases,
    newIssueAutomatedTest,
    setNewIssueAutomatedTest,
    newIssueQualityScore,
    setNewIssueQualityScore,
    newIssueAssigneeId,
    setNewIssueAssigneeId,
    usersLoading,
    usersError,
    users,
    creatingIssue,
    handleCreateIssue,
    clearingIssues,
    handleDeleteAllIssues,
    issues,
    issuesLoading,
    issuesError,
    filteredIssues,
    issuesByStatus,
    handleResetIssueBoardFilters,
    selectedIssueId,
    setSelectedIssueId,
    setCollapsedIssueStatuses,
    issueAssigneeFilter,
    setIssueAssigneeFilter,
    issueBoardFocus,
    setIssueBoardFocus,
    issueBoardStatuses,
    issueBoardKeyExtractor,
    renderIssueBoardColumn,
    selectedIssue,
    issueEditTitle,
    setIssueEditTitle,
    issueEditDescription,
    setIssueEditDescription,
    issueEditAcceptanceCriteria,
    setIssueEditAcceptanceCriteria,
    issueEditDatabase,
    setIssueEditDatabase,
    issueEditApi,
    setIssueEditApi,
    issueEditTestCases,
    setIssueEditTestCases,
    issueEditAutomatedTest,
    setIssueEditAutomatedTest,
    issueEditQualityScore,
    setIssueEditQualityScore,
    issueEditAssigneeId,
    setIssueEditAssigneeId,
    savingIssueEdit,
    deletingIssue,
    handleSaveIssue,
    handleDeleteIssue,
    uploadingIssueAsset,
    handleUploadScreenshot,
    handleUploadRecording,
    handleUploadFile,
    handleCaptureScreenshot,
    handleCaptureRecording,
    automatedTestNames,
    runningIssueAutomatedTests,
    runningUiTests,
    uiTestResults,
    handleRunAllIssueAutomatedTests,
    handleRunAutomatedTest,
    newCommentBody,
    setNewCommentBody,
    creatingComment,
    pendingCommentAttachments,
    setPendingCommentAttachments,
    handleCreateComment,
    handleAddPendingCommentScreenshot,
    handleCapturePendingCommentScreenshot,
    handleAddPendingCommentVideo,
    handleCapturePendingCommentVideo,
    issueComments,
    commentsLoading,
    commentsError,
    editingCommentId,
    commentEditBody,
    setCommentEditBody,
    setEditingCommentId,
    handleSaveComment,
    handleAttachCommentScreenshot,
    handleAttachCommentVideo,
    handleDeleteComment,
    handleDeleteCommentAttachment,
    uploadingCommentAttachmentId,
    editingScreenshotId,
    screenshotEditName,
    setScreenshotEditName,
    setEditingScreenshotId,
    handleSaveScreenshotName,
    handleDeleteScreenshot,
    editingRecordingId,
    recordingEditName,
    setRecordingEditName,
    setEditingRecordingId,
    handleSaveRecordingName,
    handleDeleteRecording,
    editingFileId,
    fileEditName,
    setFileEditName,
    setEditingFileId,
    handleSaveFileName,
    handleDeleteFile,
    createExpenseForm,
    setCreateExpenseForm,
    creatingExpense,
    handleCreateExpense,
    expensesTotal,
    expenseSearchQuery,
    setExpenseSearchQuery,
    expenseCategoryFilter,
    setExpenseCategoryFilter,
    expenses,
    expensesLoading,
    expensesError,
    filteredExpenses,
    editingExpenseId,
    expenseEditDescription,
    setExpenseEditDescription,
    expenseEditAmount,
    setExpenseEditAmount,
    expenseEditDate,
    setExpenseEditDate,
    expenseEditCategory,
    setExpenseEditCategory,
    savingExpenseEdit,
    handleSaveExpenseEdit,
    deletingExpenseId,
    beginEditExpense,
    handleDeleteExpense,
    isChecklistTab,
    checklistSectionPropsByKind,
    testUiPattern,
    setTestUiPattern,
    uiTestResultEntries,
    uiTestPassCount,
    uiTestFailCount,
    loadUiTestsCatalog,
    uiTestsCatalogLoading,
    handleRunAllDiscoveredUiTests,
    uiTestsBusy,
    discoveredUiTestNames,
    handleClearUiTestResults,
    uiTestsCatalogError,
    discoveredUiTestSuites,
    runningUiSuiteKey,
    handleRunUiSuite,
    handleRunUiTests,
    latestUiTestResult,
    showFullUiOutput,
    setShowFullUiOutput,
    apiTestResultEntries,
    apiTestPassCount,
    apiTestFailCount,
    handleRunAllApiTests,
    handleClearApiTestResults,
    runningApiSuiteKey,
    handleRunApiSuite,
    apiTestsBusy,
    runningApiTestName,
    apiTestResultsByName,
    handleRunSingleApiTest,
    testApiPattern,
    setTestApiPattern,
    handleRunApiTests,
    runningTests,
    latestApiTestResult,
    showFullApiOutput,
    setShowFullApiOutput,
    clearingEnhancements,
    clearEnhancementsForProject,
    previewUrl,
    setPreviewUrl,
    previewTitle,
    setPreviewTitle,
    setSignOutInProgress,
    features,
    todos,
    ideas,
    bugs,
    enhancements,
    setEditingExpenseId,
  } = state;

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
