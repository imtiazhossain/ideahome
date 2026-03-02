import React from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { appStyles } from "../theme/appStyles";
import { statusLabel } from "../utils/issueStatus";
import { ISSUE_STATUSES } from "../api/client";
import type { Issue, User, RunUiTestResult } from "../api/client";

const BOARD_COLUMN_WIDTH = 280;

export type BoardTabProps = {
  issuesByStatus: Record<string, Issue[]>;
  issueBoardStatuses: string[];
  issueBoardKeyExtractor: (status: string) => string;
  renderIssueBoardColumn: (info: { item: string }) => React.ReactNode;
  issueBoardFocus: string;
  setIssueBoardFocus: (v: string) => void;
  issueAssigneeFilter: string;
  setIssueAssigneeFilter: (v: string) => void;
  users: User[];
  selectedIssue: Issue | null;
  selectedIssueId: string;
  setSelectedIssueId: (v: string) => void;
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
  usersLoading: boolean;
  usersError: string;
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
};

export function BoardTab(props: BoardTabProps) {
  const {
    issuesByStatus,
    issueBoardStatuses,
    issueBoardKeyExtractor,
    renderIssueBoardColumn,
    issueBoardFocus,
    setIssueBoardFocus,
    issueAssigneeFilter,
    setIssueAssigneeFilter,
    users,
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
    usersLoading,
    usersError,
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
  } = props;
  const s = appStyles;

  return (
    <ScrollView style={s.stackFill} contentContainerStyle={s.listContainer}>
      <AppCard title="Board">
        <View style={s.chipWrap}>
          <Pressable
            style={[s.chip, issueAssigneeFilter === "all" ? s.chipActive : null]}
            onPress={() => setIssueAssigneeFilter("all")}
          >
            <Text style={[s.chipText, issueAssigneeFilter === "all" ? s.chipTextActive : null]}>
              All
            </Text>
          </Pressable>
          {users.map((user) => (
            <Pressable
              key={user.id}
              style={[s.chip, issueAssigneeFilter === user.id ? s.chipActive : null]}
              onPress={() => setIssueAssigneeFilter(user.id)}
            >
              <Text
                style={[
                  s.chipText,
                  issueAssigneeFilter === user.id ? s.chipTextActive : null,
                ]}
              >
                {user.name || user.email}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.chipWrap}>
          <Pressable
            style={[s.chip, issueBoardFocus === "all" ? s.chipActive : null]}
            onPress={() => setIssueBoardFocus("all")}
          >
            <Text style={[s.chipText, issueBoardFocus === "all" ? s.chipTextActive : null]}>
              All
            </Text>
          </Pressable>
          {ISSUE_STATUSES.map((status) => (
            <Pressable
              key={status}
              style={[s.chip, issueBoardFocus === status ? s.chipActive : null]}
              onPress={() => setIssueBoardFocus(status)}
            >
              <Text
                style={[
                  s.chipText,
                  issueBoardFocus === status ? s.chipTextActive : null,
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
          renderItem={({ item }) => (
            <View style={{ width: BOARD_COLUMN_WIDTH, marginRight: 8 }}>
              {renderIssueBoardColumn({ item })}
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.listContainer, { paddingVertical: 8 }]}
          style={{ maxHeight: 420 }}
        />
      </AppCard>

      <AppCard title="Issue Details">
        {selectedIssue ? (
          <View style={s.stack}>
            <View style={s.issueMetaRow}>
              <View style={s.issueMetaPill}>
                <Text style={s.listItemMeta}>Key: {selectedIssue.key ?? "N/A"}</Text>
              </View>
              <View style={s.issueMetaPill}>
                <Text style={s.listItemMeta}>Status: {statusLabel(selectedIssue.status)}</Text>
              </View>
              <View style={s.issueMetaPill}>
                <Text style={s.listItemMeta}>
                  Assignee:{" "}
                  {selectedIssue.assignee?.name ??
                    selectedIssue.assignee?.email ??
                    "Unassigned"}
                </Text>
              </View>
            </View>
            <View style={s.issueDetailSection}>
              <Text style={s.sectionLabel}>Overview</Text>
              <TextInput
                style={s.input}
                value={issueEditTitle}
                onChangeText={setIssueEditTitle}
                placeholder="Issue title"
                placeholderTextColor="#94a3b8"
              />
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditDescription}
                onChangeText={setIssueEditDescription}
                placeholder="Issue description"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={s.issueDetailSection}>
              <Text style={s.sectionLabel}>Specification</Text>
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditAcceptanceCriteria}
                onChangeText={setIssueEditAcceptanceCriteria}
                placeholder="Acceptance criteria"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditDatabase}
                onChangeText={setIssueEditDatabase}
                placeholder="Database notes"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditApi}
                onChangeText={setIssueEditApi}
                placeholder="API notes"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditTestCases}
                onChangeText={setIssueEditTestCases}
                placeholder="Test cases"
                placeholderTextColor="#94a3b8"
                multiline
              />
              <TextInput
                style={[s.input, s.multilineInput]}
                value={issueEditAutomatedTest}
                onChangeText={setIssueEditAutomatedTest}
                placeholder="Automated tests"
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>
            <View style={s.issueDetailSection}>
              <Text style={s.sectionLabel}>Quality & Ownership</Text>
              <TextInput
                style={s.input}
                value={issueEditQualityScore}
                onChangeText={setIssueEditQualityScore}
                keyboardType="decimal-pad"
                placeholder="Quality score (0-100)"
                placeholderTextColor="#94a3b8"
              />
              <Text style={s.sectionLabel}>Assignee</Text>
              {usersLoading ? <ActivityIndicator /> : null}
              {usersError ? <Text style={s.errorText}>{usersError}</Text> : null}
              <View style={s.chipWrap}>
                <Pressable
                  style={[s.chip, !issueEditAssigneeId ? s.chipActive : null]}
                  onPress={() => setIssueEditAssigneeId("")}
                >
                  <Text style={[s.chipText, !issueEditAssigneeId ? s.chipTextActive : null]}>
                    Unassigned
                  </Text>
                </Pressable>
                {users.map((user) => (
                  <Pressable
                    key={user.id}
                    style={[s.chip, issueEditAssigneeId === user.id ? s.chipActive : null]}
                    onPress={() => setIssueEditAssigneeId(user.id)}
                  >
                    <Text
                      style={[
                        s.chipText,
                        issueEditAssigneeId === user.id ? s.chipTextActive : null,
                      ]}
                    >
                      {user.name || user.email}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={s.inlineRow}>
                <AppButton
                  label={savingIssueEdit ? "Saving..." : "Save Issue"}
                  disabled={savingIssueEdit || !issueEditTitle.trim()}
                  onPress={() => handleSaveIssue().catch(() => {})}
                />
                <AppButton
                  label={deletingIssue ? "Deleting..." : "Delete Issue"}
                  variant="secondary"
                  disabled={deletingIssue}
                  onPress={() => handleDeleteIssue().catch(() => {})}
                />
              </View>
            </View>
            <View style={s.issueDetailSection}>
              <Text style={s.sectionLabel}>Add Media</Text>
              <View style={s.inlineRowWrap}>
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload Screenshot"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => handleUploadScreenshot().catch(() => {})}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload Recording"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => handleUploadRecording().catch(() => {})}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Upload File"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => handleUploadFile().catch(() => {})}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Capture Photo"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => handleCaptureScreenshot().catch(() => {})}
                />
                <AppButton
                  label={uploadingIssueAsset ? "Uploading..." : "Record Video"}
                  variant="secondary"
                  disabled={uploadingIssueAsset}
                  onPress={() => handleCaptureRecording().catch(() => {})}
                />
              </View>
            </View>
            <View style={s.issueDetailSection}>
              <Text style={s.sectionLabel}>Automated Tests</Text>
              <View style={s.inlineRowWrap}>
                <AppButton
                  label={
                    runningIssueAutomatedTests
                      ? "Running all tests..."
                      : "Run All Automated Tests"
                  }
                  variant="secondary"
                  disabled={runningIssueAutomatedTests || !automatedTestNames.length}
                  onPress={() => handleRunAllIssueAutomatedTests().catch(() => {})}
                />
              </View>
              {automatedTestNames.length > 0 &&
                automatedTestNames.map((testName) => {
                  const result = uiTestResults[testName];
                  const running = runningUiTests[testName] === true;
                  return (
                    <View key={testName} style={s.inlineRow}>
                      <AppButton
                        label={running ? "Running..." : `Run ${testName}`}
                        variant="secondary"
                        disabled={running}
                        onPress={() => handleRunAutomatedTest(testName).catch(() => {})}
                      />
                      {result ? (
                        <Text style={result.pass ? undefined : s.errorText}>
                          {result.pass ? "Pass" : "Fail"}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
            </View>
          </View>
        ) : (
          <Text style={s.subtle}>Select an issue from the board.</Text>
        )}
      </AppCard>
    </ScrollView>
  );
}
