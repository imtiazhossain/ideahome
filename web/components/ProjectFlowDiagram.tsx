"use client";

import React from "react";

export interface ProjectFlowDiagramProps {
  visible?: boolean;
}

type FlowGroup = {
  id: string;
  title: string;
  subtitle: string;
  tone: "root" | "shared" | "backend" | "web" | "app" | "api";
  nodes: string[];
};

const FLOW_GROUPS: FlowGroup[] = [
  {
    id: "root",
    title: "pnpm monorepo",
    subtitle: "workspace scripts",
    tone: "root",
    nodes: ["dev:backend", "dev:web", "dev:app", "db:*", "test:e2e*"],
  },
  {
    id: "shared",
    title: "packages/",
    subtitle: "shared contracts",
    tone: "shared",
    nodes: ["shared-config", "shared", "path helpers", "tab exports"],
  },
  {
    id: "backend",
    title: "backend",
    subtitle: "NestJS on :3001",
    tone: "backend",
    nodes: [
      "AppModule",
      "Auth",
      "Projects",
      "Issues",
      "Tests",
      "Expenses",
      "Code",
      "Prisma -> PostgreSQL",
    ],
  },
  {
    id: "web",
    title: "web",
    subtitle: "Next.js on :3000",
    tone: "web",
    nodes: [
      "_app providers",
      "pages: code/finances/tests",
      "lib/api + storage",
      "components + board features",
    ],
  },
  {
    id: "app",
    title: "app",
    subtitle: "React Native client",
    tone: "app",
    nodes: [
      "App.tsx",
      "AppMain / drawer",
      "screens",
      "api/client.ts",
    ],
  },
  {
    id: "api",
    title: "web/pages/api",
    subtitle: "web-side proxy routes",
    tone: "api",
    nodes: ["proxy", "ui-tests", "run-token-audit", "coverage", "code-file"],
  },
];

const FLOW_CONNECTIONS = [
  "shared-config -> shared",
  "shared -> web/lib",
  "shared-config -> app/api client",
  "web -> backend over HTTP + JWT",
  "app -> backend over HTTP + JWT",
  "web API -> backend server routes",
];

export function ProjectFlowDiagram({
  visible = true,
}: ProjectFlowDiagramProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="code-page-project-flow-wrapper">
      <div
        className="code-page-project-flow-diagram"
        aria-label="Project flow diagram"
      >
        <div className="code-page-project-flow-grid">
          {FLOW_GROUPS.map((group) => (
            <section
              key={group.id}
              className={`code-page-project-flow-card tone-${group.tone}`}
            >
              <p className="code-page-project-flow-card-subtitle">
                {group.subtitle}
              </p>
              <h3 className="code-page-project-flow-card-title">
                {group.title}
              </h3>
              <ul className="code-page-project-flow-node-list">
                {group.nodes.map((node) => (
                  <li key={node} className="code-page-project-flow-node">
                    {node}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <section className="code-page-project-flow-links">
          <p className="code-page-project-flow-links-title">Key connections</p>
          <ul className="code-page-project-flow-links-list">
            {FLOW_CONNECTIONS.map((connection) => (
              <li
                key={connection}
                className="code-page-project-flow-links-item"
              >
                {connection}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
