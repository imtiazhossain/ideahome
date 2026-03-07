import React, { useMemo } from "react";
import { CollapsibleSection } from "./CollapsibleSection";

export function TokenUsageGraph({
  collapsed,
  onToggle,
  dragHandle,
}: {
  collapsed: boolean;
  onToggle: () => void;
  dragHandle: React.ReactNode;
}) {
  // Mock data for token usage over the past 7 days
  const data = useMemo(
    () => [
      { day: "Mon", input: 12000, output: 4500 },
      { day: "Tue", input: 8500, output: 3000 },
      { day: "Wed", input: 15400, output: 5200 },
      { day: "Thu", input: 11000, output: 4800 },
      { day: "Fri", input: 22000, output: 8500 },
      { day: "Sat", input: 4500, output: 1200 },
      { day: "Sun", input: 7000, output: 2500 },
    ],
    []
  );

  const maxTokens = Math.max(...data.map((d) => d.input + d.output));

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
        Monitor your AI coding assistant prompt token usage (Model: Antigravity). By making prompts more
        efficient, you reduce cost and improve latency.
      </p>

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
            height: "200px",
            gap: "1rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {data.map((d, i) => {
            const inputHeight = `${(d.input / maxTokens) * 100}%`;
            const outputHeight = `${(d.output / maxTokens) * 100}%`;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  flex: 1,
                  height: "100%",
                  gap: "2px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "rgba(100, 150, 255, 0.8)",
                    height: outputHeight,
                    width: "100%",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s ease",
                  }}
                  title={`Output: ${d.output} tokens`}
                />
                <div
                  style={{
                    backgroundColor: "rgba(100, 150, 255, 0.4)",
                    height: inputHeight,
                    width: "100%",
                    borderRadius: "0 0 4px 4px",
                    transition: "height 0.3s ease",
                  }}
                  title={`Input: ${d.input} tokens`}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-secondary)",
                    textAlign: "center",
                    marginTop: "0.5rem",
                  }}
                >
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "var(--color-text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: "rgba(100, 150, 255, 0.4)",
                borderRadius: "2px",
              }}
            />
            Input Tokens (Prompt)
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                backgroundColor: "rgba(100, 150, 255, 0.8)",
                borderRadius: "2px",
              }}
            />
            Output Tokens (Response)
          </div>
        </div>
      </div>

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
            <strong>Be Specific and Contextual:</strong> Before making a broad
            query, isolate the exact component. Don't upload an entire file if
            you only need help with one function.
          </li>
          <li>
            <strong>Provide Clear Objectives upfront:</strong> Start with "Write
            a React function that sorts an array" rather than giving context
            first. Let the agent know the immediate goal to avoid meandering
            reasoning steps.
          </li>
          <li>
            <strong>Limit Output Scope:</strong> If you only need a snippet,
            state <em>"Show only the modified lines of code"</em> or{" "}
            <em>"Do not explain the code, just provide the implementation."</em>
          </li>
          <li>
            <strong>Reference Existing Knowledge:</strong> Instead of re-pasting
            rules inside your prompt, point the agent to specific rule files or
            docs if it already has access to them.
          </li>
        </ul>
      </div>
    </CollapsibleSection>
  );
}
