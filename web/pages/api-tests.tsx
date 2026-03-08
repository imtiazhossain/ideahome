import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { getApiBase, runApiTest, type RunApiTestResult } from "../lib/api";
import { API_TESTS } from "@ideahome/shared-config/api-tests";

export { API_TESTS };

export default function ApiTestsPage() {
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunApiTestResult>>({});

  async function runTest(testName: string) {
    setRunningTest(testName);
    try {
      const data = await runApiTest(testName);
      setResults((prev) => ({ ...prev, [testName]: data }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [testName]: {
          success: false,
          exitCode: null,
          output: "",
          errorOutput:
            err instanceof Error ? err.message : "Failed to run test",
        },
      }));
    } finally {
      setRunningTest(null);
    }
  }

  return (
    <>
      <Head>
        <title>API Tests · Idea Home</title>
      </Head>
      <div className="api-tests-page">
        <header className="api-tests-page-header">
          <Link href="/" className="api-tests-page-back">
            ← Back to Idea Home
          </Link>
          <h1 className="api-tests-page-title">API Tests</h1>
        </header>
        <div className="api-tests-page-content">
          <div className="api-tests-page-list">
            {API_TESTS.map(({ suite, tests }) => (
              <React.Fragment key={suite}>
                <h2 className="api-tests-page-suite">{suite}</h2>
                <ul className="api-tests-page-tests">
                  {tests.map((testName) => {
                    const result = results[testName];
                    const running = runningTest === testName;
                    return (
                      <li key={testName} className="api-tests-page-test-wrap">
                        <div className="api-tests-page-test">
                          <div className="test-run-control-wrap">
                            {running ? (
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
                                onClick={() => runTest(testName)}
                                disabled={runningTest !== null}
                              />
                            ) : (
                              <button
                                type="button"
                                className="test-run-control test-run-control--play"
                                onClick={() => runTest(testName)}
                                disabled={runningTest !== null}
                                title="Run This Test"
                                aria-label={`Run ${testName}`}
                              />
                            )}
                          </div>
                          <span className="api-tests-page-test-name">
                            {testName}
                          </span>
                        </div>
                        {running && (
                          <div className="api-tests-page-result api-tests-page-result--running">
                            Running…
                          </div>
                        )}
                        {result && !running && (
                          <div
                            className={`api-tests-page-result ${
                              result.success
                                ? "api-tests-page-result--success"
                                : "api-tests-page-result--error"
                            }`}
                          >
                            <span
                              className={`api-tests-page-result-status ${
                                result.success
                                  ? "api-tests-page-result-status--pass"
                                  : "api-tests-page-result-status--fail"
                              }`}
                            >
                              {result.success ? "Passed" : "Failed"}
                              {result.exitCode != null &&
                                ` (exit ${result.exitCode})`}
                            </span>
                            <div className="api-tests-page-result-json">
                              <span className="api-tests-page-result-json-label">
                                Request
                              </span>
                              <pre className="api-tests-page-result-pre">
                                {[
                                  `POST ${getApiBase()}/tests/run-api`,
                                  "Content-Type: application/json",
                                  "",
                                  JSON.stringify(
                                    { testNamePattern: testName },
                                    null,
                                    2
                                  ),
                                ].join("\n")}
                              </pre>
                            </div>
                            <div className="api-tests-page-result-json">
                              <span className="api-tests-page-result-json-label">
                                Response
                              </span>
                              <pre className="api-tests-page-result-pre">
                                {JSON.stringify(result, null, 2)}
                              </pre>
                            </div>
                            {(result.output || result.errorOutput) && (
                              <pre className="api-tests-page-result-pre">
                                {[result.output, result.errorOutput]
                                  .filter(Boolean)
                                  .join("\n")}
                              </pre>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
