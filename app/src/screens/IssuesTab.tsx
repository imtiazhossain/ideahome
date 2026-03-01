import React from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { UserChip } from "../components/UserChip";
import { appStyles } from "../theme/appStyles";
import { statusLabel } from "../utils/issueStatus";
import {
  getCommentAttachmentStreamUrl,
  commentAttachmentLabel,
  pendingCommentAttachmentDataUri,
} from "../utils/commentAttachment";
import {
  ISSUE_STATUSES,
  getScreenshotStreamUrl,
  getRecordingStreamUrl,
  getIssueFileStreamUrl,
  type Issue,
  type IssueComment,
  type IssueScreenshot,
  type IssueRecording,
  type IssueFile,
  type CommentAttachment,
  type RunUiTestResult,
  type User,
} from "../api/client";
import type { PendingCommentAttachment } from "../types";

export type IssuesTabProps = {
  token: string;
  issueSearch: string;
  setIssueSearch: (v: string) => void;
  loadIssues: () => Promise<void>;
  newIssueTitle: string;
  setNewIssueTitle: (v: string) => void;
  newIssueDescription: string;
  setNewIssueDescription: (v: string) => void;
  newIssueAcceptanceCriteria: string;
  setNewIssueAcceptanceCriteria: (v: string) => void;
  newIssueDatabase: string;
  setNewIssueDatabase: (v: string) => void;
  newIssueApi: string;
  setNewIssueApi: (v: string) => void;
  newIssueTestCases: string;
  setNewIssueTestCases: (v: string) => void;
  newIssueAutomatedTest: string;
  setNewIssueAutomatedTest: (v: string) => void;
  newIssueQualityScore: string;
  setNewIssueQualityScore: (v: string) => void;
  newIssueAssigneeId: string;
  setNewIssueAssigneeId: (v: string) => void;
  usersLoading: boolean;
  usersError: string;
  users: User[];
  creatingIssue: boolean;
  selectedProjectId: string;
  handleCreateIssue: () => Promise<void>;
  clearingIssues: boolean;
  issues: Issue[];
  handleDeleteAllIssues: () => Promise<void>;
  issuesLoading: boolean;
  issuesError: string;
  filteredIssues: Issue[];
  issuesByStatus: Record<string, Issue[]>;
  handleResetIssueBoardFilters: () => void;
  selectedIssueId: string;
  setSelectedIssueId: (v: string) => void;
  setCollapsedIssueStatuses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  issueAssigneeFilter: string;
  setIssueAssigneeFilter: (v: string) => void;
  issueBoardFocus: string;
  setIssueBoardFocus: (v: string) => void;
  issueBoardStatuses: string[];
  issueBoardKeyExtractor: (status: string) => string;
  renderIssueBoardColumn: (info: { item: string }) => React.ReactNode;
  selectedIssue: Issue | null;
  issueEditTitle: string;
  setIssueEditTitle: (v: string) => void;
  issueEditDescription: string;
  setIssueEditDescription: (v: string) => void;
  issueEditAcceptanceCriteria: string;
  setIssueEditAcceptanceCriteria: (v: string) => void;
  issueEditDatabase: string;
  setIssueEditDatabase: (v: string) => void;
  issueEditApi: string;
  setIssueEditApi: (v: string) => void;
  issueEditTestCases: string;
  setIssueEditTestCases: (v: string) => void;
  issueEditAutomatedTest: string;
  setIssueEditAutomatedTest: (v: string) => void;
  issueEditQualityScore: string;
  setIssueEditQualityScore: (v: string) => void;
  issueEditAssigneeId: string;
  setIssueEditAssigneeId: (v: string) => void;
  savingIssueEdit: boolean;
  deletingIssue: boolean;
  handleSaveIssue: () => Promise<void>;
  handleDeleteIssue: () => Promise<void>;
  uploadingIssueAsset: boolean;
  handleUploadScreenshot: () => Promise<void>;
  handleUploadRecording: () => Promise<void>;
  handleUploadFile: () => Promise<void>;
  handleCaptureScreenshot: () => Promise<void>;
  handleCaptureRecording: () => Promise<void>;
  automatedTestNames: string[];
  runningIssueAutomatedTests: boolean;
  runningUiTests: Record<string, boolean>;
  uiTestResults: Record<string, RunUiTestResult>;
  handleRunAllIssueAutomatedTests: () => Promise<void>;
  handleRunAutomatedTest: (testName: string) => Promise<void>;
  setPreviewTitle: (v: string) => void;
  setPreviewUrl: (v: string) => void;
  newCommentBody: string;
  setNewCommentBody: (v: string) => void;
  creatingComment: boolean;
  pendingCommentAttachments: PendingCommentAttachment[];
  setPendingCommentAttachments: React.Dispatch<React.SetStateAction<PendingCommentAttachment[]>>;
  handleCreateComment: () => Promise<void>;
  handleAddPendingCommentScreenshot: () => Promise<void>;
  handleCapturePendingCommentScreenshot: () => Promise<void>;
  handleAddPendingCommentVideo: () => Promise<void>;
  handleCapturePendingCommentVideo: () => Promise<void>;
  issueComments: IssueComment[];
  commentsLoading: boolean;
  commentsError: string;
  editingCommentId: string;
  commentEditBody: string;
  setCommentEditBody: (v: string) => void;
  setEditingCommentId: (v: string) => void;
  handleSaveComment: () => Promise<void>;
  handleAttachCommentScreenshot: (commentId: string) => Promise<void>;
  handleAttachCommentVideo: (commentId: string) => Promise<void>;
  handleDeleteComment: (commentId: string) => Promise<void>;
  handleDeleteCommentAttachment: (commentId: string, attachmentId: string) => Promise<void>;
  uploadingCommentAttachmentId: string;
  editingScreenshotId: string;
  screenshotEditName: string;
  setScreenshotEditName: (v: string) => void;
  setEditingScreenshotId: (v: string) => void;
  handleSaveScreenshotName: () => Promise<void>;
  handleDeleteScreenshot: (screenshotId: string) => Promise<void>;
  editingRecordingId: string;
  recordingEditName: string;
  setRecordingEditName: (v: string) => void;
  setEditingRecordingId: (v: string) => void;
  handleSaveRecordingName: () => Promise<void>;
  handleDeleteRecording: (recordingId: string) => Promise<void>;
  editingFileId: string;
  fileEditName: string;
  setFileEditName: (v: string) => void;
  setEditingFileId: (v: string) => void;
  handleSaveFileName: () => Promise<void>;
  handleDeleteFile: (fileId: string) => Promise<void>;
};

