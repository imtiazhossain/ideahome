import React, { memo, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import type { Issue, User } from "../api/client";
import { AppButton } from "./ui/AppButton";
import { IssueBoardRow } from "./IssueBoardRow";
import { statusLabel } from "../utils/issueStatus";
import { appStyles } from "../theme/appStyles";

const ISSUE_BOARD_COLUMN_HEIGHT = 420;

export type IssueBoardColumnProps = {
  status: string;
  issues: Issue[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedIssueId: string;
  quickEditIssueId: string;
  quickEditTitle: string;
  quickEditQualityScore: string;
  quickEditAssigneeId: string;
  users: User[];
  savingQuickEdit: boolean;
  onQuickEditTitleChange: (text: string) => void;
  onQuickEditQualityScoreChange: (text: string) => void;
  onQuickEditAssigneeChange: (userId: string) => void;
  onSelectIssue: (issueId: string) => void;
  onStartQuickEdit: (issue: Issue) => void;
  onCancelQuickEdit: () => void;
  onSaveQuickEdit: (issueId: string) => void;
  onMoveIssue: (issue: Issue, direction: "backward" | "forward") => void;
};

export const IssueBoardColumn = memo(function IssueBoardColumn({
  status,
  issues,
  collapsed,
  onToggleCollapse,
  selectedIssueId,
  quickEditIssueId,
  quickEditTitle,
  quickEditQualityScore,
  quickEditAssigneeId,
  users,
  savingQuickEdit,
  onQuickEditTitleChange,
  onQuickEditQualityScoreChange,
  onQuickEditAssigneeChange,
  onSelectIssue,
  onStartQuickEdit,
  onCancelQuickEdit,
  onSaveQuickEdit,
  onMoveIssue,
}: IssueBoardColumnProps) {
  const s = appStyles;
  const renderIssueRow = useCallback(
    ({ item: issue }: { item: Issue }) => (
      <IssueBoardRow
        issue={issue}
        isSelected={issue.id === selectedIssueId}
        isQuickEdit={quickEditIssueId === issue.id}
        quickEditTitle={quickEditTitle}
        quickEditQualityScore={quickEditQualityScore}
        quickEditAssigneeId={quickEditAssigneeId}
        users={users}
        savingQuickEdit={savingQuickEdit}
        onQuickEditTitleChange={onQuickEditTitleChange}
        onQuickEditQualityScoreChange={onQuickEditQualityScoreChange}
        onQuickEditAssigneeChange={onQuickEditAssigneeChange}
        onSelectIssue={() => onSelectIssue(issue.id)}
        onStartQuickEdit={() => onStartQuickEdit(issue)}
        onCancelQuickEdit={onCancelQuickEdit}
        onSaveQuickEdit={() => onSaveQuickEdit(issue.id)}
        onMoveBackward={() => onMoveIssue(issue, "backward")}
        onMoveForward={() => onMoveIssue(issue, "forward")}
      />
    ),
    [
      selectedIssueId,
      quickEditIssueId,
      quickEditTitle,
      quickEditQualityScore,
      quickEditAssigneeId,
      users,
      savingQuickEdit,
      onQuickEditTitleChange,
      onQuickEditQualityScoreChange,
      onQuickEditAssigneeChange,
      onSelectIssue,
      onStartQuickEdit,
      onCancelQuickEdit,
      onSaveQuickEdit,
      onMoveIssue,
    ]
  );
  const keyExtractor = useCallback((item: Issue) => item.id, []);
  if (collapsed) {
    return (
      <View style={s.issueGroup}>
        <View style={s.issueGroupHeader}>
          <Text style={s.issueGroupTitle}>
            {statusLabel(status)} ({issues.length})
          </Text>
          <AppButton label="Expand" variant="secondary" onPress={onToggleCollapse} />
        </View>
        {issues.length > 0 ? <Text style={s.subtle}>Lane collapsed</Text> : null}
      </View>
    );
  }
  return (
    <View style={s.issueGroup}>
      <View style={s.issueGroupHeader}>
        <Text style={s.issueGroupTitle}>
          {statusLabel(status)} ({issues.length})
        </Text>
        <AppButton label="Collapse" variant="secondary" onPress={onToggleCollapse} />
      </View>
      {issues.length === 0 ? (
        <Text style={s.subtle}>No issues</Text>
      ) : (
        <FlatList
          data={issues}
          keyExtractor={keyExtractor}
          renderItem={renderIssueRow}
          style={{ maxHeight: ISSUE_BOARD_COLUMN_HEIGHT }}
          contentContainerStyle={s.listContainer}
          ListHeaderComponent={null}
        />
      )}
    </View>
  );
});
