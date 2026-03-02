import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { EXPENSE_CATEGORIES } from "@ideahome/shared";
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
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { useTheme } from "./_app";

const EXPENSES_STORAGE_PREFIX = "ideahome-expenses";
const LEGACY_EXPENSES_KEY = "ideahome-expenses";
const LEGACY_COSTS_KEY = "ideahome-costs-expenses";

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

function saveStoredExpensesLegacy(
  items: { amount: number; description: string; date: string; category: string }[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getExpensesStorageKey(), JSON.stringify(items));
  } catch {
    // best effort local fallback
  }
}

function formatExpenseDateDisplay(value: string): string {
  if (!value) return "Select date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
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

  const loadLocalExpensesForProject = (projectId: string): Expense[] => {
    return loadStoredExpensesLegacy().map((item, index) => ({
      id: `local-${projectId}-${index}-${item.date}`,
      amount: item.amount,
      description: item.description,
      date: item.date,
      category: item.category,
      projectId,
      createdAt: new Date().toISOString(),
    }));
  };

  useEffect(() => {
    if (!selectedProjectId) {
      setExpenses([]);
      return;
    }
    if (!isAuthenticated()) {
      setExpenses(loadLocalExpensesForProject(selectedProjectId));
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
    const desc = description.trim() || "Expense";
    if (!selectedProjectId) return;
    const entryDate = date || new Date().toISOString().slice(0, 10);
    const entryCategory = category || "Other";
    try {
      const created = await createExpense({
        projectId: selectedProjectId,
        amount: num,
        description: desc,
        date: entryDate,
        category: entryCategory,
      });
      setExpenses((prev) => [created, ...prev]);
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setCategory("Other");
      descriptionInputRef.current?.focus();
    } catch {
      const fallbackExpense: Expense = {
        id: `local-${Date.now()}`,
        amount: num,
        description: desc,
        date: entryDate,
        category: entryCategory,
        projectId: selectedProjectId,
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev) => [fallbackExpense, ...prev]);
      try {
        const local = loadStoredExpensesLegacy();
        local.unshift({
          amount: num,
          description: desc,
          date: entryDate,
          category: entryCategory,
        });
        localStorage.setItem(getExpensesStorageKey(), JSON.stringify(local));
      } catch {
        // best effort local fallback
      }
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      setCategory("Other");
      descriptionInputRef.current?.focus();
    }
  };

  const removeExpense = async (id: string) => {
    const previousExpenses = expenses;
    const nextExpenses = previousExpenses.filter((e) => e.id !== id);
    setExpenses(nextExpenses);

    const isLocalOnlyExpense = id.startsWith("local-") || !isAuthenticated();
    if (isLocalOnlyExpense) {
      saveStoredExpensesLegacy(
        nextExpenses.map((item) => ({
          amount: item.amount,
          description: item.description,
          date: item.date,
          category: item.category || "Other",
        }))
      );
      return;
    }

    try {
      await deleteExpense(id);
    } catch {
      setExpenses(previousExpenses);
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
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const canAddExpense =
    Boolean(selectedProjectId) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;

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
      onCreateProject={layout.createProjectByName}
    >
      {!projectsLoaded || (Boolean(selectedProjectId) && expensesLoading) ? (
        <div className="tests-page-single-loading">
          <SectionLoadingSpinner />
        </div>
      ) : (
      <div className="tests-page-content expenses-page-content">
        <h1 className="tests-page-title">Expenses</h1>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">Summary</h2>
          <p className="tests-page-section-desc expenses-total">
            Total: {formatCurrency(total)}{" "}
            <span
              className="tests-page-section-count"
              aria-label="Number of expenses"
            >
              ({expenses.length} expenses)
            </span>
          </p>
          {Object.keys(byCategory).length > 0 && (
            <ul className="expenses-summary-list">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, sum]) => (
                  <li key={cat}>
                    {cat}: {formatCurrency(sum)}
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section className="tests-page-section">
          <h2 className="tests-page-section-title">Add expense</h2>
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add expenses."
            variant="add"
          >
            <form onSubmit={addExpense} className="expenses-form">
              <div className="expenses-field expenses-field-amount">
                <label htmlFor="expenses-amount">Amount ($)</label>
                <input
                  id="expenses-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  aria-label="Amount"
                  className="expenses-input"
                />
              </div>
              <div className="expenses-field expenses-field-description">
                <label htmlFor="expenses-description">Description</label>
                <input
                  id="expenses-description"
                  ref={descriptionInputRef}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was this for?"
                  aria-label="Description"
                  className="expenses-input"
                />
              </div>
              <div className="expenses-field expenses-field-date">
                <label htmlFor="expenses-date">Date</label>
                <div className="expenses-date-control">
                  <input
                    id="expenses-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Date"
                    className="expenses-input expenses-date-native"
                  />
                  <span className="expenses-date-display" aria-hidden="true">
                    {formatExpenseDateDisplay(date)}
                  </span>
                </div>
              </div>
              <div className="expenses-field expenses-field-category">
                <label htmlFor="expenses-category">Category</label>
                <select
                  id="expenses-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Category"
                  className="expenses-input"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="project-nav-add expenses-add-btn"
                aria-label="Add expense"
                title="Add expense"
                disabled={!canAddExpense}
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
            {expenses.length === 0 ? (
              <p className="tests-page-section-desc">
                No expenses yet. Add one above.
              </p>
            ) : (
              <ul className="expenses-list">
                {expenses.map((item) => (
                  <li key={item.id} className="expenses-item">
                    <div className="expenses-item-main">
                      <span className="expenses-item-date">
                        {formatExpenseDateDisplay(item.date)}
                      </span>
                      <span className="expenses-item-description">
                        {item.description}
                      </span>
                      <span className="expenses-item-amount">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                    <div className="expenses-item-meta">
                      {editingCategoryId === item.id ? (
                        <select
                          value={item.category}
                          onChange={(e) =>
                            updateExpenseCategory(item.id, e.target.value)
                          }
                          onBlur={() => setEditingCategoryId(null)}
                          autoFocus
                          aria-label={`Edit category for ${item.description}`}
                          className="expenses-category-select"
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          className="expenses-category-btn"
                          onClick={() => setEditingCategoryId(item.id)}
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
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ProjectSectionGuard>
        </section>
      </div>
      )}
    </AppLayout>
  );
}
