import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  createExpense,
  deleteExpense,
  fetchExpenses,
  getUserScopedStorageKey,
  isAuthenticated,
  updateExpense,
  type Expense,
} from "../lib/api";
import { formatCurrency } from "../lib/utils";
import { useProjectLayout } from "../lib/useProjectLayout";
import { AppLayout } from "../components/AppLayout";
import { IconPlus } from "../components/IconPlus";
import { IconTrash } from "../components/IconTrash";
import { LoadingMessage } from "../components/LoadingMessage";
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
import { useTheme } from "./_app";

const EXPENSES_STORAGE_PREFIX = "ideahome-expenses";
const LEGACY_EXPENSES_KEY = "ideahome-expenses";
const LEGACY_COSTS_KEY = "ideahome-costs-expenses";
const CATEGORIES = ["Travel", "Supplies", "Software", "Services", "Other"];

function getExpensesStorageKey(): string {
  return getUserScopedStorageKey(EXPENSES_STORAGE_PREFIX, LEGACY_EXPENSES_KEY);
}

function loadStoredExpensesLegacy(): {
  amount: number;
  description: string;
  date: string;
  category: string;
}[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getExpensesStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== LEGACY_EXPENSES_KEY) {
      raw =
        localStorage.getItem(LEGACY_EXPENSES_KEY) ??
        localStorage.getItem(LEGACY_COSTS_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: unknown) => {
      if (
        item &&
        typeof item === "object" &&
        "amount" in item &&
        "description" in item
      ) {
        const o = item as Record<string, unknown>;
        return {
          amount: Number(o.amount) || 0,
          description: String(o.description ?? ""),
          date:
            typeof o.date === "string"
              ? o.date
              : new Date().toISOString().slice(0, 10),
          category: typeof o.category === "string" ? o.category : "Other",
        };
      }
      return {
        amount: 0,
        description: "",
        date: new Date().toISOString().slice(0, 10),
        category: "Other",
      };
    });
  } catch {
    return [];
  }
}

function clearStoredExpensesLegacy(): void {
  if (typeof window === "undefined") return;
  const key = getExpensesStorageKey();
  localStorage.removeItem(key);
  localStorage.removeItem(LEGACY_EXPENSES_KEY);
  localStorage.removeItem(LEGACY_COSTS_KEY);
}

