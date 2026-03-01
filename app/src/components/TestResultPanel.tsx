import React from "react";
import { View, Text } from "react-native";
import type { TestExecutionResult } from "../types";
import { AppButton } from "./ui/AppButton";
import { appStyles } from "../theme/appStyles";

type TestResultPanelProps = {
  result: TestExecutionResult;
  expanded: boolean;
  onToggleExpanded: () => void;
};

export function TestResultPanel({
  result,
  expanded,
  onToggleExpanded,
}: TestResultPanelProps) {
  const s = appStyles;
  const output = result.output?.trim() ?? "";
  const errorOutput = result.errorOutput?.trim() ?? "";
  const visibleOutput = expanded ? output : output.slice(0, 2500);
  const canExpand = output.length > 2500;

  return (
    <View style={s.testResultPanel}>
      <Text style={result.success ? s.subtle : s.errorText}>
        {result.success ? "Passed" : "Failed"} (exit: {result.exitCode ?? "n/a"})
      </Text>
      {errorOutput ? <Text style={s.errorText}>{errorOutput}</Text> : null}
      {output ? (
        <View style={s.stack}>
          <Text style={s.testOutputText}>{visibleOutput}</Text>
          {canExpand ? (
            <AppButton
              label={expanded ? "Show less output" : "Show full output"}
              variant="secondary"
              onPress={onToggleExpanded}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
