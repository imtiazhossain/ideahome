import React, { memo } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { ISSUE_STATUSES } from "../api/client";
import type { Issue, User } from "../api/client";
import { AppButton } from "./ui/AppButton";
import { colors } from "../theme/tokens";
import { statusLabel } from "../utils/issueStatus";
import { appStyles } from "../theme/appStyles";

export type IssueBoardRowProps = {
  issue: Issue;
  isSelected: boolean;
  isQuickEdit: boolean;
  quickEditTitle: string;
  quickEditQualityScore: string;
  quickEditAssigneeId: string;
  users: User[];
  savingQuickEdit: boolean;
  onQuickEditTitleChange: (text: string) => void;
  onQuickEditQualityScoreChange: (text: string) => void;
  onQuickEditAssigneeChange: (userId: string) => void;
  onSelectIssue: () => void;
  onStartQuickEdit: () => void;
  onCancelQuickEdit: () => void;
  onSaveQuickEdit: () => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
};

export const IssueBoardRow = memo(function IssueBoardRow({
  issue,
  isSelected,
  isQuickEdit,
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
  onMoveBackward,
  onMoveForward,
}: IssueBoardRowProps) {
  const s = appStyles;
  return (
    <View style={[s.issueCard, isSelected ? s.listItemSelected : null]}>
      {!isQuickEdit ? (
        <View style={s.issueCardQualityScore}>
          <Text style={s.issueCardQualityScoreText}>
            {issue.qualityScore != null
              ? Math.round(Number(issue.qualityScore))
              : "—"}
          </Text>
        </View>
      ) : null}
      <View style={s.issueItemMain}>
        {isQuickEdit ? (
          <View style={s.stack}>
            <TextInput
              style={s.input}
              value={quickEditTitle}
              onChangeText={onQuickEditTitleChange}
              placeholder="Issue title"
              placeholderTextColor="#94a3b8"
            />
            <TextInput
              style={s.input}
              value={quickEditQualityScore}
              onChangeText={onQuickEditQualityScoreChange}
              keyboardType="decimal-pad"
              placeholder="Quality score"
              placeholderTextColor="#94a3b8"
            />
            <View style={s.chipWrap}>
              <Pressable
                style={[s.chip, !quickEditAssigneeId ? s.chipActive : null]}
                onPress={() => onQuickEditAssigneeChange("")}
              >
                <Text style={[s.chipText, !quickEditAssigneeId ? s.chipTextActive : null]}>
                  Unassigned
                </Text>
              </Pressable>
              {users.map((user) => (
                <Pressable
                  key={`quick-edit-${issue.id}-${user.id}`}
                  style={[s.chip, quickEditAssigneeId === user.id ? s.chipActive : null]}
                  onPress={() => onQuickEditAssigneeChange(user.id)}
                >
                  <Text
                    style={[
                      s.chipText,
                      quickEditAssigneeId === user.id ? s.chipTextActive : null,
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
            <Pressable onPress={onSelectIssue}>
              <Text style={s.issueCardTitle} numberOfLines={2}>
                {issue.title || "Untitled"}
              </Text>
            </Pressable>
            <View style={s.issueCardMeta}>
              <Text style={s.listItemMeta}>
                {issue.key ?? `${issue.id.slice(-4).toUpperCase()}`}
              </Text>
              <Text style={s.listItemMeta} numberOfLines={1}>
                {issue.assignee?.name ?? issue.assignee?.email ?? "Unassigned"}
              </Text>
            </View>
          </>
        )}
      </View>
      {isQuickEdit ? (
        <View style={s.inlineRowWrap}>
          <AppButton
            label={savingQuickEdit ? "Saving..." : "Save"}
            disabled={savingQuickEdit || !quickEditTitle.trim()}
            onPress={onSaveQuickEdit}
          />
          <AppButton
            label="Cancel"
            variant="secondary"
            disabled={savingQuickEdit}
            onPress={onCancelQuickEdit}
          />
          <AppButton
            label="Back"
            variant="secondary"
            disabled={issue.status === ISSUE_STATUSES[0]}
            onPress={onMoveBackward}
          />
          <AppButton
            label="Forward"
            variant="secondary"
            disabled={issue.status === ISSUE_STATUSES[ISSUE_STATUSES.length - 1]}
            onPress={onMoveForward}
          />
        </View>
      ) : null}
    </View>
  );
});
