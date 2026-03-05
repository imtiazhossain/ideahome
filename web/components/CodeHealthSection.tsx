import React, { useState } from "react";
import { CloseButton } from "./CloseButton";

/**
 * Code Health (coverage) section: run Jest coverage and show report iframe.
 * Used inside the Code page as a collapsible section.
 */
export function CodeHealthSection() {
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputMinimized, setOutputMinimized] = useState(false);
  const [success, setSuccess] = useState<boolean | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  async function runCoverage() {
    setRunning(true);
    setOutput(null);
    setOutputMinimized(false);
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
    <div className="code-health-section coverage-page">
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
          className={`coverage-page-output ${success === true ? "coverage-page-output--success" : "coverage-page-output--error"}${outputMinimized ? " coverage-page-output--minimized" : ""}`}
        >
          <div className="coverage-page-output-header">
            <p className="coverage-page-output-title">Coverage output</p>
            <div className="coverage-page-output-actions">
              <button
                type="button"
                className="coverage-page-output-toggle"
                onClick={() => setOutputMinimized((prev) => !prev)}
                aria-expanded={!outputMinimized}
              >
                {outputMinimized ? "Expand" : "Minimize"}
              </button>
              <CloseButton
                className="coverage-page-output-close"
                size="sm"
                onClick={() => setOutput(null)}
              />
            </div>
          </div>
          {outputMinimized ? (
            <p className="coverage-page-output-minimized-note">Output hidden.</p>
          ) : (
            <pre className="coverage-page-output-pre">{output}</pre>
          )}
        </div>
      )}
      {running && (
        <div className="coverage-page-frame-placeholder" aria-live="polite">
          Running coverage...
        </div>
      )}
      {!running && reportUrl === null && output === null && (
        <div className="coverage-page-frame-placeholder" aria-live="polite">
          Run coverage above to see the report chart.
        </div>
      )}
      {output !== null && success === false && !reportCopied && (
        <div className="coverage-page-frame-placeholder" aria-live="polite">
          No coverage report — run failed. Fix errors above and run again.
        </div>
      )}
      {reportUrl !== null && (
        <div className="coverage-page-frame-wrap">
          <iframe
            key={reportUrl}
            src={reportUrl}
            title="Code coverage report"
            className="coverage-page-frame"
          />
        </div>
      )}
    </div>
  );
}
