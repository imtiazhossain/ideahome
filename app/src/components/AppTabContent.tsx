import React from "react";
import { View } from "react-native";
import { BoardTab } from "../screens/BoardTab";
import { HomeTab } from "../screens/HomeTab";
import { ProjectsTab } from "../screens/ProjectsTab";
import { IssuesTab } from "../screens/IssuesTab";
import { ExpensesTab } from "../screens/ExpensesTab";
import { TestsTab } from "../screens/TestsTab";
import { SettingsTab } from "../screens/SettingsTab";
import { ComingSoonTab } from "../screens/ComingSoonTab";
import { CustomListTab } from "../screens/CustomListTab";
import { ChecklistSection } from "./ChecklistSection";
import { buildIssuesTabProps } from "../utils/buildIssuesTabProps";
import { readUserIdFromToken } from "../utils/auth";
import { isCustomListTab } from "../utils/isAppTab";
import type { useAppState } from "../hooks/useAppState";

type AppState = ReturnType<typeof useAppState>;

type AppTabContentProps = {
  state: AppState;
  customList: AppState["customLists"][number] | undefined;
  customListItemsState: {
    items: { id: string; name: string; done: boolean; order: number }[];
    loading: boolean;
    addItem: (name: string) => void;
    toggleDone: (id: string) => void;
    removeItem: (id: string) => void;
    updateItemName: (id: string, name: string) => void;
    reorder: (ids: string[]) => void;
  };
  deleteCustomListAndSwitch: (slug: string) => void;
  onOpenTabPrefs: () => void;
};

