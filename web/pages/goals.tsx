import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppLayout } from "../components/AppLayout";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "./_app";
import { IconGoals } from "../components/icons";
import { IconPlus } from "../components/IconPlus";
import { IconTrash } from "../components/IconTrash";
import { IconCheck } from "../components/IconCheck";


/* ─── categories ─── */
const GOAL_CATEGORIES = [
  { id: "general", label: "General", color: "var(--text-muted)" },
  { id: "ui", label: "UI / UX", color: "var(--accent)" },
  { id: "backend", label: "Backend / API", color: "var(--todo)" },
  { id: "features", label: "Features", color: "var(--summary-features)" },
  { id: "performance", label: "Performance", color: "var(--in_progress)" },
] as const;

type GoalCategory = (typeof GOAL_CATEGORIES)[number]["id"];

/* ─── data model ─── */
interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  completed: boolean;
  createdAt: string;
}

/* ─── storage helpers ─── */
function getStorageKey(projectId: string): string {
  return `ideahome-goals-${projectId}`;
}

function loadGoals(projectId: string): Goal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (g: unknown): g is Goal =>
        typeof g === "object" &&
        g !== null &&
        typeof (g as Goal).id === "string" &&
        typeof (g as Goal).title === "string"
    );
  } catch {
    return [];
  }
}

function saveGoals(projectId: string, goals: Goal[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(goals));
  } catch { /* ignore */ }
}

