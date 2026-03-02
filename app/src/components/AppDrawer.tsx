import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import type { AppTab } from "../types";
import type { CustomList } from "../utils/customListsStorage";
import type { Project } from "../api/client";
import { getTabLabel } from "../utils/tabLabels";
import { getCustomListTabId } from "../utils/customListsStorage";
import { AppButton } from "./ui/AppButton";
import { appStyles } from "../theme/appStyles";
import { colors, spacing } from "../theme/tokens";

export type AppDrawerProps = {
  visible: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  projectsLoading: boolean;
  onRefreshProjects: () => void;
  visibleTabOrder: AppTab[];
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  customLists: CustomList[];
  onOpenTabPrefs: () => void;
};

export function AppDrawer({
  visible,
  onClose,
  projects,
  selectedProjectId,
  onSelectProject,
  projectsLoading,
  onRefreshProjects,
  visibleTabOrder,
  activeTab,
  onSelectTab,
  customLists,
  onOpenTabPrefs,
}: AppDrawerProps) {
  const s = appStyles;

  const handleTabPress = (tab: AppTab) => {
    onSelectTab(tab);
    onClose();
  };

  const handleProjectPress = (id: string) => {
    onSelectProject(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={drawerStyles.overlay}>
        <Pressable style={drawerStyles.backdrop} onPress={onClose} />
        <View style={drawerStyles.panel}>
          <View style={drawerStyles.header}>
            <Text style={drawerStyles.title}>Idea Home</Text>
            <AppButton label="Close" variant="secondary" onPress={onClose} />
          </View>
          <ScrollView style={drawerStyles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Projects</Text>
            {projectsLoading ? (
              <ActivityIndicator />
            ) : (
              <View style={drawerStyles.list}>
                {projects.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[
                      drawerStyles.item,
                      p.id === selectedProjectId && drawerStyles.itemActive,
                    ]}
                    onPress={() => handleProjectPress(p.id)}
                  >
                    <Text
                      style={[
                        drawerStyles.itemText,
                        p.id === selectedProjectId && drawerStyles.itemTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <AppButton
              label="Refresh projects"
              variant="secondary"
              onPress={() => onRefreshProjects()}
            />

            <Text style={[s.sectionLabel, { marginTop: spacing.lg }]}>Sections</Text>
            <View style={drawerStyles.list}>
              {visibleTabOrder.map((tabId) => (
                <Pressable
                  key={tabId}
                  style={[
                    drawerStyles.item,
                    tabId === activeTab && drawerStyles.itemActive,
                  ]}
                  onPress={() => handleTabPress(tabId)}
                >
                  <Text
                    style={[
                      drawerStyles.itemText,
                      tabId === activeTab && drawerStyles.itemTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {getTabLabel(
                      tabId,
                      customLists.find((l) => getCustomListTabId(l.slug) === tabId)?.name
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={drawerStyles.footer}>
              <AppButton
                label="Customize tabs"
                variant="secondary"
                onPress={() => {
                  onOpenTabPrefs();
                  onClose();
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const drawerStyles = {
  overlay: {
    flex: 1,
    flexDirection: "row" as const,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    width: 280,
    flex: 1,
    backgroundColor: colors.bgCard,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: colors.accentStrong,
  },
  scroll: {
    flex: 1,
  },
  list: {
    gap: 2,
    marginBottom: spacing.sm,
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  itemActive: {
    backgroundColor: "#eff6ff",
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemTextActive: {
    fontWeight: "600" as const,
    color: colors.accentStrong,
  },
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
};
