import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  createBug,
  deleteBug,
  fetchBugs,
  fetchProjects,
  getUserScopedStorageKey,
  isAuthenticated,
  reorderBugs,
  updateProject,
  updateBug,
  type Bug,
} from "../lib/api";
import { ProjectNavBar, DrawerCollapsedNav } from "../components/ProjectNavBar";
import { useTheme } from "./_app";

const IconPlus = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconGrip = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

const IconCheck = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const BUGS_STORAGE_PREFIX = "ideahome-bugs-list";
const LEGACY_BUGS_STORAGE_KEY = "ideahome-bugs-list";

function getBugsStorageKey(): string {
  return getUserScopedStorageKey(BUGS_STORAGE_PREFIX, LEGACY_BUGS_STORAGE_KEY);
}

function loadStoredBugsLegacy(): { name: string; done: boolean }[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getBugsStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LEGACY_BUGS_STORAGE_KEY) {
      raw = localStorage.getItem(LEGACY_BUGS_STORAGE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: unknown) => {
      if (
        item &&
        typeof item === "object" &&
        "name" in item &&
        typeof (item as { name: unknown }).name === "string"
      ) {
        const o = item as { name: string; done?: boolean };
        return { name: o.name, done: Boolean(o.done) };
      }
      return { name: String(item), done: false };
    });
  } catch {
    return [];
  }
}

function clearStoredBugsLegacy(): void {
  if (typeof window === "undefined") return;
  const key = getBugsStorageKey();
  localStorage.removeItem(key);
  localStorage.removeItem(LEGACY_BUGS_STORAGE_KEY);
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr];
  const [removed] = copy.splice(from, 1);
  copy.splice(to, 0, removed);
  return copy;
}

