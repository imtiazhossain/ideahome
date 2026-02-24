import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { getApiBase, runApiTest, type RunApiTestResult } from "../lib/api";

/**
 * List of backend e2e API tests for the Tests section and this page.
 * Update when adding or renaming tests in backend/test/*.e2e-spec.ts (test names must match exactly).
 */
export const API_TESTS: { suite: string; tests: string[] }[] = [
  { suite: "AppController (e2e)", tests: ["GET / returns health status"] },
  { suite: "UsersController (e2e)", tests: ["GET /users returns list"] },
  {
    suite: "OrganizationsController (e2e)",
    tests: [
      "GET /organizations returns list",
      "POST /organizations creates an organization",
    ],
  },
  {
    suite: "ProjectsController (e2e)",
    tests: [
      "GET /projects returns list",
      "GET /projects?orgId= returns list filtered by org",
      "POST /projects creates a project",
      "GET /projects/:id returns a project",
      "PUT /projects/:id updates",
      "DELETE /projects/:id deletes project and its issues",
      "GET /projects/:id after delete returns 404",
    ],
  },
  {
    suite: "IssuesController (e2e)",
    tests: [
      "GET /issues returns list",
      "GET /issues?projectId= returns list filtered by project",
      "POST /issues creates an issue",
      "GET /issues/:id returns an issue",
      "PUT /issues/:id updates (no auth required)",
      "PUT /issues/:id persists automatedTest as JSON array",
      "POST /issues creates an issue with automatedTest",
      "PUT /issues/:id with token also updates",
      "PATCH /issues/:id/status persists status (for lane moves)",
      "DELETE /issues/:id deletes (no auth required)",
      "GET /issues/:id after delete returns 404",
    ],
  },
];

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
                                title="Run this test"
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
