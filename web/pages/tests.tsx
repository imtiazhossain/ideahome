import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { getApiBase, runUiTest, type RunUiTestResult } from "../lib/api";
import {
  dedupeStepLines,
  parseStepsFromOutput,
  prefixStepLinesWithDash,
  shortenStepLines,
  stripAnsi,
} from "../lib/playwright-output";
import { AppLayout } from "../components/AppLayout";
import { useProjectLayout } from "../lib/useProjectLayout";
import {
  uiTests as uiTestsInitial,
  testNameToSlug,
  type UITestFile,
} from "../lib/ui-tests"; // Fetched list updates via /api/ui-tests and Refresh button
import { API_TESTS } from "./api-tests"; // Update API_TESTS in pages/api-tests.tsx when adding/renaming backend e2e tests
import { useTheme } from "./_app";

/** Fetch automated UI tests list. Refresh button uses bustCache so the server re-discovers from e2e/*.spec.ts. */
async function fetchUiTestsList(options?: {
  bustCache?: boolean;
}): Promise<UITestFile[]> {
  const url = options?.bustCache
    ? `/api/ui-tests?_=${Date.now()}`
    : "/api/ui-tests";
  const r = await fetch(url, {
    cache: "no-store",
    ...(options?.bustCache && {
      headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
    }),
  });
  if (!r.ok) return uiTestsInitial;
  const data = await r.json();
  return Array.isArray(data) ? data : uiTestsInitial;
}

