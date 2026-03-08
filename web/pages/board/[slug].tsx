import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { AppLayout } from "../../components/AppLayout";
import {
  getCustomBoardData,
  getCustomTabBySlug,
  getCustomTabId,
  setCustomBoardData,
  type CustomBoardCard,
  type CustomBoardColumn,
} from "../../lib/customTabs";
import { useProjectLayout } from "../../lib/useProjectLayout";
import { useTheme } from "../_app";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export default function CustomBoardTab() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const layout = useProjectLayout();
  const { theme, toggleTheme } = useTheme();
  const projectId = layout.selectedProjectId ?? "";
  const board = slug && projectId ? getCustomTabBySlug(projectId, slug) : null;
  const [columns, setColumns] = useState<CustomBoardColumn[]>([]);
  const [cards, setCards] = useState<CustomBoardCard[]>([]);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [cardDrafts, setCardDrafts] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!slug || !projectId) return;
    const found = getCustomTabBySlug(projectId, slug);
    if (!found) return;
    const data = getCustomBoardData(projectId, slug);
    setColumns(data.columns);
    setCards(data.cards);
    setHydrated(true);
  }, [projectId, slug]);

  useEffect(() => {
    if (!slug || !projectId || !hydrated) return;
    setCustomBoardData(projectId, slug, { columns, cards });
  }, [cards, columns, hydrated, projectId, slug]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, CustomBoardCard[]>();
    for (const column of columns) {
      map.set(column.id, cards.filter((card) => card.columnId === column.id));
    }
    return map;
  }, [cards, columns]);

  if (!router.isReady) return null;

  if (slug && !board) {
    return (
      <div className="app-layout">
        <main className="main-content">
          <div style={{ padding: 24 }}>
            <h1>Board Not Found</h1>
            <p>The board &quot;{slug}&quot; does not exist in this project.</p>
            <a href="/">Go home</a>
          </div>
        </main>
      </div>
    );
  }

  if (!board) return null;

  return (
    <AppLayout
      title={`${board.name} · Idea Home`}
      activeTab={getCustomTabId(board.slug)}
      projectName={
        layout.projects.find((project) => project.id === layout.selectedProjectId)
          ?.name ?? board.name
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
      <div className="tests-page-content">
        <section className="tests-page-section">
          <div className="calendar-sync-section-header">
            <div>
              <p className="settings-page-kicker">Custom board</p>
              <h1 className="settings-page-title">{board.name}</h1>
            </div>
            <div className="calendar-sync-actions">
              <input
                value={newColumnTitle}
                onChange={(event) => setNewColumnTitle(event.target.value)}
                placeholder="New column"
              />
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => {
                  const title = newColumnTitle.trim();
                  if (!title) return;
                  setColumns((prev) => [
                    ...prev,
                    { id: makeId("column"), title, order: prev.length },
                  ]);
                  setNewColumnTitle("");
                }}
              >
                Add column
              </button>
            </div>
          </div>
          <div className="board-columns">
            {columns.map((column) => {
              const columnCards = cardsByColumn.get(column.id) ?? [];
              return (
                <div key={column.id} className={`column column-${column.id}`}>
                  <div className="column-header">
                    <span className="column-title">{column.title}</span>
                    <span className="column-count">{columnCards.length}</span>
                  </div>
                  <div className="column-body">
                    {columnCards.map((card) => (
                      <div key={card.id} className="issue-card issue-card-preview">
                        <div className="issue-card-title">{card.title}</div>
                        {card.description ? (
                          <div className="issue-card-meta">{card.description}</div>
                        ) : null}
                        <div className="settings-list-actions" style={{ marginTop: 10 }}>
                          {columns.map((targetColumn) =>
                            targetColumn.id === column.id ? null : (
                              <button
                                key={targetColumn.id}
                                type="button"
                                className="settings-mini-btn"
                                onClick={() => {
                                  setCards((prev) =>
                                    prev.map((entry) =>
                                      entry.id === card.id
                                        ? { ...entry, columnId: targetColumn.id }
                                        : entry
                                    )
                                  );
                                }}
                              >
                                {targetColumn.title}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="calendar-side-panel">
                      <input
                        value={cardDrafts[column.id] ?? ""}
                        onChange={(event) =>
                          setCardDrafts((prev) => ({
                            ...prev,
                            [column.id]: event.target.value,
                          }))
                        }
                        placeholder={`Add card to ${column.title}`}
                      />
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        onClick={() => {
                          const title = (cardDrafts[column.id] ?? "").trim();
                          if (!title) return;
                          setCards((prev) => [
                            ...prev,
                            {
                              id: makeId("card"),
                              columnId: column.id,
                              title,
                              description: "",
                              order: columnCards.length,
                            },
                          ]);
                          setCardDrafts((prev) => ({ ...prev, [column.id]: "" }));
                        }}
                      >
                        Add card
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
