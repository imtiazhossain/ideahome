import React, { useState } from "react";
import { View, Text, Alert, Linking, TextInput } from "react-native";
import type { Project } from "../api/client";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";
import { readUserIdFromToken, readUserEmailFromToken } from "../utils/auth";
import { APP_WEB_URL } from "../constants";

export type SettingsTabProps = {
  token: string;
  selectedProject: Project | null;
  loadProjects: () => Promise<void>;
  loadIssues: () => Promise<void>;
  clearingEnhancements: boolean;
  selectedProjectId: string;
  clearEnhancementsForProject: () => Promise<void>;
  onCreateCustomList: (name: string) => Promise<void>;
  onOpenTabPrefs: () => void;
};

export function SettingsTab({
  token,
  selectedProject,
  loadProjects,
  loadIssues,
  clearingEnhancements,
  selectedProjectId,
  clearEnhancementsForProject,
  onCreateCustomList,
  onOpenTabPrefs,
}: SettingsTabProps) {
  const s = appStyles;
  const [newListName, setNewListName] = useState("");

  const handleCreateList = () => {
    const name = newListName.trim();
    if (!name) return;
    onCreateCustomList(name).then(() => setNewListName("")).catch(() => {
      Alert.alert("Could not create list");
    });
  };

  return (
    <View style={s.stack}>
      <AppCard title="Workspace">
        <Text style={s.body}>User ID: {readUserIdFromToken(token) || "unknown"}</Text>
        <Text style={s.body}>Email: {readUserEmailFromToken(token) || "unknown"}</Text>
        <Text style={s.body}>Current project: {selectedProject?.name ?? "none"}</Text>
      </AppCard>
      <AppCard title="Custom lists">
        <View style={s.stack}>
          <Text style={s.subtle}>Create a new list (e.g. Groceries, Packing). It will appear as a tab.</Text>
          <View style={s.inlineRow}>
            <TextInput
              style={s.input}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              placeholderTextColor="#94a3b8"
            />
            <AppButton
              label="New list"
              disabled={!newListName.trim()}
              onPress={handleCreateList}
            />
          </View>
        </View>
      </AppCard>
      <AppCard title="Tabs">
        <AppButton
          label="Customize tabs (reorder, hide)"
          variant="secondary"
          onPress={onOpenTabPrefs}
        />
      </AppCard>
      <AppCard title="Actions">
        <View style={s.inlineRowWrap}>
          <AppButton
            label="Open Web in Safari"
            variant="secondary"
            onPress={() => {
              Linking.openURL(APP_WEB_URL).catch(() => {
                Alert.alert("Unable to open Safari");
              });
            }}
          />
          <AppButton
            label="Reload Projects"
            variant="secondary"
            onPress={() => loadProjects().catch(() => {})}
          />
          <AppButton
            label="Reload Issues"
            variant="secondary"
            onPress={() => loadIssues().catch(() => {})}
          />
          <AppButton
            label={clearingEnhancements ? "Clearing..." : "Clear Enhancements Cache"}
            variant="secondary"
            disabled={clearingEnhancements || !selectedProjectId}
            onPress={() => clearEnhancementsForProject().catch(() => {})}
          />
        </View>
      </AppCard>
    </View>
  );
}
