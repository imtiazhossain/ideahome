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
    <View style={[s.issueItem, isSelected ? s.listItemSelected : null]}>
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
              <Text style={s.listItemTitle}>{issue.title}</Text>
            </Pressable>
            <Text style={s.listItemMeta}>
              Assignee: {issue.assignee?.name ?? issue.assignee?.email ?? "Unassigned"}
            </Text>
            <Text style={s.listItemMeta}>Quality: {issue.qualityScore ?? "n/a"}</Text>
            <Text
              style={[
                s.badge,
                {
                  color:
                    colors.status[issue.status as keyof typeof colors.status] ?? colors.textMuted,
                },
              ]}
            >
              {statusLabel(issue.status)}
            </Text>
          </>
        )}
      </View>
      <View style={s.inlineRowWrap}>
        {isQuickEdit ? (
          <>
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
          </>
        ) : (
          <>
            <AppButton label="Quick Edit" variant="secondary" onPress={onStartQuickEdit} />
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
          </>
        )}
      </View>
    </View>
  );
});
