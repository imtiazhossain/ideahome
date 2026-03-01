import React, { memo, useCallback } from "react";
import { View, TextInput, FlatList, Pressable, Text } from "react-native";
import type { Project } from "../api/client";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";

export type ProjectsTabProps = {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | null;
  createProjectName: string;
  setCreateProjectName: (v: string) => void;
  creatingProject: boolean;
  projectEditName: string;
  setProjectEditName: (v: string) => void;
  savingProjectEdit: boolean;
  deletingProject: boolean;
  onSelectProject: (id: string) => void;
  onCreateProject: () => Promise<void>;
  onUpdateProject: () => Promise<void>;
  onDeleteProject: () => Promise<void>;
};

const projectsListKeyExtractor = (item: Project) => item.id;

export const ProjectsTab = memo(function ProjectsTab({
  projects,
  selectedProjectId,
  selectedProject,
  createProjectName,
  setCreateProjectName,
  creatingProject,
  projectEditName,
  setProjectEditName,
  savingProjectEdit,
  deletingProject,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectsTabProps) {
  const s = appStyles;
  const renderProjectItem = useCallback(
    ({ item }: { item: Project }) => (
      <Pressable
        style={[s.listItem, item.id === selectedProjectId ? s.listItemSelected : null]}
        onPress={() => onSelectProject(item.id)}
      >
        <Text style={s.listItemTitle}>{item.name}</Text>
        <Text style={s.listItemMeta}>{item.id}</Text>
      </Pressable>
    ),
    [selectedProjectId, onSelectProject, s]
  );
  return (
    <View style={s.stackFill}>
      <AppCard title="Create Project">
        <View style={s.inlineRow}>
          <TextInput
            style={s.input}
            value={createProjectName}
            onChangeText={setCreateProjectName}
            placeholder="Project name"
            placeholderTextColor="#94a3b8"
          />
          <AppButton
            label={creatingProject ? "Adding..." : "Add"}
            disabled={creatingProject || !createProjectName.trim()}
            onPress={() => onCreateProject().catch(() => {})}
          />
        </View>
      </AppCard>
      <AppCard title="Project Settings">
        {selectedProject ? (
          <View style={s.stack}>
            <TextInput
              style={s.input}
              value={projectEditName}
              onChangeText={setProjectEditName}
              placeholder="Project name"
              placeholderTextColor="#94a3b8"
            />
            <View style={s.inlineRow}>
              <AppButton
                label={savingProjectEdit ? "Saving..." : "Save Name"}
                disabled={
                  savingProjectEdit ||
                  !projectEditName.trim() ||
                  projectEditName.trim() === selectedProject.name
                }
                onPress={() => onUpdateProject().catch(() => {})}
              />
              <AppButton
                label={deletingProject ? "Deleting..." : "Delete Project"}
                variant="secondary"
                disabled={deletingProject}
                onPress={() => onDeleteProject().catch(() => {})}
              />
            </View>
          </View>
        ) : (
          <Text style={s.subtle}>Select a project to edit or delete it.</Text>
        )}
      </AppCard>
      <AppCard title="Projects" style={s.fillCard}>
        <FlatList
          data={projects}
          keyExtractor={projectsListKeyExtractor}
          contentContainerStyle={s.listContainer}
          renderItem={renderProjectItem}
          ListEmptyComponent={<Text style={s.subtle}>No projects yet.</Text>}
        />
      </AppCard>
    </View>
  );
});
