import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  getTokenUsageHistory,
  clearTokenUsageHistory,
  generatePromptSuggestion,
  type TokenUsageEntry,
} from "../lib/tokenUsageHistory";

export function TokenUsageGraph({
  collapsed,
  onToggle,
  dragHandle,
}: {
  collapsed: boolean;
  onToggle: () => void;
  dragHandle: React.ReactNode;
}) {
  const [entries, setEntries] = useState<TokenUsageEntry[]>([]);

  const refreshEntries = useCallback(() => {
    setEntries(getTokenUsageHistory());
  }, []);

  useEffect(() => {
    refreshEntries();
    const handler = () => refreshEntries();
    window.addEventListener("ideahome-token-usage-updated", handler);
    return () =>
      window.removeEventListener("ideahome-token-usage-updated", handler);
  }, [refreshEntries]);

  // Show most recent 20 prompts
  const visible = useMemo(() => entries.slice(-20), [entries]);
  const maxTokens = useMemo(
    () => Math.max(1, ...visible.map((e) => e.totalTokens)),
    [visible]
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedEntry =
    selectedIndex != null ? visible[selectedIndex] ?? null : null;

  const handleClear = useCallback(() => {
    clearTokenUsageHistory();
    setSelectedIndex(null);
  }, []);

  return (
    <CollapsibleSection
      sectionId="code-token-usage"
      title="Prompt Token Usage Tracker"
      collapsed={collapsed}
      onToggle={onToggle}
      sectionClassName="code-page-body-section"
      headingId="code-page-token-usage-heading"
      headerTrailing={dragHandle}
    >
      <p className="code-page-repos-copy">
        Real-time prompt-by-prompt token usage from Bulby chat (Model:
        Antigravity). Click any bar for details and efficiency suggestions.
      </p>

      {visible.length === 0 ? (
        <div
          style={{
            padding: "2rem 1rem",
            textAlign: "center",
            color: "var(--color-text-secondary)",
            fontSize: "0.9rem",
          }}
        >
          No prompts recorded yet. Send a message to Bulby to start tracking
          token usage.
        </div>
      ) : (
        <>
          {/* Chart */}
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "var(--color-bg-secondary)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                height: "180px",
                gap: "4px",
                paddingBottom: "1rem",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {visible.map((entry, i) => {
                const inputPct = (entry.promptTokens / maxTokens) * 100;
                const outputPct = (entry.completionTokens / maxTokens) * 100;
                const isSelected = selectedIndex === i;
                return (
                  <div
                    key={entry.id}
                    onClick={() =>
                      setSelectedIndex(isSelected ? null : i)
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      flex: 1,
                      height: "100%",
                      gap: "1px",
                      cursor: "pointer",
                      opacity: isSelected ? 1 : 0.75,
                      transition: "opacity 0.15s ease",
                      minWidth: 0,
                    }}
                    title={`#${i + 1}: ${entry.promptTokens} in / ${entry.completionTokens} out`}
                  >
                    <div
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255, 180, 60, 0.9)"
                          : "rgba(100, 150, 255, 0.8)",
                        height: `${outputPct}%`,
                        width: "100%",
                        borderRadius: "3px 3px 0 0",
                        transition: "height 0.3s ease, background-color 0.15s ease",
                        minHeight: outputPct > 0 ? "2px" : 0,
                      }}
                    />
                    <div
                      style={{
                        backgroundColor: isSelected
                          ? "rgba(255, 180, 60, 0.5)"
                          : "rgba(100, 150, 255, 0.4)",
                        height: `${inputPct}%`,
                        width: "100%",
                        borderRadius: "0 0 3px 3px",
                        transition: "height 0.3s ease, background-color 0.15s ease",
                        minHeight: inputPct > 0 ? "2px" : 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: "0.6rem",
                        color: "var(--color-text-secondary)",
                        textAlign: "center",
                        marginTop: "4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.75rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  fontSize: "0.8rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: "rgba(100, 150, 255, 0.4)",
                      borderRadius: "2px",
                    }}
                  />
                  Input
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      backgroundColor: "rgba(100, 150, 255, 0.8)",
                      borderRadius: "2px",
                    }}
                  />
                  Output
                </div>
              </div>
              <button
                type="button"
                className="code-page-run-btn"
                style={{ fontSize: "0.75rem", padding: "4px 10px" }}
                onClick={handleClear}
              >
                Clear history
              </button>
            </div>
          </div>

          {/* Selected prompt detail */}
          {selectedEntry && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                backgroundColor: "var(--color-bg-secondary)",
                borderRadius: "8px",
                borderLeft: "3px solid rgba(255, 180, 60, 0.8)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  marginBottom: "0.5rem",
                  fontFamily: "monospace",
                }}
              >
                Prompt #{(selectedIndex ?? 0) + 1} ·{" "}
                {new Date(selectedEntry.timestamp).toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--color-bg-primary, var(--bg))",
                  borderRadius: "6px",
                  maxHeight: "80px",
                  overflow: "auto",
                  marginBottom: "0.75rem",
                  fontStyle: "italic",
                  color: "var(--color-text-secondary)",
                }}
              >
                &ldquo;
                {selectedEntry.promptText.length > 200
                  ? selectedEntry.promptText.slice(0, 200) + "…"
                  : selectedEntry.promptText}
                &rdquo;
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "1.5rem",
                  fontSize: "0.8rem",
                  fontFamily: "monospace",
                  marginBottom: "0.75rem",
                }}
              >
                <span>⬆ {selectedEntry.promptTokens} input</span>
                <span>⬇ {selectedEntry.completionTokens} output</span>
                <span>Σ {selectedEntry.totalTokens} total</span>
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  padding: "0.6rem 0.75rem",
                  backgroundColor: "rgba(100, 150, 255, 0.08)",
                  borderRadius: "6px",
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ fontSize: "0.75rem" }}>💡 Suggestion:</strong>{" "}
                {generatePromptSuggestion(selectedEntry)}
              </div>
            </div>
          )}
        </>
      )}

      {/* General tips */}
      <div style={{ marginTop: "2rem" }}>
        <h4
          style={{ fontSize: "1rem", marginBottom: "1rem", fontWeight: "600" }}
        >
          How to Increase Prompt Efficiency
        </h4>
        <ul
          style={{
            listStyle: "disc",
            paddingLeft: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            color: "var(--color-text-secondary)",
          }}
        >
          <li>
            <strong>Be Specific and Contextual:</strong> Isolate the exact
            component instead of uploading entire files.
          </li>
          <li>
            <strong>Lead with the Objective:</strong> Start with &quot;Write a
            React function that…&quot; rather than giving context first.
          </li>
          <li>
            <strong>Limit Output Scope:</strong> Say{" "}
            <em>&quot;Show only the modified lines&quot;</em> to avoid verbose
            responses.
          </li>
          <li>
            <strong>Reference, Don&apos;t Repeat:</strong> Point to rule files
            or docs the agent already has access to.
          </li>
          <li>
            <strong>Skip Filler Words:</strong> &quot;Fix the login
            bug&quot; uses fewer tokens than &quot;Could you please fix the
            login bug for me?&quot;
          </li>
        </ul>
      </div>
    </CollapsibleSection>
  );
}
