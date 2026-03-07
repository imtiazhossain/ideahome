import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { AppLayout } from "../components/AppLayout";
import { Button } from "../components/Button";
import { CollapsibleSection } from "../components/CollapsibleSection";
import { ConfirmModal } from "../components/ConfirmModal";
import { IconGrip } from "../components/IconGrip";
import { IconTrash } from "../components/IconTrash";
import { UiInput } from "../components/UiInput";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "./_app";

type PageSection = {
  id: string;
  title: string;
  content: string;
};

type SelectionTransformResult = {
  content: string;
  selectionStart: number;
  selectionEnd: number;
};

const DEFAULT_SECTION: PageSection = {
  id: "project-overview",
  title: "Project Overview",
  content: [
    "# What are we building?",
    "",
    "Capture the core goal, users, and outcome.",
    "",
    "## Milestones",
    "- [ ] MVP scope",
    "- [ ] First customer feedback",
    "- [ ] Launch readiness",
    "",
    "## Decisions",
    "1. Architecture",
    "2. Auth model",
    "3. Deployment strategy",
  ].join("\n"),
};

function makeSectionId(): string {
  return `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadSectionsFromStorage(projectId: string): PageSection[] {
  if (typeof window === "undefined") return [DEFAULT_SECTION];
  try {
    const raw = localStorage.getItem(`ideahome-pages-sections-${projectId}`);
    if (!raw) return [DEFAULT_SECTION];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_SECTION];
    const valid = parsed
      .map((value) => {
        if (
          value &&
          typeof value === "object" &&
          typeof (value as { id?: unknown }).id === "string" &&
          typeof (value as { title?: unknown }).title === "string" &&
          typeof (value as { content?: unknown }).content === "string"
        ) {
          return value as PageSection;
        }
        return null;
      })
      .filter((value): value is PageSection => value != null);
    return valid.length ? valid : [DEFAULT_SECTION];
  } catch {
    return [DEFAULT_SECTION];
  }
}

function renderConfluencePreview(content: string): React.ReactNode {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(
        <pre className="pages-preview-code" key={`code-${i}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h1 className="pages-preview-h1" key={`h1-${i}`}>
            {text}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 className="pages-preview-h2" key={`h2-${i}`}>
            {text}
          </h2>
        );
      } else {
        blocks.push(
          <h3 className="pages-preview-h3" key={`h3-${i}`}>
            {text}
          </h3>
        );
      }
      i += 1;
      continue;
    }

    const checklistMatch = line.match(/^-\s+\[( |x|X)\](?:\s+(.*))?$/);
    if (checklistMatch) {
      const items: { checked: boolean; text: string }[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const match = current.match(/^-\s+\[( |x|X)\](?:\s+(.*))?$/);
        if (!match) break;
        items.push({
          checked: match[1].toLowerCase() === "x",
          text: (match[2] ?? "").trim(),
        });
        i += 1;
      }
      blocks.push(
        <ul className="pages-preview-checklist" key={`checklist-${i}`}>
          {items.map((item, index) => (
            <li key={`${item.text}-${index}`}>
              <input type="checkbox" checked={item.checked} readOnly />
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const bulletMatch = line.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const match = current.match(/^-\s+(.+)$/);
        if (!match || current.startsWith("- [")) break;
        items.push(match[1]);
        i += 1;
      }
      if (items.length === 0) {
        i += 1;
        continue;
      }
      blocks.push(
        <ul className="pages-preview-list" key={`ul-${i}`}>
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        const match = current.match(/^\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      blocks.push(
        <ol
          className="pages-preview-list pages-preview-list-numbered"
          key={`ol-${i}`}
        >
          {items.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines = [line.trim()];
    i += 1;
    while (i < lines.length) {
      const current = (lines[i] ?? "").trim();
      if (
        !current ||
        current.startsWith("#") ||
        current.startsWith("- ") ||
        /^\d+\./.test(current) ||
        current.startsWith("```")
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }
    blocks.push(
      <p className="pages-preview-paragraph" key={`p-${i}`}>
        {paragraphLines.join(" ")}
      </p>
    );
  }

  if (blocks.length === 0) {
    return (
      <p className="pages-preview-placeholder">
        Start writing with headings (`#`), lists (`- item`, `1. item`),
        checklists (`- [ ] task`), and code blocks (` ``` `).
      </p>
    );
  }

  return blocks;
}

function SortablePagesSection({
  sectionId,
  children,
}: {
  sectionId: string;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: sectionId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const dragHandle = (
    <span
      className="code-page-section-drag-handle features-list-drag-handle"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder section"
      title="Drag to reorder section"
    >
      <IconGrip />
    </span>
  );
  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </div>
  );
}

export default function PagesPage() {
  const layout = useProjectLayout();
  const {
    projects,
    selectedProjectId,
    setSelectedProjectId,
    projectDisplayName,
    drawerOpen,
    setDrawerOpen,
    editingProjectId,
    setEditingProjectId,
    editingProjectName,
    setEditingProjectName,
    projectNameInputRef,
    saveProjectName,
    cancelEditProjectName,
    projectToDelete,
    setProjectToDelete,
    projectDeleting,
    handleDeleteProject,
  } = layout;
  const { theme, toggleTheme } = useTheme();

  const [sections, setSections] = useState<PageSection[]>([DEFAULT_SECTION]);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [sectionPendingDelete, setSectionPendingDelete] =
    useState<PageSection | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (!selectedProjectId) {
      setSections([DEFAULT_SECTION]);
      setCollapsedSections({});
      return;
    }
    const loadedSections = loadSectionsFromStorage(selectedProjectId);
    setSections(loadedSections);
    if (typeof window === "undefined") {
      setCollapsedSections({});
      return;
    }
    try {
      const raw = localStorage.getItem(
        `ideahome-pages-collapsed-sections-${selectedProjectId}`
      );
      if (!raw) {
        setCollapsedSections({});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setCollapsedSections({});
        return;
      }
      const validSectionIds = new Set(loadedSections.map((section) => section.id));
      const next: Record<string, boolean> = {};
      for (const [id, collapsed] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (!validSectionIds.has(id) || typeof collapsed !== "boolean") continue;
        next[id] = collapsed;
      }
      setCollapsedSections(next);
    } catch {
      setCollapsedSections({});
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || typeof window === "undefined") return;
    try {
      localStorage.setItem(
        `ideahome-pages-sections-${selectedProjectId}`,
        JSON.stringify(sections)
      );
    } catch {
      // ignore storage errors
    }
  }, [sections, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || typeof window === "undefined") return;
    try {
      const validSectionIds = new Set(sections.map((section) => section.id));
      const persisted: Record<string, boolean> = {};
      for (const [id, collapsed] of Object.entries(collapsedSections)) {
        if (!validSectionIds.has(id) || collapsed !== true) continue;
        persisted[id] = true;
      }
      localStorage.setItem(
        `ideahome-pages-collapsed-sections-${selectedProjectId}`,
        JSON.stringify(persisted)
      );
    } catch {
      // ignore storage errors
    }
  }, [collapsedSections, sections, selectedProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections]
  );

  const handleAddSection = useCallback(() => {
    setSections((prev) => {
      let title = "New Page";
      if (prev.some((s) => s.title === title)) {
        let counter = 2;
        while (prev.some((s) => s.title === `New Page ${counter}`)) {
          counter++;
        }
        title = `New Page ${counter}`;
      }
      return [
        ...prev,
        {
          id: makeSectionId(),
          title,
          content: "",
        },
      ];
    });
  }, []);

  const handleDeleteSection = useCallback((sectionId: string) => {
    setSections((prev) => prev.filter((section) => section.id !== sectionId));
    setCollapsedSections((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  const handleUpdateSection = useCallback(
    (
      sectionId: string,
      updates: Partial<Pick<PageSection, "title" | "content">>
    ) => {
      setSections((prev) =>
        prev.map((section) =>
          section.id === sectionId ? { ...section, ...updates } : section
        )
      );
    },
    []
  );

  const applySelectionTransform = useCallback(
    (
      sectionId: string,
      transform: (
        content: string,
        selectionStart: number,
        selectionEnd: number
      ) => SelectionTransformResult
    ) => {
      const textarea = textareaRefs.current[sectionId];
      if (!textarea) return;
      const selectionStart = textarea.selectionStart ?? 0;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      setSections((prev) =>
        prev.map((section) => {
          if (section.id !== sectionId) return section;
          const result = transform(
            section.content,
            selectionStart,
            selectionEnd
          );
          requestAnimationFrame(() => {
            const target = textareaRefs.current[sectionId];
            if (!target) return;
            target.focus();
            target.setSelectionRange(
              result.selectionStart,
              result.selectionEnd
            );
          });
          return { ...section, content: result.content };
        })
      );
    },
    []
  );

  const wrapSelection = useCallback(
    (sectionId: string, prefix: string, suffix: string, placeholder = "") => {
      applySelectionTransform(sectionId, (content, start, end) => {
        const selected = content.slice(start, end) || placeholder;
        const replaced = `${prefix}${selected}${suffix}`;
        const nextContent =
          content.slice(0, start) + replaced + content.slice(end);
        const nextStart = start + prefix.length;
        const nextEnd = nextStart + selected.length;
        return {
          content: nextContent,
          selectionStart: nextStart,
          selectionEnd: nextEnd,
        };
      });
    },
    [applySelectionTransform]
  );

  const prefixSelectionLines = useCallback(
    (sectionId: string, prefix: string) => {
      applySelectionTransform(sectionId, (content, start, end) => {
        const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        const lineEndIndex = content.indexOf("\n", end);
        const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
        const block = content.slice(lineStart, lineEnd);
        const lines = block.split("\n");
        const prefixed = lines.map((line) => `${prefix}${line}`).join("\n");
        const nextContent =
          content.slice(0, lineStart) + prefixed + content.slice(lineEnd);
        return {
          content: nextContent,
          selectionStart: start + prefix.length,
          selectionEnd: end + prefix.length * lines.length,
        };
      });
    },
    [applySelectionTransform]
  );

  const insertCodeBlock = useCallback(
    (sectionId: string) => {
      applySelectionTransform(sectionId, (content, start, end) => {
        const selected = content.slice(start, end);
        const body = selected || "code";
        const wrapped = `\`\`\`\n${body}\n\`\`\``;
        const nextContent =
          content.slice(0, start) + wrapped + content.slice(end);
        const nextStart = start + 4;
        const nextEnd = nextStart + body.length;
        return {
          content: nextContent,
          selectionStart: nextStart,
          selectionEnd: nextEnd,
        };
      });
    },
    [applySelectionTransform]
  );

  const applyToolbarAction = useCallback(
    (sectionId: string, actionId: string) => {
      if (actionId === "h1") {
        prefixSelectionLines(sectionId, "# ");
        return;
      }
      if (actionId === "h2") {
        prefixSelectionLines(sectionId, "## ");
        return;
      }
      if (actionId === "bullet") {
        prefixSelectionLines(sectionId, "- ");
        return;
      }
      if (actionId === "check") {
        prefixSelectionLines(sectionId, "- [ ] ");
        return;
      }
      if (actionId === "numbered") {
        prefixSelectionLines(sectionId, "1. ");
        return;
      }
      if (actionId === "bold") {
        wrapSelection(sectionId, "**", "**", "bold text");
        return;
      }
      if (actionId === "italic") {
        wrapSelection(sectionId, "_", "_", "italic text");
        return;
      }
      if (actionId === "link") {
        wrapSelection(sectionId, "[", "](https://)", "link text");
        return;
      }
      if (actionId === "code") {
        insertCodeBlock(sectionId);
      }
    },
    [insertCodeBlock, prefixSelectionLines, wrapSelection]
  );

  const toolbarActions = useMemo(
    () => [
      { id: "h1", label: "H1", title: "Heading 1" },
      { id: "h2", label: "H2", title: "Heading 2" },
      { id: "bullet", label: "• List", title: "Bulleted list" },
      { id: "numbered", label: "1. List", title: "Numbered list" },
      { id: "check", label: "☑ Task", title: "Checklist item" },
      { id: "bold", label: "B", title: "Bold" },
      { id: "italic", label: "I", title: "Italic" },
      { id: "link", label: "Link", title: "Link" },
      { id: "code", label: "{ }", title: "Code block" },
    ],
    []
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const oldIndex = prev.findIndex(
        (section) => section.id === String(active.id)
      );
      const newIndex = prev.findIndex(
        (section) => section.id === String(over.id)
      );
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = [...prev];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      return next;
    });
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  }, []);

  return (
    <AppLayout
      title="Pages · Idea Home"
      activeTab="pages"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onCreateProject={layout.createProjectByName}
      onRenameProject={layout.renameProjectById}
    >
      <div className="tests-page-content pages-page-content">
        <header className="pages-page-header">
          <h1 className="tests-page-title">Pages</h1>
          <Button
            variant="ghost"
            size="md"
            className="pages-add-section-btn"
            onClick={handleAddSection}
            disabled={!selectedProjectId}
          >
            Add section
          </Button>
        </header>

        {!selectedProjectId ? (
          <section className="tests-page-section">
            <h2 className="tests-page-section-title">Select a Project</h2>
            <p className="tests-page-section-desc">
              Choose a project to create Confluence-style notes pages.
            </p>
          </section>
        ) : sections.length === 0 ? (
          <section className="tests-page-section">
            <h2 className="tests-page-section-title">No Sections Yet</h2>
            <p className="tests-page-section-desc">
              Add your first section to start writing notes.
            </p>
          </section>
        ) : (
          <DndContext
            sensors={sensors}
            modifiers={[restrictToWindowEdges]}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              {sections.map((section) => (
                <SortablePagesSection key={section.id} sectionId={section.id}>
                  {(dragHandle) => (
                    <CollapsibleSection
                      sectionId={section.id}
                      title={
                        <>
                          {section.title || "Untitled section"}{" "}
                          <span className="tests-page-section-count">
                            Notes
                          </span>
                        </>
                      }
                      collapsed={collapsedSections[section.id] ?? false}
                      onToggle={() => toggleSection(section.id)}
                      sectionClassName="pages-note-section"
                      headerTrailing={
                        <div className="pages-section-actions">{dragHandle}</div>
                      }
                    >
                      <div className="pages-section-editor-grid">
                        <div className="pages-editor-column">
                          <label htmlFor={`title-${section.id}`}>
                            Section title
                          </label>
                          <UiInput
                            id={`title-${section.id}`}
                            className="pages-title-input"
                            value={section.title}
                            onChange={(event) =>
                              handleUpdateSection(section.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Untitled section"
                          />
                          <label htmlFor={`content-${section.id}`}>
                            Page content
                          </label>
                          <div className="pages-editor-toolbar" role="toolbar">
                            {toolbarActions.map((action) => (
                              <button
                                key={`${section.id}-${action.id}`}
                                type="button"
                                className="ui-btn ui-btn--secondary ui-btn--sm pages-toolbar-btn"
                                title={action.title}
                                aria-label={action.title}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() =>
                                  applyToolbarAction(section.id, action.id)
                                }
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                          <textarea
                            id={`content-${section.id}`}
                            className="pages-editor-textarea"
                            value={section.content}
                            ref={(node) => {
                              textareaRefs.current[section.id] = node;
                            }}
                            onChange={(event) =>
                              handleUpdateSection(section.id, {
                                content: event.target.value,
                              })
                            }
                            placeholder="Write project notes..."
                          />
                        </div>
                        <div className="pages-preview-column">
                          <h3 className="pages-preview-title">Page preview</h3>
                          <div className="pages-preview-surface">
                            {renderConfluencePreview(section.content)}
                          </div>
                        </div>
                      </div>
                      <div className="pages-section-footer-actions">
                        <button
                          type="button"
                          className="pages-section-delete-icon"
                          onClick={() => setSectionPendingDelete(section)}
                          aria-label={`Delete ${section.title || "section"}`}
                          title="Delete section"
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </CollapsibleSection>
                  )}
                </SortablePagesSection>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
      {sectionPendingDelete ? (
        <ConfirmModal
          title="Delete section"
          message={
            <>
              Delete &quot;
              {sectionPendingDelete.title.trim() || "Untitled section"}
              &quot;? This cannot be undone.
            </>
          }
          confirmLabel="Delete"
          onClose={() => setSectionPendingDelete(null)}
          onConfirm={() => {
            handleDeleteSection(sectionPendingDelete.id);
            setSectionPendingDelete(null);
          }}
          danger
        />
      ) : null}
    </AppLayout>
  );
}
