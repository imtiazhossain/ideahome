import React, { memo } from "react";
import { View, Text } from "react-native";
import { AppCard } from "../components/ui/AppCard";
import { appStyles } from "../theme/appStyles";

export type HomeTabProps = {
  projectCount: number;
  selectedProjectName: string;
  issuesCount: number;
  expensesTotal: number;
  featuresCount: number;
  todosCount: number;
  ideasCount: number;
  bugsCount: number;
  enhancementsCount: number;
};

export const HomeTab = memo(function HomeTab({
  projectCount,
  selectedProjectName,
  issuesCount,
  expensesTotal,
  featuresCount,
  todosCount,
  ideasCount,
  bugsCount,
  enhancementsCount,
}: HomeTabProps) {
  const s = appStyles;
  return (
    <View style={s.stack}>
      <AppCard title="Projects">
        <Text style={s.bigValue}>{projectCount}</Text>
      </AppCard>
      <AppCard title="Current Project">
        <Text style={s.valueText}>{selectedProjectName}</Text>
      </AppCard>
      <AppCard title="Summary">
        <Text style={s.body}>Issues: {issuesCount}</Text>
        <Text style={s.body}>Expenses: ${expensesTotal.toFixed(2)}</Text>
        <Text style={s.body}>Features: {featuresCount}</Text>
        <Text style={s.body}>To-Do: {todosCount}</Text>
        <Text style={s.body}>Ideas: {ideasCount}</Text>
        <Text style={s.body}>Bugs: {bugsCount}</Text>
        <Text style={s.body}>Enhancements: {enhancementsCount}</Text>
      </AppCard>
    </View>
  );
});
