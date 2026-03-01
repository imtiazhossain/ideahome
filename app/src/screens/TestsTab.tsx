import React from "react";
import { View, Text, TextInput } from "react-native";
import type { RunUiTestResult } from "../api/client";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { TestResultPanel } from "../components/TestResultPanel";
import { appStyles } from "../theme/appStyles";
import { API_TEST_PATTERNS, UI_TEST_PATTERNS } from "../constants";
import { API_TESTS } from "@ideahome/shared-config";

type UiTestSuite = { key: string; suiteName: string; tests: string[] };

export type TestsTabProps = {
  testUiPattern: string;
  setTestUiPattern: (v: string) => void;
  uiTestResultEntries: RunUiTestResult[];
  uiTestPassCount: number;
  uiTestFailCount: number;
  loadUiTestsCatalog: () => Promise<void>;
  uiTestsCatalogLoading: boolean;
  handleRunAllDiscoveredUiTests: () => Promise<void>;
  uiTestsBusy: boolean;
  discoveredUiTestNames: string[];
  handleClearUiTestResults: () => void;
  uiTestsCatalogError: string | null;
  discoveredUiTestSuites: UiTestSuite[];
  runningUiSuiteKey: string | null;
  handleRunUiSuite: (key: string, tests: string[]) => Promise<void>;
  runningUiTests: Record<string, boolean>;
  uiTestResults: Record<string, RunUiTestResult>;
  handleRunAutomatedTest: (testName: string) => Promise<void>;
  handleRunUiTests: () => Promise<void>;
  latestUiTestResult: RunUiTestResult | null;
  showFullUiOutput: boolean;
  setShowFullUiOutput: (fn: (prev: boolean) => boolean) => void;
  apiTestResultEntries: RunUiTestResult[];
  apiTestPassCount: number;
  apiTestFailCount: number;
  handleRunAllApiTests: () => Promise<void>;
  handleClearApiTestResults: () => void;
  runningApiSuiteKey: string | null;
  handleRunApiSuite: (suiteName: string, tests: string[]) => Promise<void>;
  apiTestsBusy: boolean;
  runningApiTestName: string | null;
  apiTestResultsByName: Record<string, RunUiTestResult>;
  handleRunSingleApiTest: (testName: string) => Promise<void>;
  testApiPattern: string;
  setTestApiPattern: (v: string) => void;
  handleRunApiTests: () => Promise<void>;
  runningTests: { ui: boolean; api: boolean };
  latestApiTestResult: RunUiTestResult | null;
  showFullApiOutput: boolean;
  setShowFullApiOutput: (fn: (prev: boolean) => boolean) => void;
};

