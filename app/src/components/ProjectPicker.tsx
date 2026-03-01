import React from "react";
import { View, ActivityIndicator, Text, Pressable } from "react-native";
import type { Project } from "../api/client";
import { AppButton } from "./ui/AppButton";
import { AppCard } from "./ui/AppCard";
import { appStyles } from "../theme/appStyles";

type ProjectPickerProps = {
  projects: Project[];
  selectedProjectId: string;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
  error: string;
};

export function ProjectPicker({
  projects,
  selectedProjectId,
  onSelect,
  onRefresh,
  loading,
  error,
}: ProjectPickerProps) {
  const s = appStyles;
  return (
    <AppCard title="Project Scope">
      <View style={s.inlineRowWrap}>
        <AppButton label="Refresh Projects" variant="secondary" onPress={onRefresh} />
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {projects.length ? (
        <View style={s.chipWrap}>
          {projects.map((project) => (
            <Pressable
              key={project.id}
              style={[s.chip, project.id === selectedProjectId ? s.chipActive : null]}
              onPress={() => onSelect(project.id)}
            >
              <Text
                style={[
                  s.chipText,
                  project.id === selectedProjectId ? s.chipTextActive : null,
                ]}
              >
                {project.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={s.subtle}>Create a project to continue.</Text>
      )}
    </AppCard>
  );
}
