import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "../../components/AppLayout";
import {
  getCustomPageDocument,
  getCustomTabBySlug,
  getCustomTabId,
  setCustomPageDocument,
} from "../../lib/customTabs";
import { useProjectLayout } from "../../lib/useProjectLayout";
import { useTheme } from "../_app";

function renderPreview(content: string): React.ReactNode {
  const lines = content.split("\n");
  return (
    <div className="pages-preview-surface">
      {lines.length === 0 ? (
        <p className="pages-preview-placeholder">Start writing here.</p>
      ) : (
        lines.map((line, index) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return <div key={`space-${index}`} style={{ height: 10 }} />;
          }
          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={`h1-${index}`} className="pages-preview-h1">
                {trimmed.slice(2)}
              </h1>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={`h2-${index}`} className="pages-preview-h2">
                {trimmed.slice(3)}
              </h2>
            );
          }
          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={`h3-${index}`} className="pages-preview-h3">
                {trimmed.slice(4)}
              </h3>
            );
          }
          return (
            <p key={`p-${index}`} className="pages-preview-paragraph">
              {line}
            </p>
          );
        })
      )}
    </div>
  );
}

export default function CustomPageTab() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const layout = useProjectLayout();
  const { theme, toggleTheme } = useTheme();
  const projectId = layout.selectedProjectId ?? "";
  const page = slug && projectId ? getCustomTabBySlug(projectId, slug) : null;
  const [content, setContent] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!slug || !projectId) return;
    const found = getCustomTabBySlug(projectId, slug);
    if (!found) return;
    setContent(getCustomPageDocument(projectId, slug).content);
    setHydrated(true);
  }, [projectId, slug]);

  useEffect(() => {
    if (!slug || !projectId || !hydrated) return;
    setCustomPageDocument(projectId, slug, {
      content,
      updatedAt: new Date().toISOString(),
    });
  }, [content, hydrated, projectId, slug]);

  if (!router.isReady) return null;

  if (slug && !page) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <div style={{ padding: 24 }}>
            <h1>Page Not Found</h1>
            <p>The page &quot;{slug}&quot; does not exist in this project.</p>
            <a href="/">Go home</a>
          </div>
        </main>
      </div>
    );
  }

  if (!page) return null;

  return (
    <AppLayout
      title={`${page.name} · Idea Home`}
      activeTab={getCustomTabId(page.slug)}
      projectName={
        layout.projects.find((project) => project.id === layout.selectedProjectId)
          ?.name ?? page.name
      }
      projectId={layout.selectedProjectId || undefined}
      searchPlaceholder="Search"
      drawerOpen={layout.drawerOpen}
      setDrawerOpen={layout.setDrawerOpen}
      projects={layout.projects}
      selectedProjectId={layout.selectedProjectId ?? ""}
      setSelectedProjectId={layout.setSelectedProjectId}
      editingProjectId={layout.editingProjectId}
      setEditingProjectId={layout.setEditingProjectId}
      editingProjectName={layout.editingProjectName}
      setEditingProjectName={layout.setEditingProjectName}
      saveProjectName={layout.saveProjectName}
      cancelEditProjectName={layout.cancelEditProjectName}
      projectNameInputRef={layout.projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={layout.projectToDelete}
      setProjectToDelete={layout.setProjectToDelete}
      projectDeleting={layout.projectDeleting}
      handleDeleteProject={layout.handleDeleteProject}
      onCreateProject={layout.createProjectByName}
      onRenameProject={layout.renameProjectById}
    >
      <div className="tests-page-content pages-page-content">
        <header className="pages-page-header">
          <div>
            <p className="settings-page-kicker">Custom page</p>
            <h1 className="settings-page-title">{page.name}</h1>
          </div>
        </header>
        <section className="pages-note-section">
          <div className="pages-section-editor-grid">
            <div className="pages-editor-column">
              <h3 className="pages-preview-title">Editor</h3>
              <textarea
                className="pages-editor-textarea"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your page..."
              />
            </div>
            <div className="pages-preview-column">
              <h3 className="pages-preview-title">Page Preview</h3>
              {renderPreview(content)}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
