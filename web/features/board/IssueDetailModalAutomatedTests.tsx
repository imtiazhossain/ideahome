import React, { type RefObject } from "react";
import Link from "next/link";
import type { Issue } from "../../lib/api/issues";
import { type RunUiTestResult } from "../../lib/api/tests";
import { uiTests, testNameToSlug } from "../../lib/ui-tests";
import { UiMenuDropdown } from "../../components/UiMenuDropdown";
import { IconX } from "../../components/icons";
import { Text } from "../../components/Text";

export type IssueDetailModalAutomatedTestsProps = {
  selectedIssue: Issue;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  parseAutomatedTestsFn: (s: string | null | undefined) => string[];
  serializeAutomatedTestsFn: (tests: string[]) => string | null;
  automatedTestDropdownRef: RefObject<HTMLDivElement>;
  automatedTestDropdownOpen: boolean;
  setAutomatedTestDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  automatedTestRunResults: Record<string, RunUiTestResult | "running">;
  setAutomatedTestRunResults: React.Dispatch<
    React.SetStateAction<Record<string, RunUiTestResult | "running">>
  >;
  runUiTestFn: (testName: string) => Promise<RunUiTestResult>;
};

export function IssueDetailModalAutomatedTests({
  selectedIssue,
  setSelectedIssue,
  parseAutomatedTestsFn,
  serializeAutomatedTestsFn,
  automatedTestDropdownRef,
  automatedTestDropdownOpen,
  setAutomatedTestDropdownOpen,
  automatedTestRunResults,
  setAutomatedTestRunResults,
  runUiTestFn,
}: IssueDetailModalAutomatedTestsProps) {
  const selectedTests = parseAutomatedTestsFn(selectedIssue.automatedTest);
  const toggleTest = (testName: string) => {
    const next = selectedTests.includes(testName)
      ? selectedTests.filter((t) => t !== testName)
      : [...selectedTests, testName];
    setSelectedIssue({
      ...selectedIssue,
      automatedTest: serializeAutomatedTestsFn(next) ?? "",
    });
  };
  const removeTest = (testName: string) => {
    const next = selectedTests.filter((t) => t !== testName);
    setSelectedIssue({
      ...selectedIssue,
      automatedTest: serializeAutomatedTestsFn(next) ?? "",
    });
  };
  const runTest = async (testName: string) => {
    setAutomatedTestRunResults((prev) => ({
      ...prev,
      [testName]: "running",
    }));
    try {
      const result = await runUiTestFn(testName);
      setAutomatedTestRunResults((prev) => ({
        ...prev,
        [testName]: result,
      }));
    } catch (err) {
      setAutomatedTestRunResults((prev) => ({
        ...prev,
        [testName]: {
          success: false,
          exitCode: null,
          output: "",
          errorOutput:
            err instanceof Error
              ? err.message
              : "Failed to run test",
        },
      }));
    }
  };

  return (
    <div className="form-group issue-modal-field expenses-field">
      <Text as="label" variant="label" tone="accent">Automated Tests</Text>
      <div className="automated-tests-select">
        <UiMenuDropdown
          ref={automatedTestDropdownRef}
          open={automatedTestDropdownOpen}
          onOpenChange={setAutomatedTestDropdownOpen}
          triggerAriaLabel="Select automated tests"
          triggerText={
            selectedTests.length === 0
              ? "Select automated tests…"
              : `${selectedTests.length} test${selectedTests.length === 1 ? "" : "s"} selected`
          }
          closeOnSelect={false}
          multiSelect
          groups={uiTests.flatMap((f) =>
            f.suites.map((suite) => ({
              id: `${f.file}::${suite.name}`,
              label: suite.name,
              items: suite.tests.map((test) => ({
                id: test,
                label: test,
                selected: selectedTests.includes(test),
                onSelect: () => toggleTest(test),
              })),
            }))
          )}
          menuClassName="automated-tests-dropdown"
        />
        {selectedTests.length > 0 && (
          <div className="automated-tests-chips">
            {selectedTests.map((t) => {
              const status = automatedTestRunResults[t];
              const isRunning = status === "running";
              const result =
                typeof status === "object" ? status : null;
              return (
                <span key={t} className="automated-tests-chip">
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
                        onClick={() => runTest(t)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="test-run-control test-run-control--play"
                        onClick={() => runTest(t)}
                        title="Run this test"
                        aria-label={`Run ${t}`}
                      />
                    )}
                  </div>
                  <span className="automated-tests-chip-run">
                    <Link
                      href={`/tests#test-${testNameToSlug(t)}`}
                      className="automated-tests-chip-text"
                      title="Open this test on Tests page"
                    >
                      {t}
                    </Link>
                    {isRunning && (
                      <span
                        className="automated-tests-chip-status"
                        aria-live="polite"
                      >
                        Running…
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="automated-tests-chip-remove"
                    onClick={() => removeTest(t)}
                    aria-label={`Remove ${t}`}
                  >
                    <IconX />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