export default function BugsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [newBug, setNewBug] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const migratedFromStorageRef = useRef(false);

  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{
    sourceIndex: number;
    targetIndex: number;
    startY: number;
    itemTops: number[];
    itemHeight: number;
  } | null>(null);

  const loadProjects = () =>
    fetchProjects()
      .then((data) => {
        setProjects(data);
        if (data.length && !selectedProjectId) setSelectedProjectId(data[0].id);
      })
      .catch(() => {});

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadProjects();
  }, [router]);
  useEffect(() => {
    if (editingProjectId) {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }
  }, [editingProjectId]);

  const saveProjectName = async () => {
    if (!editingProjectId) return;
    const name = editingProjectName.trim();
    if (!name) {
      setEditingProjectId(null);
      return;
    }
    const prev = projects.find((x) => x.id === editingProjectId);
    if (prev?.name === name) {
      setEditingProjectId(null);
      return;
    }
    try {
      const updated = await updateProject(editingProjectId, { name });
      setProjects((p) =>
        p.map((x) => (x.id === editingProjectId ? updated : x))
      );
    } catch {
      // Keep edit mode on error
    } finally {
      setEditingProjectId(null);
    }
  };

  const cancelEditProjectName = () => {
    setEditingProjectId(null);
  };

  useEffect(() => {
    if (!isAuthenticated() || !selectedProjectId) {
      setBugs([]);
      return;
    }
    let cancelled = false;
    setBugsLoading(true);
    fetchBugs(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setBugs(data);
        if (
          !migratedFromStorageRef.current &&
          data.length === 0 &&
          loadStoredBugsLegacy().length > 0
        ) {
          migratedFromStorageRef.current = true;
          const legacy = loadStoredBugsLegacy();
          Promise.all(
            legacy.map((item) =>
              createBug({
                projectId: selectedProjectId,
                name: item.name,
                done: item.done,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setBugs(created);
              clearStoredBugsLegacy();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setBugs([]);
      })
      .finally(() => {
        if (!cancelled) setBugsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const isTempId = (id: string) => id.startsWith("temp-");

  const addBug = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBug.trim();
    if (!trimmed || !selectedProjectId) return;
    const firstDoneIndex = bugs.findIndex((b) => b.done);
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic: Bug = {
      id: optimisticId,
      name: trimmed,
      done: false,
      order: firstDoneIndex === -1 ? bugs.length : firstDoneIndex,
      projectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    };
    const inserted =
      firstDoneIndex === -1
        ? [...bugs, optimistic]
        : [
            ...bugs.slice(0, firstDoneIndex),
            optimistic,
            ...bugs.slice(firstDoneIndex),
          ];
    setBugs(inserted);
    setNewBug("");
    createBug({
      projectId: selectedProjectId,
      name: trimmed,
      done: false,
    })
      .then((created) => {
        setBugs((prev) => {
          const idx = prev.findIndex((b) => b.id === optimisticId);
          if (idx === -1) return [...prev, created];
          const next = [...prev];
          next[idx] = created;
          return next;
        });
        if (firstDoneIndex >= 0) {
          const withCreated = inserted.map((b) =>
            b.id === optimisticId ? created : b
          );
          reorderBugs(selectedProjectId, withCreated.map((b) => b.id))
            .then(setBugs)
            .catch(() => fetchBugs(selectedProjectId).then(setBugs));
        }
      })
      .catch(() => {
        setBugs((prev) => prev.filter((b) => b.id !== optimisticId));
      });
  };

  const toggleDone = async (index: number) => {
    const item = bugs[index];
    if (isTempId(item.id)) return;
    const newDone = !item.done;
    try {
      await updateBug(item.id, { done: newDone });
      setBugs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], done: newDone };
        const without = next.filter((_, i) => i !== index);
        return newDone ? [...without, next[index]] : [next[index], ...without];
      });
      if (editingIndex === index) {
        setEditingIndex(newDone ? bugs.length - 1 : 0);
      }
    } catch {
      setBugs((prev) => [...prev]);
    }
  };

  const removeBug = (index: number) => {
    const item = bugs[index];
    if (isTempId(item.id)) return;
    const removed = { ...item };
    setBugs((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index)
      setEditingIndex(editingIndex - 1);
    deleteBug(item.id).catch(() => {
      setBugs((prev) => [
        ...prev.slice(0, index),
        removed,
        ...prev.slice(index),
      ]);
    });
  };

  const startEdit = (index: number) => {
    if (isTempId(bugs[index]?.id ?? "")) return;
    setEditingIndex(index);
    setEditingValue(bugs[index]?.name ?? "");
  };

  const saveEdit = async () => {
    if (editingIndex === null) return;
    const item = bugs[editingIndex];
    if (isTempId(item.id)) return;
    const trimmed = editingValue.trim();
    if (trimmed) {
      try {
        await updateBug(item.id, { name: trimmed });
        setBugs((prev) => {
          const next = [...prev];
          next[editingIndex] = { ...next[editingIndex], name: trimmed };
          return next;
        });
      } catch {
        // keep previous name
      }
    } else {
      removeBug(editingIndex);
    }
    setEditingIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const applyTransforms = (
    sourceIdx: number,
    targetIdx: number,
    deltaY: number
  ) => {
    const ul = listRef.current;
    if (!ul) return;
    const children = Array.from(ul.children) as HTMLElement[];
    const drag = dragRef.current;
    if (!drag) return;
    const h = drag.itemHeight;
    const lo = Math.min(sourceIdx, targetIdx);
    const hi = Math.max(sourceIdx, targetIdx);
    const direction = targetIdx > sourceIdx ? -1 : 1;

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (i === sourceIdx) {
        el.style.transform = `translateY(${deltaY}px)`;
        el.style.transition = "none";
        el.style.zIndex = "10";
        el.style.position = "relative";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
      } else if (i >= lo && i <= hi) {
        el.style.transform = `translateY(${direction * h}px)`;
        el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
        el.style.zIndex = "";
        el.style.position = "";
        el.style.boxShadow = "";
      } else {
        el.style.transform = "";
        el.style.transition = "transform 0.2s cubic-bezier(0.2, 0, 0, 1)";
        el.style.zIndex = "";
        el.style.position = "";
        el.style.boxShadow = "";
      }
    }
  };

  const clearAllTransforms = () => {
    const ul = listRef.current;
    if (!ul) return;
    Array.from(ul.children).forEach((child) => {
      const el = child as HTMLElement;
      el.style.transform = "";
      el.style.transition = "";
      el.style.zIndex = "";
      el.style.position = "";
      el.style.boxShadow = "";
    });
  };

  const handleGripPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    const ul = listRef.current;
    if (!ul) return;
    const children = Array.from(ul.children) as HTMLElement[];
    if (children.length === 0) return;

    const itemTops = children.map((c) => c.getBoundingClientRect().top);
    const firstRect = children[0].getBoundingClientRect();
    const itemHeight = firstRect.height + 6;

    dragRef.current = {
      sourceIndex: index,
      targetIndex: index,
      startY: e.clientY,
      itemTops,
      itemHeight,
    };
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaY = e.clientY - drag.startY;
      const sourceIdx = drag.sourceIndex;
      const h = drag.itemHeight;

      let targetIdx = sourceIdx + Math.round(deltaY / h);
      targetIdx = Math.max(0, Math.min(targetIdx, bugs.length - 1));
      drag.targetIndex = targetIdx;

      applyTransforms(sourceIdx, targetIdx, deltaY);
    };

    const onPointerUp = async () => {
      const drag = dragRef.current;
      if (!drag) return;
      const { sourceIndex, targetIndex } = drag;

      clearAllTransforms();

      if (sourceIndex !== targetIndex && selectedProjectId) {
        const reordered = reorder(bugs, sourceIndex, targetIndex);
        setBugs(reordered);
        if (editingIndex !== null) {
          let newEditIndex = editingIndex;
          if (sourceIndex === editingIndex) newEditIndex = targetIndex;
          else if (sourceIndex < editingIndex && targetIndex >= editingIndex)
            newEditIndex = editingIndex - 1;
          else if (sourceIndex > editingIndex && targetIndex <= editingIndex)
            newEditIndex = editingIndex + 1;
          setEditingIndex(newEditIndex);
        }
        try {
          const next = await reorderBugs(
            selectedProjectId,
            reordered.map((b) => b.id)
          );
          setBugs(next);
        } catch {
          setBugs(bugs);
        }
      }

      dragRef.current = null;
      setIsDragging(false);
    };

    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging, bugs, selectedProjectId, editingIndex]);

  return (
    <>
      <Head>
        <title>Bugs · Idea Home</title>
      </Head>
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
                  <Link href="/" className="drawer-nav-item">
                    Dashboard
                  </Link>
                  <Link href="/todo" className="drawer-nav-item">
                    To-Do
                  </Link>
                  <Link href="/tests" className="drawer-nav-item">
                    Tests
                  </Link>
                  <Link href="/features" className="drawer-nav-item">
                    Features
                  </Link>
                  <Link href="/bugs" className="drawer-nav-item is-selected">
                    Bugs
                  </Link>
                  <Link href="/expenses" className="drawer-nav-item">
                    Expenses
                  </Link>
                  <div className="drawer-nav-label">Projects</div>
                  {projects.map((p) => (
                    <div key={p.id} className="drawer-nav-item-row">
                      {editingProjectId === p.id ? (
                        <input
                          ref={projectNameInputRef}
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
                <button
                  type="button"
                  className="drawer-footer-btn"
                  aria-label="Settings"
                >
                  ⚙
                </button>
              </div>
            </>
          ) : (
            <DrawerCollapsedNav
              activeTab="forms"
              onExpand={() => setDrawerOpen(true)}
            />
          )}
        </aside>

        <main className="main-content">
          <ProjectNavBar
            projectName={
              projects.find((p) => p.id === selectedProjectId)?.name ??
              (selectedProjectId ? "Project" : "Select a project")
            }
            projectId={selectedProjectId || undefined}
            activeTab="forms"
            searchPlaceholder="Search project"
          />

          <div className="tests-page-content">
            <h1 className="tests-page-title">Bugs</h1>

            <section className="tests-page-section">
              {selectedProjectId ? (
                <form
                  onSubmit={addBug}
                className="features-add-form"
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginTop: "8px",
                }}
              >
                <input
                  type="text"
                  value={newBug}
                  onChange={(e) => setNewBug(e.target.value)}
                  placeholder="Bug name or description"
                  aria-label="New bug"
                  className="project-nav-search"
                  style={{ flex: "1", minWidth: "200px", padding: "8px 12px" }}
                />
                <button
                  type="submit"
                  className="project-nav-add"
                  aria-label="Add bug"
                  title="Add bug"
                >
                  <IconPlus />
                </button>
              </form>
              ) : (
                <p className="tests-page-section-desc">
                  Select a project to add bugs.
                </p>
              )}
            </section>

            <section className="tests-page-section">
              <h2 className="tests-page-section-title">
                Bug List{" "}
                <span className="tests-page-section-count" aria-label="Count">
                  {bugs.length}
                </span>
              </h2>
              {!selectedProjectId ? (
                <p className="tests-page-section-desc">
                  Select a project to see and manage bugs.
                </p>
              ) : bugsLoading ? (
                <p className="tests-page-section-desc">Loading…</p>
              ) : bugs.length === 0 ? (
                <p className="tests-page-section-desc">
                  No bugs yet. Add one above.
                </p>
              ) : (
                <ul
                  ref={listRef}
                  className="features-list"
                  style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
                >
                  {bugs.map((item, index) => (
                    <li
                      key={item.id}
                      className={`features-list-item ${item.done ? "features-list-item--done" : ""}`}
                    >
                      {editingIndex === index ? (
                        <>
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="project-nav-search"
                            style={{ flex: 1, padding: "6px 10px" }}
                            aria-label="Edit bug"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="features-list-save"
                            onClick={saveEdit}
                            aria-label="Save"
                            title="Save"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="features-list-remove"
                            onClick={cancelEdit}
                            aria-label="Cancel"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="features-list-done-toggle"
                            onClick={() => toggleDone(index)}
                            aria-label={
                              item.done
                                ? `Mark "${item.name}" not done`
                                : `Mark "${item.name}" done`
                            }
                            title={item.done ? "Mark not done" : "Mark done"}
                          >
                            {item.done ? (
                              <span
                                className="features-list-done-check"
                                aria-hidden
                              >
                                <IconCheck />
                              </span>
                            ) : (
                              <span
                                className="features-list-done-empty"
                                aria-hidden
                              />
                            )}
                          </button>
                          <span
                            className="features-list-grip"
                            onPointerDown={(e) =>
                              handleGripPointerDown(e, index)
                            }
                            aria-label={`Drag to reorder: ${item.name}`}
                            title="Drag to reorder"
                          >
                            <IconGrip />
                          </span>
                          <span className="features-list-label">
                            {item.name}
                          </span>
                          {item.done && (
                            <span
                              className="features-list-done-badge"
                              aria-label="Done"
                            >
                              Done
                            </span>
                          )}
                          <button
                            type="button"
                            className="features-list-edit"
                            onClick={() => startEdit(index)}
                            aria-label={`Edit ${item.name}`}
                            title={`Edit "${item.name}"`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="features-list-remove"
                            onClick={() => removeBug(index)}
                            aria-label={`Remove ${item.name}`}
                            title={`Remove "${item.name}"`}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