export function TestsTab({
  testUiPattern,
  setTestUiPattern,
  uiTestResultEntries,
  uiTestPassCount,
  uiTestFailCount,
  loadUiTestsCatalog,
  uiTestsCatalogLoading,
  handleRunAllDiscoveredUiTests,
  uiTestsBusy,
  discoveredUiTestNames,
  handleClearUiTestResults,
  uiTestsCatalogError,
  discoveredUiTestSuites,
  runningUiSuiteKey,
  handleRunUiSuite,
  runningUiTests,
  uiTestResults,
  handleRunAutomatedTest,
  handleRunUiTests,
  latestUiTestResult,
  showFullUiOutput,
  setShowFullUiOutput,
  apiTestResultEntries,
  apiTestPassCount,
  apiTestFailCount,
  handleRunAllApiTests,
  handleClearApiTestResults,
  runningApiSuiteKey,
  handleRunApiSuite,
  apiTestsBusy,
  runningApiTestName,
  apiTestResultsByName,
  handleRunSingleApiTest,
  testApiPattern,
  setTestApiPattern,
  handleRunApiTests,
  runningTests,
  latestApiTestResult,
  showFullApiOutput,
  setShowFullApiOutput,
}: TestsTabProps) {
  const s = appStyles;
  return (
    <View style={s.stackFill}>
      <AppCard title="Run UI Tests">
        <View style={s.stack}>
          <View style={s.issueMetaRow}>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Results: {uiTestResultEntries.length}</Text>
            </View>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Passed: {uiTestPassCount}</Text>
            </View>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Failed: {uiTestFailCount}</Text>
            </View>
          </View>
          <TextInput
            style={s.input}
            value={testUiPattern}
            onChangeText={setTestUiPattern}
            placeholder='grep pattern, e.g. "login"'
            placeholderTextColor="#94a3b8"
          />
          <View style={s.inlineRowWrap}>
            {UI_TEST_PATTERNS.map((pattern: string) => (
              <AppButton
                key={pattern}
                label={pattern}
                variant="secondary"
                onPress={() => setTestUiPattern(pattern)}
              />
            ))}
            <AppButton label="Clear" variant="secondary" onPress={() => setTestUiPattern("")} />
          </View>
          <View style={s.inlineRowWrap}>
            <AppButton
              label={uiTestsCatalogLoading ? "Refreshing UI tests..." : "Refresh UI Tests List"}
              variant="secondary"
              disabled={uiTestsCatalogLoading}
              onPress={() => loadUiTestsCatalog().catch(() => {})}
            />
            <AppButton
              label={uiTestsBusy ? "Running all UI tests..." : "Run All UI Tests"}
              variant="secondary"
              disabled={uiTestsBusy || !discoveredUiTestNames.length}
              onPress={() => handleRunAllDiscoveredUiTests().catch(() => {})}
            />
            <AppButton
              label="Clear UI Results"
              variant="secondary"
              disabled={uiTestsBusy && !uiTestResultEntries.length}
              onPress={handleClearUiTestResults}
            />
          </View>
          {uiTestsCatalogError ? (
            <Text style={s.errorText}>{uiTestsCatalogError}</Text>
          ) : null}
          {discoveredUiTestSuites.length ? (
            <View style={s.stack}>
              {discoveredUiTestSuites.map((suite) => (
                <View key={suite.key} style={s.testSuitePanel}>
                  <View style={s.inlineRowWrap}>
                    <Text style={s.sectionLabel}>{suite.suiteName}</Text>
                    <AppButton
                      label={runningUiSuiteKey === suite.key ? "Running..." : "Run Suite"}
                      variant="secondary"
                      disabled={uiTestsBusy}
                      onPress={() => handleRunUiSuite(suite.key, suite.tests).catch(() => {})}
                    />
                  </View>
                  <View style={s.stack}>
                    {suite.tests.map((testName) => {
                      const result = uiTestResults[testName];
                      const running = runningUiTests[testName];
                      return (
                        <View key={`${suite.key}-${testName}`} style={s.listItem}>
                          <Text style={s.listItemTitle}>{testName}</Text>
                          <View style={s.inlineRowWrap}>
                            <AppButton
                              label={
                                running ? "Running..." : result ? "Run Again" : "Run"
                              }
                              variant="secondary"
                              disabled={uiTestsBusy}
                              onPress={() => {
                                setTestUiPattern(testName);
                                handleRunAutomatedTest(testName).catch(() => {});
                              }}
                            />
                            <AppButton
                              label="Use Pattern"
                              variant="secondary"
                              onPress={() => setTestUiPattern(testName)}
                            />
                            {result ? (
                              <Text
                                style={
                                  result.success ? s.subtle : s.errorText
                                }
                              >
                                {result.success ? "Passed" : "Failed"}
                                {result.exitCode !== null
                                  ? ` (exit ${result.exitCode})`
                                  : ""}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={s.subtle}>
              {uiTestsCatalogLoading
                ? "Loading discovered UI tests..."
                : "No discovered UI tests."}
            </Text>
          )}
          <AppButton
            label={runningTests.ui ? "Running UI tests..." : "Run UI Tests"}
            disabled={uiTestsBusy || !testUiPattern.trim()}
            onPress={() => handleRunUiTests().catch(() => {})}
          />
          {latestUiTestResult ? (
            <TestResultPanel
              result={latestUiTestResult}
              expanded={showFullUiOutput}
              onToggleExpanded={() => setShowFullUiOutput((c) => !c)}
            />
          ) : null}
        </View>
      </AppCard>

      <AppCard title="Run API Tests">
        <View style={s.stack}>
          <View style={s.issueMetaRow}>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Results: {apiTestResultEntries.length}</Text>
            </View>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Passed: {apiTestPassCount}</Text>
            </View>
            <View style={s.issueMetaPill}>
              <Text style={s.listItemMeta}>Failed: {apiTestFailCount}</Text>
            </View>
          </View>
          <View style={s.inlineRowWrap}>
            <AppButton
              label={
                apiTestsBusy ? "Running all API tests..." : "Run All API Tests"
              }
              variant="secondary"
              disabled={apiTestsBusy || !API_TESTS.flatMap((x) => x.tests).length}
              onPress={() => handleRunAllApiTests().catch(() => {})}
            />
            <AppButton
              label="Clear API Results"
              variant="secondary"
              disabled={apiTestsBusy && !apiTestResultEntries.length}
              onPress={handleClearApiTestResults}
            />
          </View>
          {API_TESTS.map((suite) => (
            <View key={suite.suite} style={s.testSuitePanel}>
              <View style={s.inlineRowWrap}>
                <Text style={s.sectionLabel}>{suite.suite}</Text>
                <AppButton
                  label={
                    runningApiSuiteKey === suite.suite ? "Running..." : "Run Suite"
                  }
                  variant="secondary"
                  disabled={apiTestsBusy}
                  onPress={() =>
                    handleRunApiSuite(suite.suite, suite.tests).catch(() => {})
                  }
                />
              </View>
              <View style={s.stack}>
                {suite.tests.map((testName) => {
                  const isRunning = runningApiTestName === testName;
                  const result = apiTestResultsByName[testName];
                  return (
                    <View key={testName} style={s.listItem}>
                      <Text style={s.listItemTitle}>{testName}</Text>
                      <View style={s.inlineRowWrap}>
                        <AppButton
                          label={
                            isRunning ? "Running..." : result ? "Run Again" : "Run"
                          }
                          variant="secondary"
                          disabled={apiTestsBusy}
                          onPress={() =>
                            handleRunSingleApiTest(testName).catch(() => {})
                          }
                        />
                        {result ? (
                          <Text
                            style={
                              result.success ? s.subtle : s.errorText
                            }
                          >
                            {result.success ? "Passed" : "Failed"}
                            {result.exitCode !== null
                              ? ` (exit ${result.exitCode})`
                              : ""}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          <TextInput
            style={s.input}
            value={testApiPattern}
            onChangeText={setTestApiPattern}
            placeholder='test name pattern, e.g. "issues"'
            placeholderTextColor="#94a3b8"
          />
          <View style={s.inlineRowWrap}>
            {API_TEST_PATTERNS.map((pattern: string) => (
              <AppButton
                key={pattern}
                label={pattern}
                variant="secondary"
                onPress={() => setTestApiPattern(pattern)}
              />
            ))}
            <AppButton label="Clear" variant="secondary" onPress={() => setTestApiPattern("")} />
          </View>
          <AppButton
            label={runningTests.api ? "Running API tests..." : "Run API Tests"}
            disabled={apiTestsBusy || !testApiPattern.trim()}
            onPress={() => handleRunApiTests().catch(() => {})}
          />
          {latestApiTestResult ? (
            <TestResultPanel
              result={latestApiTestResult}
              expanded={showFullApiOutput}
              onToggleExpanded={() => setShowFullApiOutput((c) => !c)}
            />
          ) : null}
        </View>
      </AppCard>
    </View>
  );
}