export function AppTabContent({
  state,
  customList,
  customListItemsState,
  deleteCustomListAndSwitch,
  onOpenTabPrefs,
}: AppTabContentProps) {
  const { activeTab } = state;
  const customListUserId = readUserIdFromToken(state.token);

  return (
    <>
      {activeTab === "board" ? (
        <BoardTab
          issuesByStatus={state.issuesByStatus}
          issueBoardStatuses={state.issueBoardStatuses}
          issueBoardKeyExtractor={state.issueBoardKeyExtractor}
          renderIssueBoardColumn={state.renderIssueBoardColumn}
          issueBoardFocus={state.issueBoardFocus}
          setIssueBoardFocus={state.setIssueBoardFocus}
          issueAssigneeFilter={state.issueAssigneeFilter}
          setIssueAssigneeFilter={state.setIssueAssigneeFilter}
          users={state.users}
          selectedIssue={state.selectedIssue}
          selectedIssueId={state.selectedIssueId}
          setSelectedIssueId={state.setSelectedIssueId}
          issueEditTitle={state.issueEditTitle}
          setIssueEditTitle={state.setIssueEditTitle}
          issueEditDescription={state.issueEditDescription}
          setIssueEditDescription={state.setIssueEditDescription}
          issueEditAcceptanceCriteria={state.issueEditAcceptanceCriteria}
          setIssueEditAcceptanceCriteria={state.setIssueEditAcceptanceCriteria}
          issueEditDatabase={state.issueEditDatabase}
          setIssueEditDatabase={state.setIssueEditDatabase}
          issueEditApi={state.issueEditApi}
          setIssueEditApi={state.setIssueEditApi}
          issueEditTestCases={state.issueEditTestCases}
          setIssueEditTestCases={state.setIssueEditTestCases}
          issueEditAutomatedTest={state.issueEditAutomatedTest}
          setIssueEditAutomatedTest={state.setIssueEditAutomatedTest}
          issueEditQualityScore={state.issueEditQualityScore}
          setIssueEditQualityScore={state.setIssueEditQualityScore}
          issueEditAssigneeId={state.issueEditAssigneeId}
          setIssueEditAssigneeId={state.setIssueEditAssigneeId}
          savingIssueEdit={state.savingIssueEdit}
          deletingIssue={state.deletingIssue}
          handleSaveIssue={state.handleSaveIssue}
          handleDeleteIssue={state.handleDeleteIssue}
          usersLoading={state.usersLoading}
          usersError={state.usersError}
          uploadingIssueAsset={state.uploadingIssueAsset}
          handleUploadScreenshot={state.handleUploadScreenshot}
          handleUploadRecording={state.handleUploadRecording}
          handleUploadFile={state.handleUploadFile}
          handleCaptureScreenshot={state.handleCaptureScreenshot}
          handleCaptureRecording={state.handleCaptureRecording}
          automatedTestNames={state.automatedTestNames}
          runningIssueAutomatedTests={state.runningIssueAutomatedTests}
          runningUiTests={state.runningUiTests}
          uiTestResults={state.uiTestResults}
          handleRunAllIssueAutomatedTests={state.handleRunAllIssueAutomatedTests}
          handleRunAutomatedTest={state.handleRunAutomatedTest}
        />
      ) : null}

      {activeTab === "home" ? (
        <HomeTab
          projectCount={state.projects.length}
          selectedProjectName={state.selectedProject?.name ?? "No project selected"}
          issuesCount={state.issues.length}
          expensesTotal={state.expensesTotal}
          featuresCount={state.features.length}
          todosCount={state.todos.length}
          ideasCount={state.ideas.length}
          bugsCount={state.bugs.length}
          enhancementsCount={state.enhancements.length}
        />
      ) : null}

      {activeTab === "projects" ? (
        <ProjectsTab
          projects={state.projects}
          selectedProjectId={state.selectedProjectId}
          selectedProject={state.selectedProject}
          createProjectName={state.createProjectName}
          setCreateProjectName={state.setCreateProjectName}
          creatingProject={state.creatingProject}
          projectEditName={state.projectEditName}
          setProjectEditName={state.setProjectEditName}
          savingProjectEdit={state.savingProjectEdit}
          deletingProject={state.deletingProject}
          onSelectProject={state.setSelectedProjectId}
          onCreateProject={state.handleCreateProject}
          onUpdateProject={state.handleUpdateProject}
          onDeleteProject={state.handleDeleteProject}
        />
      ) : null}

      {activeTab === "issues" ? (
        <IssuesTab {...buildIssuesTabProps(state)} />
      ) : null}

      {activeTab === "expenses" ? (
        <ExpensesTab
          createExpenseForm={state.createExpenseForm}
          setCreateExpenseForm={state.setCreateExpenseForm}
          creatingExpense={state.creatingExpense}
          selectedProjectId={state.selectedProjectId}
          handleCreateExpense={state.handleCreateExpense}
          expensesTotal={state.expensesTotal}
          expenseSearchQuery={state.expenseSearchQuery}
          setExpenseSearchQuery={state.setExpenseSearchQuery}
          expenseCategoryFilter={state.expenseCategoryFilter}
          setExpenseCategoryFilter={state.setExpenseCategoryFilter}
          expenses={state.expenses}
          expensesLoading={state.expensesLoading}
          expensesError={state.expensesError}
          filteredExpenses={state.filteredExpenses}
          editingExpenseId={state.editingExpenseId}
          expenseEditDescription={state.expenseEditDescription}
          setExpenseEditDescription={state.setExpenseEditDescription}
          expenseEditAmount={state.expenseEditAmount}
          setExpenseEditAmount={state.setExpenseEditAmount}
          expenseEditDate={state.expenseEditDate}
          setExpenseEditDate={state.setExpenseEditDate}
          expenseEditCategory={state.expenseEditCategory}
          setExpenseEditCategory={state.setExpenseEditCategory}
          savingExpenseEdit={state.savingExpenseEdit}
          handleSaveExpenseEdit={state.handleSaveExpenseEdit}
          deletingExpenseId={state.deletingExpenseId}
          beginEditExpense={state.beginEditExpense}
          handleDeleteExpense={state.handleDeleteExpense}
          onCancelExpenseEdit={() => {
            state.setEditingExpenseId("");
            state.setExpenseEditDescription("");
            state.setExpenseEditAmount("");
            state.setExpenseEditDate("");
            state.setExpenseEditCategory("General");
          }}
        />
      ) : null}

      {state.isChecklistTab(activeTab) ? (
        <ChecklistSection {...state.checklistSectionPropsByKind[activeTab]} />
      ) : null}

      {activeTab === "timeline" ? <ComingSoonTab title="Timeline" /> : null}
      {activeTab === "calendar" ? <ComingSoonTab title="Calendar" /> : null}
      {activeTab === "goals" ? <ComingSoonTab title="Goals" /> : null}
      {activeTab === "pages" ? <ComingSoonTab title="Pages" /> : null}
      {activeTab === "development" ? (
        <ComingSoonTab title="Code Health" />
      ) : null}

      {isCustomListTab(activeTab) && customList ? (
        <CustomListTab
          listName={customList.name}
          slug={customList.slug}
          userId={customListUserId}
          onDeleteList={() => deleteCustomListAndSwitch(customList.slug)}
          items={customListItemsState.items}
          loading={customListItemsState.loading}
          addItem={customListItemsState.addItem}
          toggleDone={customListItemsState.toggleDone}
          removeItem={customListItemsState.removeItem}
          updateItemName={customListItemsState.updateItemName}
          reorder={customListItemsState.reorder}
        />
      ) : null}

      {activeTab === "settings" ? (
        <SettingsTab
          token={state.token}
          selectedProject={state.selectedProject}
          loadProjects={state.loadProjects}
          loadIssues={state.loadIssues}
          clearingEnhancements={state.clearingEnhancements}
          selectedProjectId={state.selectedProjectId}
          clearEnhancementsForProject={state.clearEnhancementsForProject}
          onCreateCustomList={state.createCustomList}
          onOpenTabPrefs={onOpenTabPrefs}
        />
      ) : null}

      {activeTab === "tests" ? (
        <TestsTab
          testUiPattern={state.testUiPattern}
          setTestUiPattern={state.setTestUiPattern}
          uiTestResultEntries={state.uiTestResultEntries}
          uiTestPassCount={state.uiTestPassCount}
          uiTestFailCount={state.uiTestFailCount}
          loadUiTestsCatalog={state.loadUiTestsCatalog}
          uiTestsCatalogLoading={state.uiTestsCatalogLoading}
          handleRunAllDiscoveredUiTests={state.handleRunAllDiscoveredUiTests}
          uiTestsBusy={state.uiTestsBusy}
          discoveredUiTestNames={state.discoveredUiTestNames}
          handleClearUiTestResults={state.handleClearUiTestResults}
          uiTestsCatalogError={state.uiTestsCatalogError}
          discoveredUiTestSuites={state.discoveredUiTestSuites}
          runningUiSuiteKey={state.runningUiSuiteKey}
          handleRunUiSuite={state.handleRunUiSuite}
          runningUiTests={state.runningUiTests}
          uiTestResults={state.uiTestResults}
          handleRunUiTests={state.handleRunUiTests}
          handleRunAutomatedTest={state.handleRunAutomatedTest}
          latestUiTestResult={state.latestUiTestResult}
          showFullUiOutput={state.showFullUiOutput}
          setShowFullUiOutput={state.setShowFullUiOutput}
          apiTestResultEntries={state.apiTestResultEntries}
          apiTestPassCount={state.apiTestPassCount}
          apiTestFailCount={state.apiTestFailCount}
          handleRunAllApiTests={state.handleRunAllApiTests}
          handleClearApiTestResults={state.handleClearApiTestResults}
          runningApiSuiteKey={state.runningApiSuiteKey}
          handleRunApiSuite={state.handleRunApiSuite}
          apiTestsBusy={state.apiTestsBusy}
          runningApiTestName={state.runningApiTestName}
          apiTestResultsByName={state.apiTestResultsByName}
          handleRunSingleApiTest={state.handleRunSingleApiTest}
          testApiPattern={state.testApiPattern}
          setTestApiPattern={state.setTestApiPattern}
          handleRunApiTests={state.handleRunApiTests}
          runningTests={state.runningTests}
          latestApiTestResult={state.latestApiTestResult}
          showFullApiOutput={state.showFullApiOutput}
          setShowFullApiOutput={state.setShowFullApiOutput}
        />
      ) : null}
    </>
  );
}
