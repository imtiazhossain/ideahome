import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";

export default function CoveragePage() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  async function runCoverage() {
    setRunning(true);
    setOutput(null);
    setSuccess(null);
    setReportCopied(false);
    setReportUrl(null);
    try {
      const res = await fetch("/api/run-coverage", { method: "POST" });
      const data = await res.json();
      setOutput(data.output ?? "");
      setSuccess(data.ok === true);
      const copied = data.reportCopied === true || data.ok === true;
      setReportCopied(copied);
      if (copied) {
        setReportUrl("/coverage-report/index.html?t=" + Date.now());
      } else {
        setReportUrl(null);
      }
    } catch (err) {
      setOutput(err instanceof Error ? err.message : String(err));
      setSuccess(false);
      setReportCopied(false);
      setReportUrl(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Head>
        <title>Code Health · IdeaHome</title>
      </Head>
      <div className="coverage-page">
        <header className="coverage-page-header">
          <Link href="/" className="coverage-page-back">
            ← Back to IdeaHome
          </Link>
          <h1 className="coverage-page-title">Code Health</h1>
          <div className="coverage-page-actions">
            <button
              type="button"
              className="coverage-page-run-btn"
              onClick={runCoverage}
              disabled={running}
            >
              {running ? "Running…" : "Run coverage"}
            </button>
          </div>
          {output !== null && (
            <div
              className={`coverage-page-output ${success === true ? "coverage-page-output--success" : "coverage-page-output--error"}`}
            >
              <button
                type="button"
                className="coverage-page-output-close"
                onClick={() => setOutput(null)}
                aria-label="Close"
              >
                ×
              </button>
              <pre className="coverage-page-output-pre">{output}</pre>
            </div>
          )}
        </header>
        <div className="coverage-page-frame-wrap">
          {reportUrl === null && output === null && (
            <div className="coverage-page-frame-placeholder" aria-live="polite">
              Run coverage above to see the report chart.
            </div>
          )}
          {output !== null && success === false && !reportCopied && (
            <div className="coverage-page-frame-placeholder" aria-live="polite">
              No coverage report — run failed. Fix errors above and run again.
            </div>
          )}
          <iframe
            key={reportUrl ?? "blank"}
            src={reportUrl ?? "about:blank"}
            title="Code coverage report"
            className="coverage-page-frame"
          />
        </div>
      </div>
    </>
  );
}
