import React, { useState, useMemo } from "react";
import { View, TextInput, FlatList, Pressable, Text, ActivityIndicator } from "react-native";
import type { ChecklistItem } from "../api/client";
import type { AssistantChatMessage } from "../types";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { appStyles } from "../theme/appStyles";

export type ChecklistSectionAssistant = {
  title: string;
  chatsById: Record<string, AssistantChatMessage[]>;
  draftsById: Record<string, string>;
  loadingById: Record<string, boolean>;
  expandedById: Record<string, boolean>;
  onToggle: (itemId: string) => void;
  onDraftChange: (itemId: string, value: string) => void;
  onSend: (item: ChecklistItem) => void;
};

export type ChecklistSectionProps = {
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
  assistant?: ChecklistSectionAssistant;
};

export function ChecklistSection({
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
}: ChecklistSectionProps) {
  const s = appStyles;
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
    <View style={s.stackFill}>
      <AppCard title={`Create ${title.slice(0, -1)}`}>
        <View style={s.inlineRow}>
          <TextInput
            style={s.input}
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

      <AppCard title={title} style={s.fillCard}>
        <View style={s.stack}>
          <TextInput
            style={s.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search ${title.toLowerCase()}`}
            placeholderTextColor="#94a3b8"
          />
          <View style={s.inlineRowWrap}>
            <Pressable
              style={[s.chip, visibilityFilter === "all" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("all")}
            >
              <Text
                style={[s.chipText, visibilityFilter === "all" ? s.chipTextActive : null]}
              >
                All ({sortedItems.length})
              </Text>
            </Pressable>
            <Pressable
              style={[s.chip, visibilityFilter === "pending" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("pending")}
            >
              <Text
                style={[s.chipText, visibilityFilter === "pending" ? s.chipTextActive : null]}
              >
                Pending ({pendingCount})
              </Text>
            </Pressable>
            <Pressable
              style={[s.chip, visibilityFilter === "done" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("done")}
            >
              <Text
                style={[s.chipText, visibilityFilter === "done" ? s.chipTextActive : null]}
              >
                Done ({doneCount})
              </Text>
            </Pressable>
            <AppButton
              label="Clear Done"
              variant="secondary"
              disabled={!doneCount}
              onPress={onClearDone}
            />
          </View>
        </View>
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text style={s.errorText}>{error}</Text> : null}
        {!canReorder ? (
          <Text style={s.subtle}>Reorder is available only in All view with no search.</Text>
        ) : null}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContainer}
          renderItem={({ item, index }) => (
            <View style={s.checklistItem}>
              {editingId === item.id ? (
                <View style={s.stack}>
                  <TextInput
                    style={s.input}
                    value={editingName}
                    onChangeText={setEditingName}
                    placeholder={`${title.slice(0, -1)} name`}
                    placeholderTextColor="#94a3b8"
                  />
                  <View style={s.inlineRowWrap}>
                    <AppButton label="Save" onPress={onSaveEdit} />
                    <AppButton label="Cancel" variant="secondary" onPress={onCancelEdit} />
                    <AppButton label="Delete" variant="secondary" onPress={() => onDelete(item)} />
                  </View>
                </View>
              ) : (
                <>
                  <Pressable style={s.checklistMain} onPress={() => onToggle(item)}>
                    <Text style={[s.listItemTitle, item.done ? s.doneText : null]}>
                      {item.name}
                    </Text>
                    <Text style={s.listItemMeta}>{item.done ? "Done" : "Pending"}</Text>
                  </Pressable>
                  <View style={s.inlineRowWrap}>
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
                    <View style={s.assistantPanel}>
                      <Text style={s.sectionLabel}>{assistant.title}</Text>
                      {(assistant.chatsById[item.id] ?? []).length ? (
                        <View style={s.stack}>
                          {(assistant.chatsById[item.id] ?? []).map((message) => (
                            <View key={message.id} style={s.assistantMessage}>
                              <Text style={s.listItemMeta}>
                                {message.role === "user" ? "You" : "Assistant"}
                              </Text>
                              <Text style={s.body}>{message.text}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={s.subtle}>No messages yet.</Text>
                      )}
                      <TextInput
                        style={s.input}
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
            <Text style={s.subtle}>
              {searchQuery.trim() || visibilityFilter !== "all"
                ? "No matching items."
                : "No items yet."}
            </Text>
          }
        />
      </AppCard>
    </View>
  );
}
