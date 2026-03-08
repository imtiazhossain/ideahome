import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CustomListItem } from "../utils/customListsStorage";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";

export type CustomListTabProps = {
  listName: string;
  slug: string;
  userId: string;
  onDeleteList: () => void;
  items: CustomListItem[];
  loading: boolean;
  addItem: (name: string) => void;
  toggleDone: (item: CustomListItem) => void;
  removeItem: (item: CustomListItem) => void;
  updateItemName: (itemId: string, name: string) => void;
  reorder: (item: CustomListItem, direction: "up" | "down") => void;
};

export function CustomListTab({
  listName,
  slug,
  onDeleteList,
  items,
  loading,
  addItem,
  toggleDone,
  removeItem,
  updateItemName,
  reorder,
}: CustomListTabProps) {
  const s = appStyles;
  const [newItemName, setNewItemName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "pending" | "done">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.order - b.order),
    [items]
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();
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
  const canReorder = visibilityFilter === "all" && !searchQuery.trim();

  const handleAdd = () => {
    addItem(newItemName);
    setNewItemName("");
  };

  const handleStartEdit = (item: CustomListItem) => {
    setEditingId(item.id);
    setEditingValue(item.name);
  };

  const handleSaveEdit = () => {
    if (editingId) {
      updateItemName(editingId, editingValue);
      setEditingId(null);
      setEditingValue("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const confirmDeleteList = () => {
    Alert.alert(
      "Delete list",
      `Delete "${listName}" and all its items?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDeleteList },
      ]
    );
  };

  if (!slug) return null;

  return (
    <View style={s.stackFill}>
      <AppCard title={`Add to ${listName}`}>
        <View style={s.inlineRow}>
          <TextInput
            style={s.input}
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder="New entry…"
            placeholderTextColor="#94a3b8"
          />
          <AppButton
            label="Add"
            disabled={!newItemName.trim()}
            onPress={handleAdd}
          />
        </View>
      </AppCard>

      <AppCard title={listName} style={s.fillCard}>
        <View style={s.stack}>
          <TextInput
            style={s.input}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#94a3b8"
          />
          <View style={s.inlineRowWrap}>
            <Pressable
              style={[s.chip, visibilityFilter === "all" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("all")}
            >
              <Text style={[s.chipText, visibilityFilter === "all" ? s.chipTextActive : null]}>
                All ({sortedItems.length})
              </Text>
            </Pressable>
            <Pressable
              style={[s.chip, visibilityFilter === "pending" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("pending")}
            >
              <Text style={[s.chipText, visibilityFilter === "pending" ? s.chipTextActive : null]}>
                Pending ({sortedItems.filter((i) => !i.done).length})
              </Text>
            </Pressable>
            <Pressable
              style={[s.chip, visibilityFilter === "done" ? s.chipActive : null]}
              onPress={() => setVisibilityFilter("done")}
            >
              <Text style={[s.chipText, visibilityFilter === "done" ? s.chipTextActive : null]}>
                Done ({sortedItems.filter((i) => i.done).length})
              </Text>
            </Pressable>
          </View>
          {!canReorder ? (
            <Text style={s.subtle}>Reorder only in All view with no search.</Text>
          ) : null}
          {loading ? <ActivityIndicator /> : null}
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
                      value={editingValue}
                      onChangeText={setEditingValue}
                      placeholder="Entry name"
                      placeholderTextColor="#94a3b8"
                    />
                    <View style={s.inlineRowWrap}>
                      <AppButton label="Save" onPress={handleSaveEdit} />
                      <AppButton label="Cancel" variant="secondary" onPress={handleCancelEdit} />
                      <AppButton
                        label="Delete"
                        variant="secondary"
                        onPress={() => {
                          removeItem(item);
                          handleCancelEdit();
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <Pressable style={s.checklistMain} onPress={() => toggleDone(item)}>
                      <Text style={[s.listItemTitle, item.done ? s.doneText : null]}>
                        {item.name}
                      </Text>
                      <Text style={s.listItemMeta}>{item.done ? "Done" : "Pending"}</Text>
                    </Pressable>
                    <View style={s.inlineRowWrap}>
                      <AppButton label="Edit" variant="secondary" onPress={() => handleStartEdit(item)} />
                      <AppButton
                        label="Up"
                        variant="secondary"
                        disabled={!canReorder || index === 0}
                        onPress={() => reorder(item, "up")}
                      />
                      <AppButton
                        label="Down"
                        variant="secondary"
                        disabled={!canReorder || index === filteredItems.length - 1}
                        onPress={() => reorder(item, "down")}
                      />
                      <AppButton
                        label="Delete"
                        variant="secondary"
                        onPress={() => removeItem(item)}
                      />
                    </View>
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
        </View>
      </AppCard>

      <AppCard title="List Options">
        <AppButton
          label={`Delete list "${listName}"`}
          variant="secondary"
          onPress={confirmDeleteList}
        />
      </AppCard>
    </View>
  );
}