function uid(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function GoalsPage() {
  const layout = useProjectLayout();
  const { theme, toggleTheme } = useTheme();
  const selectedProjectId = layout.selectedProjectId;

  const [goals, setGoals] = useState<Goal[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  // draft state
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState<GoalCategory>("general");

  // load goals when project changes
  useEffect(() => {
    if (selectedProjectId) {
      setGoals(loadGoals(selectedProjectId));
    } else {
      setGoals([]);
    }
    setAddingGoal(false);
    setEditingGoalId(null);
  }, [selectedProjectId]);

  const persistGoals = useCallback(
    (next: Goal[]) => {
      setGoals(next);
      if (selectedProjectId) saveGoals(selectedProjectId, next);
    },
    [selectedProjectId]
  );

  const startAdd = () => {
    setAddingGoal(true);
    setEditingGoalId(null);
    setDraftTitle("");
    setDraftDescription("");
    setDraftCategory("general");
  };

  const startEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setAddingGoal(false);
    setDraftTitle(goal.title);
    setDraftDescription(goal.description);
    setDraftCategory(goal.category);
  };

  const cancelEdit = () => {
    setAddingGoal(false);
    setEditingGoalId(null);
  };

  const saveGoal = () => {
    const title = draftTitle.trim();
    if (!title) return;

    if (addingGoal) {
      const newGoal: Goal = {
        id: uid(),
        title,
        description: draftDescription.trim(),
        category: draftCategory,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      persistGoals([newGoal, ...goals]);
    } else if (editingGoalId) {
      persistGoals(
        goals.map((g) =>
          g.id === editingGoalId
            ? { ...g, title, description: draftDescription.trim(), category: draftCategory }
            : g
        )
      );
    }
    cancelEdit();
  };

  const deleteGoal = (id: string) => {
    persistGoals(goals.filter((g) => g.id !== id));
    if (editingGoalId === id) cancelEdit();
  };

  const toggleGoal = (id: string) => {
    persistGoals(
      goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g))
    );
  };

  const stats = useMemo(() => {
    const total = goals.length;
    const completed = goals.filter((g) => g.completed).length;
    const active = total - completed;
    return { total, completed, active };
  }, [goals]);

  const appLayoutProps = {
    title: "Goals · Idea Home",
    activeTab: "goals" as const,
    projectName: layout.projectDisplayName,
    projectId: selectedProjectId || undefined,
    searchPlaceholder: "Search project",
    drawerOpen: layout.drawerOpen,
    setDrawerOpen: layout.setDrawerOpen,
    projects: layout.projects,
    selectedProjectId: selectedProjectId ?? "",
    setSelectedProjectId: layout.setSelectedProjectId,
    editingProjectId: layout.editingProjectId,
    setEditingProjectId: layout.setEditingProjectId,
    editingProjectName: layout.editingProjectName,
    setEditingProjectName: layout.setEditingProjectName,
    saveProjectName: layout.saveProjectName,
    cancelEditProjectName: layout.cancelEditProjectName,
    projectNameInputRef: layout.projectNameInputRef,
    theme,
    toggleTheme,
    projectToDelete: layout.projectToDelete,
    setProjectToDelete: layout.setProjectToDelete,
    projectDeleting: layout.projectDeleting,
    handleDeleteProject: layout.handleDeleteProject,
    onCreateProject: layout.createProjectByName,
    onRenameProject: layout.renameProjectById,
  };

  return (
    <AppLayout {...appLayoutProps}>
      <div className="goals-page">
        <header className="goals-page-header">
          <p className="goals-page-eyebrow">Operations</p>
          <div className="goals-header-row">
            <div>
              <h1 className="goals-page-title">Goals</h1>
              <p className="goals-page-subtitle">
                Set and describe objectives for different parts of your project.
              </p>
            </div>
            {!addingGoal && !editingGoalId && (
              <button className="btn btn-primary goals-add-btn" onClick={startAdd}>
                <IconPlus /> Add Goal
              </button>
            )}
          </div>
        </header>

        {!layout.projectsLoaded ? (
          <div className="goals-page-loading">
            <SectionLoadingSpinner />
          </div>
        ) : !selectedProjectId ? (
          <section className="goals-empty-state">
            <h2>No project selected</h2>
            <p>Select a project to start setting goals.</p>
          </section>
        ) : (
          <>
            {/* ── Summary Stats ── */}
            <div className="goals-stats-grid">
              <div className="goals-stat-card">
                <span className="goals-stat-label">Total Goals</span>
                <strong className="goals-stat-value">{stats.total}</strong>
              </div>
              <div className="goals-stat-card">
                <span className="goals-stat-label">Active</span>
                <strong className="goals-stat-value">{stats.active}</strong>
              </div>
              <div className="goals-stat-card">
                <span className="goals-stat-label">Completed</span>
                <strong className="goals-stat-value is-completed">{stats.completed}</strong>
              </div>
            </div>

            {/* ── Edit / Add Panel ── */}
            {(addingGoal || editingGoalId) && (
              <div className="goals-edit-card">
                <h3>{addingGoal ? "Add New Goal" : "Edit Goal"}</h3>
                <div className="goals-form-grid">
                  <div className="goals-form-field">
                    <label>Title</label>
                    <input
                      type="text"
                      className="goals-input"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder="Goal title..."
                      autoFocus
                    />
                  </div>
                  <div className="goals-form-field">
                    <label>Category</label>
                    <div className="goals-category-picker">
                      {GOAL_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`goals-cat-btn ${draftCategory === cat.id ? "is-selected" : ""}`}
                          onClick={() => setDraftCategory(cat.id)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="goals-form-field is-full">
                    <label>Description</label>
                    <textarea
                      className="goals-textarea"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="Describe the goal in detail..."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="goals-form-actions">
                  <button className="btn btn-primary" onClick={saveGoal}>
                    {addingGoal ? "Create Goal" : "Save Changes"}
                  </button>
                  <button className="btn btn-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                  {editingGoalId && (
                    <button
                      className="btn btn-icon btn-danger goals-delete-btn"
                      onClick={() => deleteGoal(editingGoalId)}
                      title="Delete Goal"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Goals Grid ── */}
            {goals.length === 0 && !addingGoal && (
              <div className="goals-empty-state">
                <IconGoals />
                <h3>No goals set yet</h3>
                <p>Track your project objectives here to stay focused.</p>
                <button className="btn btn-primary" onClick={startAdd}>Set your first goal</button>
              </div>
            )}

            <div className="goals-grid">
              {GOAL_CATEGORIES.map((cat) => {
                const catGoals = goals.filter((g) => g.category === cat.id);
                if (catGoals.length === 0) return null;
                return (
                  <div key={cat.id} className="goals-category-section">
                    <h2 className="goals-category-title" style={{ color: cat.color }}>
                      {cat.label}
                    </h2>
                    <div className="goals-list">
                      {catGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className={`goals-item-card ${goal.completed ? "is-completed" : ""}`}
                          onClick={() => startEdit(goal)}
                        >
                          <div
                            className="goals-item-checkbox"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGoal(goal.id);
                            }}
                          >
                            {goal.completed && <IconCheck />}
                          </div>
                          <div className="goals-item-content">
                            <h4 className="goals-item-title">{goal.title}</h4>
                            {goal.description && (
                              <p className="goals-item-desc">{goal.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