export function IssuesTab(props: IssuesTabProps) {
  const {
    token,
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
    selectedProjectId,
    handleCreateIssue,
    clearingIssues,
    issues,
    handleDeleteAllIssues,
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
    setPreviewTitle,
    setPreviewUrl,
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
  } = props;

  return (
    <View style={appStyles.stackFill}>
      <AppCard title="Create Issue">
        <View style={appStyles.stack}>
          <TextInput
            style={appStyles.input}
            value={issueSearch}
            onChangeText={setIssueSearch}
            placeholder="Search issues"
            placeholderTextColor="#94a3b8"
          />
          <AppButton
            label="Apply Search"
            variant="secondary"
            onPress={() => {
              loadIssues().catch(() => {});
            }}
          />
          <TextInput
            style={appStyles.input}
            value={newIssueTitle}
            onChangeText={setNewIssueTitle}
            placeholder="Issue title"
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={[appStyles.input, appStyles.multilineInput]}
            value={newIssueDescription}
            onChangeText={setNewIssueDescription}
            placeholder="Issue description"
            placeholderTextColor="#94a3b8"
            multiline
          />
          <TextInput
            style={[appStyles.input, appStyles.multilineInput]}
            value={newIssueAcceptanceCriteria}
            onChangeText={setNewIssueAcceptanceCriteria}
            placeholder="Acceptance criteria"
            placeholderTextColor="#94a3b8"
            multiline
          />
          <TextInput
            style={appStyles.input}
            value={newIssueDatabase}
            onChangeText={setNewIssueDatabase}
            placeholder="Database notes"
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={appStyles.input}
            value={newIssueApi}
            onChangeText={setNewIssueApi}
            placeholder="API notes"
            placeholderTextColor="#94a3b8"
          />
          <TextInput
            style={[appStyles.input, appStyles.multilineInput]}
            value={newIssueTestCases}
            onChangeText={setNewIssueTestCases}
            placeholder="Test cases"
            placeholderTextColor="#94a3b8"
            multiline
          />
          <TextInput
            style={[appStyles.input, appStyles.multilineInput]}
            value={newIssueAutomatedTest}
            onChangeText={setNewIssueAutomatedTest}
            placeholder="Automated tests"
            placeholderTextColor="#94a3b8"
            multiline
          />
          <TextInput
            style={appStyles.input}
            value={newIssueQualityScore}
            onChangeText={setNewIssueQualityScore}
            keyboardType="decimal-pad"
            placeholder="Quality score (0-100)"
            placeholderTextColor="#94a3b8"
          />
          <Text style={appStyles.sectionLabel}>Assignee</Text>
          {usersLoading ? <ActivityIndicator /> : null}
          {usersError ? <Text style={appStyles.errorText}>{usersError}</Text> : null}
          <View style={appStyles.chipWrap}>
            <Pressable
              style={[appStyles.chip, !newIssueAssigneeId ? appStyles.chipActive : null]}
              onPress={() => setNewIssueAssigneeId("")}
            >
              <Text style={[appStyles.chipText, !newIssueAssigneeId ? appStyles.chipTextActive : null]}>
                Unassigned
              </Text>
            </Pressable>
            {users.map((user) => (
              <Pressable
                key={user.id}
                style={[appStyles.chip, newIssueAssigneeId === user.id ? appStyles.chipActive : null]}
                onPress={() => setNewIssueAssigneeId(user.id)}
              >
                <Text
                  style={[
                    appStyles.chipText,
                    newIssueAssigneeId === user.id ? appStyles.chipTextActive : null,
                  ]}
                >
                  {user.name || user.email}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[appStyles.inlineRowWrap, appStyles.spaceTop]}>
          <AppButton
            label={creatingIssue ? "Creating..." : "Create"}
            disabled={creatingIssue || !newIssueTitle.trim() || !selectedProjectId}
            onPress={() => {
              handleCreateIssue().catch(() => {});
            }}
          />
          <AppButton
            label={clearingIssues ? "Deleting..." : "Delete All Issues"}
            variant="secondary"
            disabled={clearingIssues || !issues.length}
            onPress={() => {
              handleDeleteAllIssues().catch(() => {});
            }}
          />
        </View>
      </AppCard>

      <AppCard title="Issue Board" style={appStyles.fillCard}>
        {issuesLoading ? <ActivityIndicator /> : null}
        {issuesError ? <Text style={appStyles.errorText}>{issuesError}</Text> : null}
        <View style={appStyles.issueMetaRow}>
          <View style={appStyles.issueMetaPill}>
            <Text style={appStyles.listItemMeta}>Total: {filteredIssues.length}</Text>
          </View>
          <View style={appStyles.issueMetaPill}>
            <Text style={appStyles.listItemMeta}>
              Open: {(issuesByStatus.backlog?.length ?? 0) + (issuesByStatus.todo?.length ?? 0) + (issuesByStatus.in_progress?.length ?? 0)}
            </Text>
          </View>
          <View style={appStyles.issueMetaPill}>
            <Text style={appStyles.listItemMeta}>Done: {issuesByStatus.done?.length ?? 0}</Text>
          </View>
        </View>
        <View style={appStyles.inlineRowWrap}>
          <AppButton
            label="Refresh Board"
            variant="secondary"
            onPress={() => {
              loadIssues().catch(() => {});
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
        <Text style={appStyles.sectionLabel}>Assignee Filter</Text>
        <View style={appStyles.chipWrap}>
          <Pressable
            style={[appStyles.chip, issueAssigneeFilter === "all" ? appStyles.chipActive : null]}
            onPress={() => setIssueAssigneeFilter("all")}
          >
            <Text style={[appStyles.chipText, issueAssigneeFilter === "all" ? appStyles.chipTextActive : null]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[appStyles.chip, issueAssigneeFilter === "unassigned" ? appStyles.chipActive : null]}
            onPress={() => setIssueAssigneeFilter("unassigned")}
          >
            <Text
              style={[
                appStyles.chipText,
                issueAssigneeFilter === "unassigned" ? appStyles.chipTextActive : null,
              ]}
            >
              Unassigned
            </Text>
          </Pressable>
          {users.map((user) => (
            <UserChip
              key={`board-filter-${user.id}`}
              userId={user.id}
              label={user.name || user.email}
              isSelected={issueAssigneeFilter === user.id}
              onSelect={setIssueAssigneeFilter}
            />
          ))}
        </View>
        <View style={appStyles.chipWrap}>
          <Pressable
            style={[appStyles.chip, issueBoardFocus === "all" ? appStyles.chipActive : null]}
            onPress={() => setIssueBoardFocus("all")}
          >
            <Text style={[appStyles.chipText, issueBoardFocus === "all" ? appStyles.chipTextActive : null]}>
              All
            </Text>
          </Pressable>
          {ISSUE_STATUSES.map((status) => (
            <Pressable
              key={status}
              style={[appStyles.chip, issueBoardFocus === status ? appStyles.chipActive : null]}
              onPress={() => setIssueBoardFocus(status)}
            >
              <Text
                style={[
                  appStyles.chipText,
                  issueBoardFocus === status ? appStyles.chipTextActive : null,
                ]}
              >
                {statusLabel(status)} ({(issuesByStatus[status] ?? []).length})
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={issueBoardStatuses}
          keyExtractor={issueBoardKeyExtractor}
          contentContainerStyle={appStyles.listContainer}
          renderItem={renderIssueBoardColumn}
        />
      </AppCard>

      <AppCard title="Issue Details">
        {selectedIssue ? (
          <View style={appStyles.stack}>
            <View style={appStyles.issueMetaRow}>
              <View style={appStyles.issueMetaPill}>
                <Text style={appStyles.listItemMeta}>Key: {selectedIssue.key ?? "N/A"}</Text>
              </View>
              <View style={appStyles.issueMetaPill}>
                <Text style={appStyles.listItemMeta}>Status: {statusLabel(selectedIssue.status)}</Text>
              </View>
              <View style={appStyles.issueMetaPill}>
                <Text style={appStyles.listItemMeta}>
                  Assignee:{" "}
                  {selectedIssue.assignee?.name ??
                    selectedIssue.assignee?.email ??
                    "Unassigned"}
                </Text>
              </View>
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Overview</Text>
              <TextInput
                style={appStyles.input}
                value={issueEditTitle}
                onChangeText={setIssueEditTitle}
                placeholder="Issue title"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditDescription}
                onChangeText={setIssueEditDescription}
                placeholder="Issue description"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Specification</Text>
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditAcceptanceCriteria}
                onChangeText={setIssueEditAcceptanceCriteria}
                placeholder="Acceptance criteria"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditDatabase}
                onChangeText={setIssueEditDatabase}
                placeholder="Database notes"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditApi}
                onChangeText={setIssueEditApi}
                placeholder="API notes"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditTestCases}
                onChangeText={setIssueEditTestCases}
                placeholder="Test cases"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[appStyles.input, appStyles.multilineInput]}
                value={issueEditAutomatedTest}
                onChangeText={setIssueEditAutomatedTest}
                placeholder="Automated tests"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Quality & Ownership</Text>
              <TextInput
                style={appStyles.input}
                value={issueEditQualityScore}
                onChangeText={setIssueEditQualityScore}
                keyboardType="decimal-pad"
                placeholder="Quality score (0-100)"
                placeholderTextColor="#94a3b8"
              />
              <Text style={appStyles.sectionLabel}>Assignee</Text>
              {usersLoading ? <ActivityIndicator /> : null}
              {usersError ? <Text style={appStyles.errorText}>{usersError}</Text> : null}
              <View style={appStyles.chipWrap}>
                <Pressable
                  style={[appStyles.chip, !issueEditAssigneeId ? appStyles.chipActive : null]}
                  onPress={() => setIssueEditAssigneeId("")}
                >
                  <Text style={[appStyles.chipText, !issueEditAssigneeId ? appStyles.chipTextActive : null]}>
                    Unassigned
                  </Text>
                </Pressable>
                {users.map((user) => (
                  <Pressable
                    key={user.id}
                    style={[appStyles.chip, issueEditAssigneeId === user.id ? appStyles.chipActive : null]}
                    onPress={() => setIssueEditAssigneeId(user.id)}
                  >
                    <Text
                      style={[
                        appStyles.chipText,
                        issueEditAssigneeId === user.id ? appStyles.chipTextActive : null,
                      ]}
                    >
                      {user.name || user.email}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={appStyles.inlineRow}>
                <AppButton
                  label={savingIssueEdit ? "Saving..." : "Save Issue"}
                  disabled={savingIssueEdit || !issueEditTitle.trim()}
                  onPress={() => {
                    handleSaveIssue().catch(() => {});
                  }}
                />
                <AppButton
                  label={deletingIssue ? "Deleting..." : "Delete Issue"}
                  variant="secondary"
                  disabled={deletingIssue}
                  onPress={() => {
                    handleDeleteIssue().catch(() => {});
                  }}
                />
              </View>
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Add Media</Text>
              <View style={appStyles.inlineRowWrap}>
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload Screenshot"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => {
                    handleUploadScreenshot().catch(() => {});
                  }}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload Recording"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => {
                    handleUploadRecording().catch(() => {});
                  }}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload File"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => {
                    handleUploadFile().catch(() => {});
                  }}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Capture Photo"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => {
                    handleCaptureScreenshot().catch(() => {});
                  }}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Record Video"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => {
                    handleCaptureRecording().catch(() => {});
                  }}
                />
              </View>
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Automated Tests</Text>
              <View style={appStyles.inlineRowWrap}>
                <AppButton
                  label={
                    runningIssueAutomatedTests
                      ? "Running all tests..."
                      : "Run All Automated Tests"
                  }
                  variant="secondary"
                  disabled={runningIssueAutomatedTests || !automatedTestNames.length}
                  onPress={() => {
                    handleRunAllIssueAutomatedTests().catch(() => {});
                  }}
                />
              </View>
              {automatedTestNames.length ? (
                automatedTestNames.map((testName) => {
                  const result = uiTestResults[testName];
                  const running = runningUiTests[testName] === true;
                  return (
                    <View key={testName} style={appStyles.listItem}>
                      <Text style={appStyles.listItemTitle}>{testName}</Text>
                      <View style={appStyles.inlineRowWrap}>
                        <AppButton
                          label={running ? "Running..." : "Run Test"}
                          variant="secondary"
                          disabled={running || runningIssueAutomatedTests}
                          onPress={() => {
                            handleRunAutomatedTest(testName).catch(() => {});
                          }}
                        />
                        {result ? (
                          <Text
                            style={[
                              appStyles.listItemMeta,
                              !result.success ? appStyles.errorText : null,
                            ]}
                          >
                            {result.success ? "Passed" : "Failed"} (exit: {result.exitCode ?? "n/a"})
                          </Text>
                        ) : null}
                      </View>
                      {result?.errorOutput ? (
                        <Text style={appStyles.errorText}>{result.errorOutput}</Text>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={appStyles.subtle}>
                  Add automated tests in the issue field above to run them.
                </Text>
              )}
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Comments</Text>
              <View style={appStyles.inlineRow}>
                <TextInput
                  style={appStyles.input}
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
                    handleCreateComment().catch(() => {});
                  }}
                />
              </View>
              <View style={appStyles.inlineRowWrap}>
                <AppButton
                  label="Add Photo"
                  variant="secondary"
                  onPress={() => {
                    handleAddPendingCommentScreenshot().catch(() => {});
                  }}
                />
                <AppButton
                  label="Capture Photo"
                  variant="secondary"
                  onPress={() => {
                    handleCapturePendingCommentScreenshot().catch(() => {});
                  }}
                />
                <AppButton
                  label="Add Video"
                  variant="secondary"
                  onPress={() => {
                    handleAddPendingCommentVideo().catch(() => {});
                  }}
                />
                <AppButton
                  label="Record Video"
                  variant="secondary"
                  onPress={() => {
                    handleCapturePendingCommentVideo().catch(() => {});
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
                <View style={appStyles.stack}>
                  {pendingCommentAttachments.map((attachment, index) => (
                    <View key={attachment.id} style={appStyles.pendingAttachmentChip}>
                      <View style={appStyles.flex}>
                        <Text style={appStyles.listItemMeta}>
                          {attachment.type === "screenshot" ? "Photo" : "Video"} #{index + 1}
                        </Text>
                        {attachment.type === "screenshot" ? (
                          <Image
                            source={{ uri: pendingCommentAttachmentDataUri(attachment) }}
                            style={appStyles.pendingAttachmentPreview}
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
              {commentsError ? <Text style={appStyles.errorText}>{commentsError}</Text> : null}
              {issueComments.map((comment) => (
                <View key={comment.id} style={appStyles.stack}>
                  {editingCommentId === comment.id ? (
                    <View style={appStyles.commentItem}>
                      <View style={appStyles.flex}>
                        <TextInput
                          style={[appStyles.input, appStyles.multilineInput]}
                          value={commentEditBody}
                          onChangeText={setCommentEditBody}
                          placeholder="Comment"
                          placeholderTextColor="#94a3b8"
                          multiline
                        />
                        <View style={appStyles.inlineRowWrap}>
                          <AppButton
                            label="Save"
                            onPress={() => {
                              handleSaveComment().catch(() => {});
                            }}
                          />
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
                    <View style={appStyles.commentItem}>
                      <View style={appStyles.flex}>
                        <Text style={appStyles.listItemTitle}>{comment.body}</Text>
                        <Text style={appStyles.listItemMeta}>{comment.createdAt}</Text>
                      </View>
                      <View style={appStyles.inlineRowWrap}>
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
                            handleAttachCommentScreenshot(comment.id).catch(() => {});
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
                            handleAttachCommentVideo(comment.id).catch(() => {});
                          }}
                        />
                        <AppButton
                          label="Delete"
                          variant="secondary"
                          onPress={() => {
                            handleDeleteComment(comment.id).catch(() => {});
                          }}
                        />
                      </View>
                    </View>
                  )}
                  {(comment.attachments ?? []).map((attachment: CommentAttachment) => (
                    <View key={attachment.id} style={appStyles.commentAttachmentRow}>
                      <View style={appStyles.stackFill}>
                        <Text style={appStyles.listItemMeta}>
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
                              style={appStyles.commentAttachmentPreview}
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
                          handleDeleteCommentAttachment(comment.id, attachment.id).catch(() => {});
                        }}
                      />
                    </View>
                  ))}
                </View>
              ))}
              {!commentsLoading && !issueComments.length ? (
                <Text style={appStyles.subtle}>No comments yet.</Text>
              ) : null}
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Screenshots</Text>
              {(selectedIssue.screenshots ?? []).map((screenshot: IssueScreenshot) => (
                <View key={screenshot.id} style={appStyles.stack}>
                  <Image
                    source={{
                      uri: getScreenshotStreamUrl(screenshot.imageUrl),
                      headers: { Authorization: `Bearer ${token}` },
                    }}
                    style={appStyles.screenshotPreview}
                    resizeMode="cover"
                  />
                  {editingScreenshotId === screenshot.id ? (
                    <View style={appStyles.inlineRowWrap}>
                      <TextInput
                        style={appStyles.input}
                        value={screenshotEditName}
                        onChangeText={setScreenshotEditName}
                        placeholder="Screenshot name"
                        placeholderTextColor="#94a3b8"
                      />
                      <AppButton
                        label="Save"
                        onPress={() => {
                          handleSaveScreenshotName().catch(() => {});
                        }}
                      />
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
                    <View style={appStyles.inlineRowWrap}>
                      <Text style={appStyles.listItemMeta}>{screenshot.name ?? screenshot.imageUrl}</Text>
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
                          handleDeleteScreenshot(screenshot.id).catch(() => {});
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
              {!(selectedIssue.screenshots ?? []).length ? (
                <Text style={appStyles.subtle}>No screenshots attached.</Text>
              ) : null}
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Recordings</Text>
              {(selectedIssue.recordings ?? []).map((recording: IssueRecording) => (
                <View key={recording.id} style={appStyles.listItem}>
                  <Text style={appStyles.listItemMeta}>
                    {recording.recordingType ?? recording.mediaType ?? "recording"} • {recording.createdAt}
                  </Text>
                  {editingRecordingId === recording.id ? (
                    <View style={appStyles.inlineRowWrap}>
                      <TextInput
                        style={appStyles.input}
                        value={recordingEditName}
                        onChangeText={setRecordingEditName}
                        placeholder="Recording name"
                        placeholderTextColor="#94a3b8"
                      />
                      <AppButton
                        label="Save"
                        onPress={() => {
                          handleSaveRecordingName().catch(() => {});
                        }}
                      />
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
                    <View style={appStyles.inlineRowWrap}>
                      <Text style={appStyles.listItemTitle}>{recording.name ?? recording.videoUrl}</Text>
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
                          handleDeleteRecording(recording.id).catch(() => {});
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
              {!(selectedIssue.recordings ?? []).length ? (
                <Text style={appStyles.subtle}>No recordings attached.</Text>
              ) : null}
            </View>
            <View style={appStyles.issueDetailSection}>
              <Text style={appStyles.sectionLabel}>Files</Text>
              {(selectedIssue.files ?? []).map((file: IssueFile) => (
                <View key={file.id} style={appStyles.listItem}>
                  {editingFileId === file.id ? (
                    <View style={appStyles.inlineRowWrap}>
                      <TextInput
                        style={appStyles.input}
                        value={fileEditName}
                        onChangeText={setFileEditName}
                        placeholder="File name"
                        placeholderTextColor="#94a3b8"
                      />
                      <AppButton
                        label="Save"
                        onPress={() => {
                          handleSaveFileName().catch(() => {});
                        }}
                      />
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
                    <View style={appStyles.inlineRowWrap}>
                      <Text style={appStyles.listItemTitle}>{file.fileName}</Text>
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
                          handleDeleteFile(file.id).catch(() => {});
                        }}
                      />
                    </View>
                  )}
                </View>
              ))}
              {!(selectedIssue.files ?? []).length ? (
                <Text style={appStyles.subtle}>No files attached.</Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={appStyles.subtle}>Select an issue from the board to edit it.</Text>
        )}
      </AppCard>
    </View>
  );
}
