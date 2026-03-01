import React from "react";
import { View, Text, Alert, Linking } from "react-native";
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
};

export function SettingsTab({
  token,
  selectedProject,
  loadProjects,
  loadIssues,
  clearingEnhancements,
  selectedProjectId,
  clearEnhancementsForProject,
}: SettingsTabProps) {
  const s = appStyles;
  return (
    <View style={s.stack}>
      <AppCard title="Workspace">
        <Text style={s.body}>User ID: {readUserIdFromToken(token) || "unknown"}</Text>
        <Text style={s.body}>Email: {readUserEmailFromToken(token) || "unknown"}</Text>
        <Text style={s.body}>Current project: {selectedProject?.name ?? "none"}</Text>
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