export default function ExpensesPage() {
  const router = useRouter();
  const layout = useProjectLayout();
  const {
    projects,
    projectsLoaded,
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const migratedFromStorageRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated() || !selectedProjectId) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    setExpensesLoading(true);
    fetchExpenses(selectedProjectId)
      .then((data) => {
        if (cancelled) return;
        setExpenses(data);
        if (
          !migratedFromStorageRef.current &&
          data.length === 0 &&
          loadStoredExpensesLegacy().length > 0
        ) {
          migratedFromStorageRef.current = true;
          const legacy = loadStoredExpensesLegacy();
          Promise.all(
            legacy.map((item) =>
              createExpense({
                projectId: selectedProjectId,
                amount: item.amount,
                description: item.description,
                date: item.date,
                category: item.category,
              })
            )
          )
            .then((created) => {
              if (cancelled) return;
              setExpenses(created);
              clearStoredExpensesLegacy();
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setExpenses([]);
      })
      .finally(() => {
        if (!cancelled) setExpensesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!date) setDate(new Date().toISOString().slice(0, 10));
  }, []);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(/,/g, ""));
    if (Number.isNaN(num) || num <= 0) return;
    const desc = description.trim();
    if (!desc) {
      descriptionInputRef.current?.focus();
      return;
    }
    if (!selectedProjectId) return;
    try {
      const created = await createExpense({
        projectId: selectedProjectId,
        amount: num,
        description: desc,
        date: date || new Date().toISOString().slice(0, 10),
        category: category || "Other",
      });
      setExpenses((prev) => [created, ...prev]);
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setCategory("Other");
      descriptionInputRef.current?.focus();
    } catch {
      // leave form values for retry
    }
  };

  const removeExpense = async (id: string) => {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // keep in list
    }
  };

  const updateExpenseCategory = async (id: string, newCategory: string) => {
    try {
      await updateExpense(id, { category: newCategory });
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? { ...e, category: newCategory } : e))
      );
      setEditingCategoryId(null);
    } catch {
      setEditingCategoryId(null);
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    const c = e.category || "Other";
    acc[c] = (acc[c] ?? 0) + e.amount;
    return acc;
  }, {});

  return (
    <AppLayout
      title="Expenses · Idea Home"
      activeTab="expenses"
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
    >
      <div className="tests-page-content">
            <h1 className="tests-page-title">Expenses</h1>

            <section className="tests-page-section">
              <h2 className="tests-page-section-title">Summary</h2>
              <p
                className="tests-page-section-desc"
                style={{ fontSize: "1.25rem", fontWeight: 600 }}
              >
                Total: {formatCurrency(total)}{" "}
                <span
                  className="tests-page-section-count"
                  aria-label="Number of expenses"
                >
                  ({expenses.length} expenses)
                </span>
              </p>
              {Object.keys(byCategory).length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, marginTop: "8px" }}>
                  {Object.entries(byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, sum]) => (
                      <li key={cat} style={{ marginBottom: "4px" }}>
                        {cat}: {formatCurrency(sum)}
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section className="tests-page-section">
              <ProjectSectionGuard
                projectsLoaded={projectsLoaded}
                selectedProjectId={selectedProjectId}
                message="Select a project to add expenses."
                variant="add"
              >
                <form
                  onSubmit={addExpense}
                  className="features-add-form"
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "flex-end",
                    marginTop: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <label htmlFor="expenses-amount">Amount ($)</label>
                    <input
                      id="expenses-amount"
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      aria-label="Amount"
                      className="project-nav-search"
                      style={{ width: "100px", padding: "8px 12px" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      flex: "1",
                      minWidth: "180px",
                    }}
                  >
                    <label htmlFor="expenses-description">Description</label>
                    <input
                      id="expenses-description"
                      ref={descriptionInputRef}
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What was this for?"
                      aria-label="Description"
                      className="project-nav-search"
                      style={{ padding: "8px 12px" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <label htmlFor="expenses-date">Date</label>
                    <input
                      id="expenses-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      aria-label="Date"
                      className="project-nav-search"
                      style={{ padding: "8px 12px" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <label htmlFor="expenses-category">Category</label>
                    <select
                      id="expenses-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      aria-label="Category"
                      className="project-nav-search"
                      style={{ padding: "8px 12px", minWidth: "120px" }}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="project-nav-add"
                    style={{ alignSelf: "flex-end" }}
                    aria-label="Add expense"
                    title="Add expense"
                  >
                    <IconPlus />
                  </button>
                </form>
              </ProjectSectionGuard>
            </section>

            <section className="tests-page-section">
              <h2 className="tests-page-section-title">
                Expense List{" "}
                <span className="tests-page-section-count" aria-label="Count">
                  {expenses.length}
                </span>
              </h2>
              <ProjectSectionGuard
                projectsLoaded={projectsLoaded}
                selectedProjectId={selectedProjectId}
                message="Select a project to see and manage expenses."
                variant="list"
              >
                {expensesLoading ? (
                  <LoadingMessage
                    className="tests-page-section-desc"
                  />
                ) : expenses.length === 0 ? (
                  <p className="tests-page-section-desc">
                    No expenses yet. Add one above.
                  </p>
                ) : (
                  <ul
                    className="features-list"
                    style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}
                  >
                    {expenses.map((item) => (
                      <li
                        key={item.id}
                        className="features-list-item"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                          padding: "10px 0",
                          borderBottom:
                            "1px solid var(--border-color, #e5e7eb)",
                        }}
                      >
                        <span style={{ fontWeight: 600, minWidth: "80px" }}>
                          {formatCurrency(item.amount)}
                        </span>
                        <span style={{ flex: "1", minWidth: "120px" }}>
                          {item.description}
                        </span>
                        <span
                          style={{
                            color: "var(--text-muted, #6b7280)",
                            fontSize: "0.9rem",
                          }}
                        >
                          {item.date}
                        </span>
                        {editingCategoryId === item.id ? (
                          <select
                            value={item.category}
                            onChange={(e) =>
                              updateExpenseCategory(item.id, e.target.value)
                            }
                            onBlur={() => setEditingCategoryId(null)}
                            autoFocus
                            aria-label={`Edit category for ${item.description}`}
                            className="project-nav-search"
                            style={{
                              fontSize: "0.85rem",
                              padding: "4px 8px",
                              minWidth: "100px",
                            }}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingCategoryId(item.id)}
                            style={{
                              fontSize: "0.85rem",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "2px 4px",
                              textAlign: "left",
                              color: "var(--text)",
                            }}
                            title="Click to edit category"
                            aria-label={`Edit category: ${item.category}`}
                          >
                            {item.category}
                          </button>
                        )}
                        <button
                          type="button"
                          className="features-list-remove"
                          onClick={() => removeExpense(item.id)}
                          aria-label={`Remove ${item.description}`}
                          title={`Remove "${item.description}"`}
                        >
                          <IconTrash />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </ProjectSectionGuard>
            </section>
          </div>
    </AppLayout>
  );
}
