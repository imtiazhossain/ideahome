import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
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
import { useProjectLayout } from "../lib/useProjectLayout";
import { ProjectNavBar, DrawerCollapsedNav } from "../components/ProjectNavBar";
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
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

const IconTrash = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount);
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
    <>
      <Head>
        <title>Expenses · Idea Home</title>
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
                  <Link href="/tests" className="drawer-nav-item">
                    Tests
                  </Link>
                  <Link href="/features" className="drawer-nav-item">
                    Features
                  </Link>
                  <Link href="/bugs" className="drawer-nav-item">
                    Bugs
                  </Link>
                  <Link
                    href="/expenses"
                    className="drawer-nav-item is-selected"
                  >
                    Expenses
                  </Link>
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
              activeTab="expenses"
              onExpand={() => setDrawerOpen(true)}
            />
          )}
        </aside>

        <main className="main-content">
          <ProjectNavBar
            projectName={projectDisplayName}
            projectId={selectedProjectId || undefined}
            activeTab="expenses"
            searchPlaceholder="Search project"
            projects={projects}
            selectedProjectId={selectedProjectId || undefined}
            onSelectProject={setSelectedProjectId}
            onCreateProject={() => router.push("/?createProject=1")}
          />

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
                <p className="tests-page-section-desc">Loading…</p>
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
                        borderBottom: "1px solid var(--border-color, #e5e7eb)",
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
        </main>
      </div>
    </>
  );
}