export default function TestsPage() {
  const router = useRouter();
  const layout = useProjectLayout();
  const {
    projects,
    projectsLoaded,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
  } = layout;
  const { theme, toggleTheme } = useTheme();

  const [uiTestsList, setUiTestsList] = useState<UITestFile[]>(uiTestsInitial);
  const [uiTestsLoading, setUiTestsLoading] = useState(false);

  const [runTestModal, setRunTestModal] = useState<{
    suite: string;
    test: string;
  } | null>(null);
  const [inlineTestResults, setInlineTestResults] = useState<
    Record<string, RunUiTestResult | "running">
  >({});
  const [runTestRunning, setRunTestRunning] = useState(false);
  const [runTestResult, setRunTestResult] = useState<RunUiTestResult | null>(
    null
  );
  const [runTestStreamActive, setRunTestStreamActive] = useState(false);
  const [runTestStreamScreenshots, setRunTestStreamScreenshots] = useState<
    string[]
  >([]);
  const [runTestStreamGifFrame, setRunTestStreamGifFrame] = useState(0);
  const [runTestStreamLog, setRunTestStreamLog] = useState("");
  const [runTestStreamError, setRunTestStreamError] = useState<string | null>(
    null
  );
  const runTestEventSourceRef = useRef<EventSource | null>(null);
  const [viewRunModal, setViewRunModal] = useState<{
    testName: string;
    result: RunUiTestResult;
  } | null>(null);

  const apiTestCount = API_TESTS.reduce((n, s) => n + s.tests.length, 0);
  const uiTestCount = uiTestsList.reduce(
    (n, f) => n + f.suites.reduce((m, s) => m + s.tests.length, 0),
    0
  );

  const loadUiTestsList = React.useCallback(
    async (fromRefreshButton = false) => {
      if (fromRefreshButton) {
        setInlineTestResults({});
        setRunningSuiteKey(null);
        setRunningAllUiTests(false);
      }
      setUiTestsLoading(true);
      try {
        const list = await fetchUiTestsList({ bustCache: fromRefreshButton });
        setUiTestsList(list);
      } finally {
        setUiTestsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadUiTestsList();
  }, [loadUiTestsList]);

  const [collapsedSuites, setCollapsedSuites] = useState<Set<string>>(
    new Set()
  );
  const [runningSuiteKey, setRunningSuiteKey] = useState<string | null>(null);
  const [runningAllUiTests, setRunningAllUiTests] = useState(false);
  const toggleSuite = (key: string) => {
    setCollapsedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const runSuiteTests = async (suiteKey: string, testNames: string[]) => {
    if (runningSuiteKey) return;
    setRunningSuiteKey(suiteKey);
    try {
      for (const testName of testNames) {
        await runInlineTest(testName);
      }
    } finally {
      setRunningSuiteKey(null);
    }
  };

  const runAllUiTests = async () => {
    if (runningSuiteKey || runningAllUiTests) return;
    setRunningAllUiTests(true);
    try {
      for (const file of uiTestsList) {
        for (const suite of file.suites) {
          const suiteKey = `${file.file}-${suite.name}`;
          await runSuiteTests(suiteKey, suite.tests);
        }
      }
    } finally {
      setRunningAllUiTests(false);
    }
  };

  useEffect(() => {
    const frames = runTestStreamScreenshots;
    if (frames.length <= 1 || runTestStreamActive) return;
    const interval = setInterval(() => {
      setRunTestStreamGifFrame((i) => (i + 1) % frames.length);
    }, 200);
    return () => clearInterval(interval);
  }, [runTestStreamScreenshots, runTestStreamActive]);

  const closeRunTestModal = () => {
    runTestEventSourceRef.current?.close();
    runTestEventSourceRef.current = null;
    setRunTestModal(null);
    setRunTestResult(null);
    setRunTestStreamActive(false);
    setRunTestStreamScreenshots([]);
    setRunTestStreamGifFrame(0);
    setRunTestStreamLog("");
    setRunTestStreamError(null);
    setRunTestRunning(false);
  };

  const runInlineTest = async (testName: string) => {
    setInlineTestResults((prev) => ({ ...prev, [testName]: "running" }));
    try {
      const result = await runUiTest(testName);
      setInlineTestResults((prev) => ({ ...prev, [testName]: result }));
    } catch (err) {
      setInlineTestResults((prev) => ({
        ...prev,
        [testName]: {
          success: false,
          exitCode: null,
          output: "",
          errorOutput:
            err instanceof Error ? err.message : "Failed to run test",
        },
      }));
    }
  };

  return (
    <AppLayout
      title="Tests · Idea Home"
      activeTab="tests"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onCreateProject={layout.createProjectByName}
    >
      <div className="tests-page-content">
        <h1 className="tests-page-title">Tests</h1>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            Test Cases{" "}
            <span
              className="tests-page-section-count"
              aria-label="Manual test cases"
            >
              Manual
            </span>
          </h2>
          <p className="tests-page-section-desc">
            Manual test cases are defined on each issue. Open an issue on the
            Board to view and edit its test cases.
          </p>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            API Tests{" "}
            <span
              className="tests-page-section-count"
              aria-label={`${apiTestCount} automated tests`}
            >
              {apiTestCount}
            </span>
          </h2>
          <p className="tests-page-section-desc">
            Run backend e2e API tests and see results.
          </p>
          <Link href="/api-tests" className="tests-page-section-link">
            Open API Tests →
          </Link>
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">
            <span className="tests-page-section-title-text">
              Automated Tests (UI){" "}
              <span
                className="tests-page-section-count"
                aria-label={`${uiTestCount} automated tests`}
              >
                {uiTestCount}
              </span>
            </span>
            <span className="tests-page-section-actions">
              <span className="drawer-nav-suite-run-wrap tests-page-section-run-wrap">
                {runningAllUiTests ? (
                  <span
                    className="test-run-control test-run-control--spinner drawer-nav-suite-run"
                    aria-label="Running all UI tests"
                  />
                ) : (
                  <button
                    type="button"
                    className="test-run-control test-run-control--play drawer-nav-suite-run"
                    onClick={runAllUiTests}
                    title="Run all UI tests"
                    aria-label="Run all UI tests"
                  />
                )}
              </span>
              <button
                type="button"
                className="tests-page-section-refresh"
                onClick={() => loadUiTestsList(true)}
                disabled={uiTestsLoading}
                title="Refresh automated UI tests list"
                aria-label="Refresh automated UI tests list"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={
                    uiTestsLoading
                      ? "tests-page-section-refresh-icon--spin"
                      : undefined
                  }
                >
                  <path d="M23 4v6h-6" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </span>
          </h2>
          <nav className="drawer-nav automated-tests-list">
            {uiTestsList.map((file) => (
              <React.Fragment key={file.file}>
                {file.suites.map((suite) => {
                  const suiteKey = `${file.file}-${suite.name}`;
                  const isCollapsed = collapsedSuites.has(suiteKey);
                  const suiteRunning = runningSuiteKey === suiteKey;
                  const passedCount = suite.tests.filter((name) => {
                    const r = inlineTestResults[name];
                    return typeof r === "object" && r !== null && r.success;
                  }).length;
                  const totalCount = suite.tests.length;
                  return (
                    <React.Fragment key={suite.name}>
                      <div className="drawer-nav-suite drawer-nav-suite--header">
                        <button
                          type="button"
                          className={`drawer-nav-suite-toggle ${isCollapsed ? "is-collapsed" : ""}`}
                          onClick={() => toggleSuite(suiteKey)}
                          aria-expanded={!isCollapsed}
                          aria-controls={`suite-tests-${suiteKey.replace(/[^a-z0-9-]/gi, "-")}`}
                        >
                          <span
                            className="drawer-nav-suite-chevron"
                            aria-hidden
                          >
                            ▼
                          </span>
                          <span className="drawer-nav-suite-title">
                            <span className="drawer-nav-suite-label">
                              {suite.name}
                            </span>
                            <span
                              className="drawer-nav-suite-count"
                              aria-label={`${passedCount} of ${totalCount} tests passed`}
                            >
                              {passedCount} / {totalCount}
                            </span>
                          </span>
                        </button>
                        <div className="drawer-nav-suite-run-wrap">
                          {suiteRunning ? (
                            <span
                              className="test-run-control test-run-control--spinner drawer-nav-suite-run"
                              aria-label="Running suite"
                            />
                          ) : (
                            <button
                              type="button"
                              className="test-run-control test-run-control--play drawer-nav-suite-run"
                              onClick={(e) => {
                                e.stopPropagation();
                                runSuiteTests(suiteKey, suite.tests);
                              }}
                              title={`Run all ${suite.tests.length} tests in ${suite.name}`}
                              aria-label={`Run all tests in ${suite.name}`}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        id={`suite-tests-${suiteKey.replace(/[^a-z0-9-]/gi, "-")}`}
                        className="drawer-nav-suite-content"
                        hidden={isCollapsed}
                      >
                        {suite.tests.map((testName) => {
                          const status = inlineTestResults[testName];
                          const isRunning = status === "running";
                          const result =
                            typeof status === "object" ? status : null;
                          const canViewRun = result && !result.success;
                          return (
                            <div
                              key={testName}
                              id={`test-${testNameToSlug(testName)}`}
                              className="automated-test-row"
                            >
                              <div className="test-run-control-wrap">
                                {isRunning ? (
                                  <span
                                    className="test-run-control test-run-control--spinner"
                                    aria-label="Running"
                                  />
                                ) : result ? (
                                  <button
                                    type="button"
                                    className={`test-run-control test-run-control--${result.success ? "pass" : "fail"}`}
                                    title={
                                      result.success
                                        ? "Passed (click to run again)"
                                        : "Failed (click to run again)"
                                    }
                                    aria-label={
                                      result.success ? "Passed" : "Failed"
                                    }
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      runInlineTest(testName);
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="test-run-control test-run-control--play"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      runInlineTest(testName);
                                    }}
                                    title="Run this test"
                                    aria-label={`Run ${testName}`}
                                  />
                                )}
                              </div>
                              <button
                                type="button"
                                className="drawer-nav-item drawer-nav-item-text automated-test-name-btn"
                                onClick={() =>
                                  setRunTestModal({
                                    suite: suite.name,
                                    test: testName,
                                  })
                                }
                                title="Run this test (opens modal). Select text to copy."
                              >
                                {testName}
                              </button>
                              <button
                                type="button"
                                className="automated-test-name-copy"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void navigator.clipboard.writeText(testName);
                                }}
                                title="Copy test name"
                                aria-label="Copy test name"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden
                                >
                                  <rect
                                    x="9"
                                    y="9"
                                    width="13"
                                    height="13"
                                    rx="2"
                                    ry="2"
                                  />
                                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              </button>
                              {canViewRun && (
                                <button
                                  type="button"
                                  className="tests-view-run-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewRunModal({ testName, result });
                                  }}
                                  title="View recording and console output"
                                >
                                  View run
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </nav>
        </section>
      </div>

      {runTestModal && (
        <div className="modal-overlay" onClick={closeRunTestModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth:
                runTestStreamActive ||
                runTestStreamScreenshots.length > 0 ||
                runTestResult?.videoBase64
                  ? 720
                  : 560,
            }}
          >
            <div className="modal-header">
              <h2>Run automated test</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeRunTestModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
              {runTestModal.suite}
            </p>
            <p
              style={{
                margin: "0 0 16px",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              {runTestModal.test}
            </p>
            {(runTestStreamActive ||
              runTestStreamScreenshots.length > 0 ||
              runTestResult?.videoBase64) && (
              <div
                className="run-test-browser-view"
                style={{
                  marginBottom: 16,
                  minHeight: 320,
                  background: "var(--column-bg)",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border, #e2e8f0)",
                }}
              >
                <div
                  style={{
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                    }}
                  >
                    Test run
                  </p>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 240,
                      background: "var(--bg-page)",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {runTestResult?.videoBase64 ? (
                      <video
                        src={`data:video/webm;base64,${runTestResult.videoBase64}`}
                        controls
                        loop
                        playsInline
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : runTestStreamScreenshots.length > 0 ? (
                      <img
                        key={
                          runTestStreamActive
                            ? runTestStreamScreenshots.length
                            : runTestStreamGifFrame
                        }
                        src={`data:image/jpeg;base64,${
                          runTestStreamScreenshots[
                            runTestStreamActive
                              ? runTestStreamScreenshots.length - 1
                              : Math.min(
                                  runTestStreamGifFrame,
                                  runTestStreamScreenshots.length - 1
                                )
                          ] ?? ""
                        }`}
                        alt="Test run recording"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : runTestStreamActive ? (
                      <span
                        style={{ color: "var(--text-muted)", fontSize: 13 }}
                      >
                        Recording video…
                      </span>
                    ) : runTestResult ? (
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontSize: 13,
                          textAlign: "center",
                          padding: 16,
                        }}
                      >
                        No recording. Click &quot;Run with live view&quot; again
                        (backend must be running).
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
            {runTestStreamError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(197, 48, 48, 0.1)",
                  borderRadius: 8,
                  border: "1px solid var(--danger, #c53030)",
                }}
              >
                <p style={{ margin: 0, fontSize: 13 }}>{runTestStreamError}</p>
              </div>
            )}
            {runTestResult && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: runTestResult.success
                    ? "rgba(54, 179, 126, 0.12)"
                    : "rgba(197, 48, 48, 0.1)",
                  borderRadius: 8,
                  border: `1px solid ${runTestResult.success ? "var(--done)" : "var(--danger, #c53030)"}`,
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>
                  {runTestResult.success ? "Test passed" : "Test failed"}
                  {runTestResult.exitCode != null &&
                    ` (exit ${runTestResult.exitCode})`}
                </p>
                {(() => {
                  const rawOutput = [
                    runTestResult.output,
                    runTestResult.errorOutput,
                  ]
                    .filter(Boolean)
                    .join("\n");
                  const fullOutput = prefixStepLinesWithDash(
                    dedupeStepLines(shortenStepLines(stripAnsi(rawOutput)))
                  );
                  const stepsFromApi = runTestResult.steps ?? [];
                  const stepsFromOutput = parseStepsFromOutput(fullOutput);
                  const steps =
                    stepsFromApi.length > 0
                      ? stepsFromApi.map((s) =>
                          s.duration != null
                            ? `${s.title} (${s.duration}ms)`
                            : s.title
                        )
                      : stepsFromOutput;
                  return (
                    <>
                      {steps.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                            }}
                          >
                            Steps (what the test did)
                          </p>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 20,
                              fontSize: 12,
                              lineHeight: 1.6,
                              maxHeight: 160,
                              overflowY: "auto",
                              overflowX: "hidden",
                            }}
                          >
                            {steps.map((step, i) => (
                              <li
                                key={i}
                                style={{
                                  marginBottom: 2,
                                  wordBreak: "break-word",
                                }}
                              >
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    marginRight: 6,
                                  }}
                                >
                                  {i + 1}.
                                </span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          background: "var(--bg-page)",
                          borderRadius: 6,
                          fontSize: 12,
                          height: 220,
                          maxHeight: 220,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {fullOutput}
                      </pre>
                    </>
                  );
                })()}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeRunTestModal}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={runTestRunning}
                onClick={() => {
                  if (runTestRunning) return;
                  runTestEventSourceRef.current?.close();
                  runTestEventSourceRef.current = null;
                  setRunTestResult(null);
                  setRunTestStreamError(null);
                  setRunTestStreamLog("");
                  setRunTestStreamScreenshots([]);
                  setRunTestStreamGifFrame(0);
                  setRunTestRunning(true);
                  setRunTestStreamActive(true);
                  const url = `${getApiBase()}/tests/run-ui-stream?grep=${encodeURIComponent(runTestModal.test)}`;
                  const es = new EventSource(url);
                  runTestEventSourceRef.current = es;
                  let gotResult = false;
                  es.onmessage = (e) => {
                    try {
                      const raw = e.data;
                      const d = typeof raw === "string" ? JSON.parse(raw) : raw;
                      if (d.type === "screenshot")
                        setRunTestStreamScreenshots((prev) => [
                          ...prev,
                          d.data,
                        ]);
                      else if (d.type === "log")
                        setRunTestStreamLog((prev) => prev + d.data);
                      else if (d.type === "result") {
                        gotResult = true;
                        setRunTestResult(d.data);
                        setRunTestStreamActive(false);
                        setRunTestRunning(false);
                        es.close();
                        runTestEventSourceRef.current = null;
                      } else if (d.type === "error") {
                        setRunTestStreamError(d.data);
                        setRunTestResult({
                          success: false,
                          exitCode: null,
                          output: "",
                          errorOutput: d.data,
                        });
                        setRunTestStreamActive(false);
                        setRunTestRunning(false);
                        es.close();
                        runTestEventSourceRef.current = null;
                      }
                    } catch {
                      // ignore
                    }
                  };
                  es.onerror = () => {
                    es.close();
                    runTestEventSourceRef.current = null;
                    setRunTestStreamActive(false);
                    setRunTestRunning(false);
                    if (!gotResult) {
                      const apiBase =
                        typeof getApiBase === "function"
                          ? getApiBase() || window.location.origin
                          : "http://localhost:3001";
                      setRunTestStreamError(
                        "Connection lost. Start the backend (pnpm dev:backend from repo root) and ensure it is reachable at " +
                          apiBase +
                          ". Run pnpm install in the web app if Playwright is missing."
                      );
                    }
                  };
                }}
              >
                {runTestRunning ? "Running…" : "Run with live view"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewRunModal && (
        <div
          className="modal-overlay modal-overlay--scrollable"
          onClick={() => setViewRunModal(null)}
        >
          <div
            className="modal modal--fit-screen"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: viewRunModal.result.videoBase64 ? 720 : 560,
            }}
          >
            <div className="modal-header">
              <h2>Test run: {viewRunModal.testName}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setViewRunModal(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="modal-body modal-body--scrollable">
              {viewRunModal.result.videoBase64 ? (
                <div
                  className="run-test-browser-view"
                  style={{
                    marginBottom: 16,
                    minHeight: 120,
                    background: "var(--column-bg)",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid var(--border, #e2e8f0)",
                  }}
                >
                  <div style={{ padding: 8 }}>
                    <p
                      style={{
                        margin: "0 0 6px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-muted)",
                      }}
                    >
                      Recording
                    </p>
                    <video
                      src={`data:video/webm;base64,${viewRunModal.result.videoBase64}`}
                      controls
                      loop
                      playsInline
                      style={{
                        width: "100%",
                        maxHeight: "min(360px, 45vh)",
                        objectFit: "contain",
                        background: "var(--bg-page)",
                        borderRadius: 6,
                      }}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              ) : (
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                  }}
                >
                  No recording for this run.
                </p>
              )}
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: "rgba(197, 48, 48, 0.1)",
                  borderRadius: 8,
                  border: "1px solid var(--danger, #c53030)",
                }}
              >
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>
                  Test output
                </p>
                {(() => {
                  const rawOutput =
                    [
                      viewRunModal.result.output,
                      viewRunModal.result.errorOutput,
                    ]
                      .filter(Boolean)
                      .join("\n") || "No output";
                  const fullOutput =
                    rawOutput === "No output"
                      ? rawOutput
                      : prefixStepLinesWithDash(
                          dedupeStepLines(
                            shortenStepLines(stripAnsi(rawOutput))
                          )
                        );
                  const stepsFromApi = viewRunModal.result.steps ?? [];
                  const stepsFromOutput = parseStepsFromOutput(fullOutput);
                  const steps =
                    stepsFromApi.length > 0
                      ? stepsFromApi.map((s) =>
                          s.duration != null
                            ? `${s.title} (${s.duration}ms)`
                            : s.title
                        )
                      : stepsFromOutput;
                  return (
                    <>
                      {steps.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <p
                            style={{
                              margin: "0 0 6px",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-muted)",
                            }}
                          >
                            Steps (what the test did)
                          </p>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 20,
                              fontSize: 12,
                              lineHeight: 1.6,
                              maxHeight: 200,
                              overflowY: "auto",
                              overflowX: "hidden",
                            }}
                          >
                            {steps.map((step, i) => (
                              <li
                                key={i}
                                style={{
                                  marginBottom: 2,
                                  wordBreak: "break-word",
                                }}
                              >
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    marginRight: 6,
                                  }}
                                >
                                  {i + 1}.
                                </span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <pre
                        style={{
                          margin: 0,
                          padding: 10,
                          background: "var(--bg-page)",
                          borderRadius: 6,
                          fontSize: 12,
                          height: 280,
                          maxHeight: 280,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        {fullOutput}
                      </pre>
                    </>
                  );
                })()}
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setViewRunModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
