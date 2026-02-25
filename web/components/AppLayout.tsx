import React from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { ProjectNavBar, DrawerCollapsedNav } from "./ProjectNavBar";
import type { ProjectNavTabId } from "./ProjectNavBar";

const NAV_LINKS: { href: string; label: string; tabId: ProjectNavTabId }[] = [
  { href: "/", label: "Dashboard", tabId: "board" },
  { href: "/todo", label: "To-Do", tabId: "todo" },
  { href: "/ideas", label: "Ideas", tabId: "ideas" },
  { href: "/tests", label: "Tests", tabId: "tests" },
  { href: "/features", label: "Features", tabId: "list" },
  { href: "/bugs", label: "Bugs", tabId: "forms" },
  { href: "/expenses", label: "Expenses", tabId: "expenses" },
];

export interface AppLayoutProps {
  title: string;
  activeTab: ProjectNavTabId;
  projectName: string;
  projectId: string | undefined;
  searchPlaceholder: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  projects: { id: string; name: string }[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  editingProjectId: string | null;
  setEditingProjectId: (id: string | null) => void;
  editingProjectName: string;
  setEditingProjectName: (name: string) => void;
  saveProjectName: () => void;
  cancelEditProjectName: () => void;
  projectNameInputRef: React.RefObject<HTMLInputElement | null>;
  theme: string;
  toggleTheme: () => void;
  projectToDelete: { id: string; name: string } | null;
  setProjectToDelete: (p: { id: string; name: string } | null) => void;
  projectDeleting: boolean;
  handleDeleteProject: () => Promise<void>;
  children: React.ReactNode;
}

export function AppLayout({
  title,
  activeTab,
  projectName,
  projectId,
  searchPlaceholder,
  drawerOpen,
  setDrawerOpen,
  projects,
  selectedProjectId,
  setSelectedProjectId,
  editingProjectId,
  setEditingProjectId,
  editingProjectName,
  setEditingProjectName,
  saveProjectName,
  cancelEditProjectName,
  projectNameInputRef,
  theme,
  toggleTheme,
  projectToDelete,
  setProjectToDelete,
  projectDeleting,
  handleDeleteProject,
  children,
}: AppLayoutProps) {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}
      <div className="app-layout">
        <aside
          className={`drawer ${drawerOpen ? "drawer-open" : "drawer-closed"}`}
        >
          {drawerOpen ? (
            <>
              <div className="drawer-logo" aria-hidden>
                IH
              </div>
              <div className="drawer-header">
                <div className="drawer-title">Idea Home</div>
                <button
                  type="button"
                  className="drawer-toggle"
                  onClick={() => setDrawerOpen((o) => !o)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  ◀
                </button>
              </div>
              <div className="drawer-content">
                <nav className="drawer-nav">
                  {NAV_LINKS.map(({ href, label, tabId }) => (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      className={`drawer-nav-item ${activeTab === tabId ? "is-selected" : ""}`}
                    >
                      {label}
                    </Link>
                  ))}
                  <div className="drawer-nav-label">Projects</div>
                  {projects.map((p) => (
                    <div key={p.id} className="drawer-nav-item-row">
                      {editingProjectId === p.id ? (
                        <input
                          ref={
                            projectNameInputRef as React.RefObject<HTMLInputElement>
                          }
                          type="text"
                          className="drawer-nav-item drawer-nav-item-input"
                          value={editingProjectName}
                          onChange={(e) =>
                            setEditingProjectName(e.target.value)
                          }
                          onBlur={saveProjectName}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveProjectName();
                            if (e.key === "Escape") cancelEditProjectName();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Project name"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`drawer-nav-item ${selectedProjectId === p.id ? "is-selected" : ""}`}
                          onClick={() => setSelectedProjectId(p.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingProjectId(p.id);
                            setEditingProjectName(p.name);
                          }}
                          title="Double-click to edit name"
                        >
                          {p.name}
                        </button>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
              <div className="drawer-footer">
                <button
                  type="button"
                  className="drawer-footer-btn"
                  aria-label="Feedback"
                >
                  💬
                </button>
                <button
                  type="button"
                  className="drawer-footer-btn"
                  aria-label={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                  onClick={toggleTheme}
                  title={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                >
                  {theme === "light" ? "🌙" : "☀️"}
                </button>
              </div>
            </>
          ) : (
            <DrawerCollapsedNav
              activeTab={activeTab}
              onExpand={() => setDrawerOpen(true)}
            />
          )}
        </aside>

        <main className="main-content">
          <ProjectNavBar
            projectName={projectName}
            projectId={projectId}
            activeTab={activeTab}
            searchPlaceholder={searchPlaceholder}
            onOpenDrawer={() => setDrawerOpen(true)}
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onCreateProject={(name) => {
              void router.push(
                "/?createProject=1&projectName=" +
                  encodeURIComponent(name)
              );
            }}
            onDeleteProjectClick={() => {
              const current = projects.find(
                (p) => p.id === selectedProjectId
              );
              if (current) setProjectToDelete(current);
            }}
          />

          {projectToDelete && (
            <div
              className="modal-overlay"
              onClick={() => !projectDeleting && setProjectToDelete(null)}
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Delete project</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => !projectDeleting && setProjectToDelete(null)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
                  Delete &quot;{projectToDelete.name}&quot;? This will
                  permanently remove the project and all its issues.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => !projectDeleting && setProjectToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: "var(--danger, #c53030)" }}
                    onClick={handleDeleteProject}
                    disabled={projectDeleting}
                  >
                    {projectDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {children}
        </main>
      </div>
    </>
  );
}
