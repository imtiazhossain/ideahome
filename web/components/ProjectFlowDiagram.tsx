"use client";

import React, { useEffect, useRef, useState } from "react";

export interface ProjectFlowDiagramProps {
  /** When true, the diagram is rendered (section expanded). */
  visible?: boolean;
}

const PROJECT_FLOW_MERMAID = `
flowchart TB
  subgraph ROOT["pnpm monorepo"]
    ROOT_SCRIPTS["dev:backend, dev:web, dev:app, db:*, test:e2e*"]
  end

  subgraph PACKAGES["packages/"]
    SHARED_CONFIG["shared-config: types, path helpers, constants"]
    SHARED["shared: re-exports + tabs"]
  end

  subgraph BACKEND["backend (NestJS :3001)"]
    APP_MOD["AppModule"]
    APP_MOD --> AUTH_M["Auth"]
    APP_MOD --> PROJ_M["Projects"]
    APP_MOD --> ISSUES_M["Issues"]
    APP_MOD --> USERS_M["Users"]
    APP_MOD --> ORGS_M["Organizations"]
    APP_MOD --> TESTS_M["Tests"]
    APP_MOD --> TODOS_M["Todos"]
    APP_MOD --> IDEAS_M["Ideas"]
    APP_MOD --> BUGS_M["Bugs"]
    APP_MOD --> FEATURES_M["Features"]
    APP_MOD --> EXPENSES_M["Expenses"]
    APP_MOD --> PLAID_M["Plaid"]
    APP_MOD --> CODE_M["Code"]
    PRISMA["PrismaService"]
    AUTH_M --> PRISMA
    PROJ_M --> PRISMA
    ISSUES_M --> PRISMA
    USERS_M --> PRISMA
    ORGS_M --> PRISMA
    TESTS_M --> PRISMA
    TODOS_M --> PRISMA
    IDEAS_M --> PRISMA
    BUGS_M --> PRISMA
    FEATURES_M --> PRISMA
    EXPENSES_M --> PRISMA
    PLAID_M --> PRISMA
    CODE_M --> PRISMA
    PRISMA --> PG["PostgreSQL"]
  end

  subgraph WEB["web (Next.js :3000)"]
    APP["_app: Theme, SelectedProject, TabOrder"]
    PAGES["pages: index, code, finances, tests, coverage, list, login, mobile-app"]
    LIB["lib: api.ts, storage, api/"]
    COMP["components + features/board"]
    APP --> PAGES
    PAGES --> LIB
    COMP --> LIB
  end

  subgraph APP_RN["app (React Native)"]
    APP_TSX["App.tsx, useAppState"]
    APP_MAIN["AppMain, AppDrawer, AppTabContent"]
    SCREENS["screens: Home, Issues, Projects, Expenses, Tests, CustomList, Settings"]
    CLIENT["api/client.ts"]
    APP_TSX --> APP_MAIN
    APP_MAIN --> SCREENS
    SCREENS --> CLIENT
  end

  subgraph WEB_API["web/pages/api"]
    PROXY["proxy, ui-tests, run-token-audit, coverage, code-file"]
  end

  SHARED_CONFIG --> SHARED
  SHARED --> LIB
  SHARED_CONFIG --> CLIENT
  LIB -->|"HTTP + JWT"| BACKEND
  CLIENT -->|"HTTP + JWT"| BACKEND
  WEB_API -->|"server"| BACKEND
`;

export function ProjectFlowDiagram({ visible = true }: ProjectFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !visible) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    cancelledRef.current = false;
    const container = containerRef.current;
    const run = () => {
      runMermaid(
        containerRef.current,
        cancelledRef,
        setError,
        setLoading
      );
    };
    if (!container) {
      const t = setTimeout(run, 100);
      return () => {
        cancelledRef.current = true;
        clearTimeout(t);
      };
    }
    run();
    return () => {
      cancelledRef.current = true;
    };
  }, [visible]);

  if (error) {
    return <p className="code-page-project-flow-error">{error}</p>;
  }
  if (!visible) {
    return (
      <div
        ref={containerRef}
        className="code-page-project-flow-diagram"
        aria-label="Project flow diagram"
      />
    );
  }
  return (
    <div className="code-page-project-flow-wrapper">
      {loading && (
        <p className="code-page-project-flow-loading">Rendering diagram…</p>
      )}
      <div
        ref={containerRef}
        className="code-page-project-flow-diagram"
        aria-label="Project flow diagram"
        aria-busy={loading}
      />
    </div>
  );
}

function runMermaid(
  container: HTMLDivElement | null,
  cancelledRef: React.MutableRefObject<boolean>,
  setError: (s: string | null) => void,
  setLoading: (b: boolean) => void
) {
  if (!container) {
    setLoading(false);
    return;
  }
  container.innerHTML = "";
  const pre = document.createElement("pre");
  pre.className = "mermaid";
  pre.textContent = PROJECT_FLOW_MERMAID.trim();
  container.appendChild(pre);

  import("mermaid")
    .then((mermaidModule) => {
      if (cancelledRef.current) return;
      const mermaid = mermaidModule.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          primaryColor: "#e0f2fe",
          primaryTextColor: "#0c4a6e",
          primaryBorderColor: "#0ea5e9",
          lineColor: "#64748b",
          secondaryColor: "#f1f5f9",
          tertiaryColor: "#f8fafc",
        },
        flowchart: { useMaxWidth: true, htmlLabels: true },
      });
      return mermaid.run({ nodes: [pre] });
    })
    .then(() => {
      if (!cancelledRef.current) setLoading(false);
    })
    .catch((err: unknown) => {
      if (!cancelledRef.current) {
        const msg =
          err instanceof Error ? err.message : "Failed to render diagram";
        setError(msg);
        setLoading(false);
      }
    });
}
