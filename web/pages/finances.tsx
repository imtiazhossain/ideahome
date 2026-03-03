import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/router";
import { EXPENSE_CATEGORIES } from "@ideahome/shared";
import {
  createExpense,
  deleteAllImportedExpenses,
  deleteExpense,
  disconnectPlaidLinkedAccount,
  exchangePlaidToken,
  fetchExpenses,
  fetchPlaidLinkedAccounts,
  renamePlaidLinkedAccount,
  getPlaidLastSync,
  getPlaidLinkToken,
  getUserScopedStorageKey,
  isAuthenticated,
  syncPlaidTransactions,
  updateExpense,
  type Expense,
  type PlaidLinkedAccount,
} from "../lib/api";
import { formatCurrency, formatRelativeTime, toYYYYMMDD } from "../lib/utils";
import { useProjectLayout } from "../lib/useProjectLayout";
import { AppLayout } from "../components/AppLayout";
import { ExpenseCategoryDropdown } from "../components/ExpenseCategoryDropdown";
import {
  ExpensesDateFilterDropdown,
  dayOfMonthOrdinal,
  type DateFilterMode,
} from "../components/ExpensesDateFilterDropdown";
import { IconPlus } from "../components/IconPlus";
import { IconTrash } from "../components/IconTrash";
import { CalendarPickerPopup } from "../components/CalendarPickerPopup";
import { ProjectSectionGuard } from "../components/ProjectSectionGuard";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { CollapsibleSection } from "../components/CollapsibleSection";
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function expenseInDateFilter(
  expenseDate: string | undefined,
  mode: DateFilterMode,
  day?: string,
  dayOfMonth?: number,
  month?: number,
  year?: number,
  rangeStart?: string,
  rangeEnd?: string
): boolean {
  if (!expenseDate) return false;
  if (mode === "all") return true;
  const d = new Date(`${expenseDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  if (mode === "day" && day) {
    return expenseDate === day;
  }
  if (mode === "dayOfMonth" && dayOfMonth !== undefined) {
    return d.getDate() === dayOfMonth;
  }
  if (mode === "month" && month !== undefined && year !== undefined) {
    return d.getMonth() === month - 1 && d.getFullYear() === year;
  }
  if (mode === "year" && year !== undefined) {
    return d.getFullYear() === year;
  }
  if (mode === "range" && rangeStart && rangeEnd) {
    const start = new Date(`${rangeStart}T00:00:00`).getTime();
    const end = new Date(`${rangeEnd}T23:59:59`).getTime();
    const t = d.getTime();
    return t >= start && t <= end;
  }
  return true;
}

/** Mounts only when token is set; opens Link on mount. Unmount when token is null to get a fresh instance next time. */
function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
  onOpened,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: () => void;
  onOpened: () => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess, onExit });
  const openedRef = useRef(false);
  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
      onOpened();
    }
  }, [ready, open, onOpened]);
  return null;
}

export default function FinancialsPage() {
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
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const listCategoryDropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editingDescriptionId, setEditingDescriptionId] = useState<string | null>(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState("");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [addExpenseError, setAddExpenseError] = useState("");
  type SortField = "date" | "description" | "amount" | "category";
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const migratedFromStorageRef = useRef(false);

  const now = new Date();
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [filterDay, setFilterDay] = useState(toYYYYMMDD(now));
  const [filterDayOfMonth, setFilterDayOfMonth] = useState(now.getDate());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState(toYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [rangeEnd, setRangeEnd] = useState(toYYYYMMDD(now));
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((sectionId: string) => {
    setSectionCollapsed((prev) => ({
      ...prev,
      [sectionId]: !(prev[sectionId] ?? false),
    }));
  }, []);
  const isSectionCollapsed = useCallback(
    (sectionId: string) => sectionCollapsed[sectionId] ?? false,
    [sectionCollapsed]
  );

  const [linkedAccounts, setLinkedAccounts] = useState<PlaidLinkedAccount[]>([]);
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidError, setPlaidError] = useState("");
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [deleteImportedLoading, setDeleteImportedLoading] = useState(false);
  const [deleteImportedConfirming, setDeleteImportedConfirming] = useState(false);
  const prefetchedLinkTokenRef = useRef<string | null>(null);
  const plaidPendingOpenRef = useRef(false);
  const [plaidOpenTriggered, setPlaidOpenTriggered] = useState(false);
  const [editingLinkedAccountId, setEditingLinkedAccountId] = useState<string | null>(
    null
  );
  const [editingLinkedAccountName, setEditingLinkedAccountName] = useState("");
  const [renamingLinkedAccountId, setRenamingLinkedAccountId] = useState<string | null>(
    null
  );
  const [linkedAccountsCollapsed, setLinkedAccountsCollapsed] = useState(false);

  const importedCount = expenses.filter((e) => e.source === "plaid").length;
  const plaidConnectButtonLoading =
    plaidLoading || (plaidLinkToken != null && !plaidOpenTriggered);

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setPlaidError("");
      setPlaidLinkToken(null);
      setPlaidOpenTriggered(false);
      try {
        await exchangePlaidToken(publicToken);
        const list = await fetchPlaidLinkedAccounts();
        setLinkedAccounts(list);
      } catch (err) {
        setPlaidError(err instanceof Error ? err.message : "Failed to connect account");
      }
    },
    []
  );

  const onPlaidExit = useCallback(() => {
    plaidPendingOpenRef.current = false;
    setPlaidLinkToken(null);
    setPlaidOpenTriggered(false);
    prefetchedLinkTokenRef.current = null;
  }, []);

  const onPlaidOpened = useCallback(() => {
    setPlaidOpenTriggered(true);
  }, []);

  useEffect(() => {
    if (!plaidPendingOpenRef.current || plaidLinkToken != null || !isAuthenticated()) return;
    plaidPendingOpenRef.current = false;
    setPlaidLoading(true);
    getPlaidLinkToken()
      .then(({ linkToken }) => setPlaidLinkToken(linkToken))
      .catch((err) => {
        setPlaidError(err instanceof Error ? err.message : "Could not start connection");
        setPlaidOpenTriggered(false);
      })
      .finally(() => setPlaidLoading(false));
  }, [plaidLinkToken]);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLinkedAccounts([]);
      return;
    }
    fetchPlaidLinkedAccounts()
      .then(setLinkedAccounts)
      .catch(() => setLinkedAccounts([]));
  }, []);

  useEffect(() => {
    if (!selectedProjectId || linkedAccounts.length === 0 || !isAuthenticated()) {
      setLastSyncedAt(null);
      return;
    }
    getPlaidLastSync(selectedProjectId)
      .then(({ lastSyncedAt: t }) => setLastSyncedAt(t))
      .catch(() => setLastSyncedAt(null));
  }, [selectedProjectId, linkedAccounts.length]);

  useEffect(() => {
    if (lastSyncedAt != null) return;
    const plaidExpenses = expenses.filter((e) => e.source === "plaid" && e.createdAt);
    if (plaidExpenses.length === 0) return;
    const latest = plaidExpenses.reduce((max, e) =>
      new Date(e.createdAt) > new Date(max.createdAt) ? e : max
    );
    if (latest.createdAt) {
      setLastSyncedAt(new Date(latest.createdAt).toISOString());
    }
  }, [expenses, lastSyncedAt]);

  const prefetchPlaidLinkToken = useCallback(() => {
    if (!isAuthenticated() || plaidLinkToken || plaidLoading || prefetchedLinkTokenRef.current) return;
    getPlaidLinkToken()
      .then(({ linkToken }) => {
        prefetchedLinkTokenRef.current = linkToken;
      })
      .catch(() => {});
  }, [plaidLinkToken, plaidLoading]);

  const handleConnectPlaid = useCallback(() => {
    setPlaidError("");
    setPlaidOpenTriggered(false);
    const prefetched = prefetchedLinkTokenRef.current;
    if (prefetched) {
      prefetchedLinkTokenRef.current = null;
      setPlaidLinkToken(prefetched);
      return;
    }
    plaidPendingOpenRef.current = true;
    setPlaidLinkToken(null);
  }, []);

  const handleSyncPlaid = useCallback(async () => {
    if (!selectedProjectId) return;
    setPlaidError("");
    setSyncLoading(true);
    try {
      const { added, lastSyncedAt: next } = await syncPlaidTransactions(selectedProjectId);
      if (next != null) setLastSyncedAt(next);
      if (added > 0) {
        const data = await fetchExpenses(selectedProjectId);
        setExpenses(data);
      }
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncLoading(false);
    }
  }, [selectedProjectId]);

  const handleDisconnectPlaid = useCallback(async (plaidItemId: string) => {
    setPlaidError("");
    try {
      await disconnectPlaidLinkedAccount(plaidItemId);
      const list = await fetchPlaidLinkedAccounts();
      setLinkedAccounts(list);
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }, []);

  const startEditingLinkedAccount = useCallback((acc: PlaidLinkedAccount) => {
    setEditingLinkedAccountId(acc.id);
    setEditingLinkedAccountName(acc.institutionName ?? "");
  }, []);

  const cancelEditingLinkedAccount = useCallback(() => {
    setEditingLinkedAccountId(null);
    setEditingLinkedAccountName("");
  }, []);

  const saveLinkedAccountName = useCallback(
    async (accId: string, name: string) => {
      const trimmed = name.trim();
      const current = linkedAccounts.find((a) => a.id === accId);
      const currentName = current?.institutionName ?? "";
      if (trimmed === currentName) {
        setEditingLinkedAccountId(null);
        return;
      }
      setEditingLinkedAccountId(null);
      setRenamingLinkedAccountId(accId);
      try {
        const updated = await renamePlaidLinkedAccount(
          accId,
          trimmed === "" ? null : trimmed
        );
        setLinkedAccounts((prev) =>
          prev.map((acc) => (acc.id === accId ? updated : acc))
        );
        setPlaidError("");
      } catch (err) {
        setPlaidError(
          err instanceof Error ? err.message : "Failed to rename account"
        );
      } finally {
        setRenamingLinkedAccountId(null);
      }
    },
    [linkedAccounts]
  );

  const handleDeleteAllImportedConfirm = useCallback(() => {
    setDeleteImportedConfirming(true);
  }, []);

  const handleDeleteAllImportedCancel = useCallback(() => {
    setDeleteImportedConfirming(false);
    setPlaidError("");
  }, []);

  const handleDeleteAllImportedSubmit = useCallback(async () => {
    if (!selectedProjectId || importedCount === 0) return;
    setPlaidError("");
    setDeleteImportedLoading(true);
    setDeleteImportedConfirming(false);
    try {
      const { deleted } = await deleteAllImportedExpenses(selectedProjectId);
      const data = await fetchExpenses(selectedProjectId);
      setExpenses(data);
      if (deleted > 0) {
        setPlaidError("");
      }
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : "Failed to delete imported expenses");
    } finally {
      setDeleteImportedLoading(false);
    }
  }, [selectedProjectId, importedCount]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "date" || field === "amount" ? "desc" : "asc");
    }
  };

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

  useEffect(() => {
    if (!categoryDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [categoryDropdownOpen]);

  useEffect(() => {
    if (!datePickerOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [datePickerOpen]);

  useEffect(() => {
    if (!editingCategoryId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        listCategoryDropdownRef.current &&
        !listCategoryDropdownRef.current.contains(event.target as Node)
      ) {
        setEditingCategoryId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCategoryId]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddExpenseError("");
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
    } catch (err) {
      if (isAuthenticated()) {
        setAddExpenseError(
          err instanceof Error ? err.message : "Failed to save expense to server. Check your connection and try again."
        );
        return;
      }
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

  const startEditingDescription = (item: Expense) => {
    setEditingDescriptionId(item.id);
    setEditingDescriptionValue(item.description ?? "");
  };

  const saveExpenseDescription = async (id: string, newDescription: string) => {
    const trimmed = newDescription.trim();
    setEditingDescriptionId(null);
    const previousExpenses = expenses;
    const item = expenses.find((e) => e.id === id);
    if (!item || trimmed === (item.description ?? "")) return;
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, description: trimmed } : e))
    );
    try {
      await updateExpense(id, { description: trimmed });
    } catch {
      setExpenses(previousExpenses);
    }
  };

  const cancelEditingDescription = () => {
    setEditingDescriptionId(null);
  };

  const expenseSearchLower = expenseSearchQuery.trim().toLowerCase();
  const filteredExpensesRaw = expenses.filter((e) => {
    if (!expenseInDateFilter(
      e.date,
      dateFilterMode,
      dateFilterMode === "day" ? filterDay : undefined,
      dateFilterMode === "dayOfMonth" ? filterDayOfMonth : undefined,
      dateFilterMode === "month" ? filterMonth : undefined,
      dateFilterMode === "month" || dateFilterMode === "year" ? filterYear : undefined,
      dateFilterMode === "range" ? rangeStart : undefined,
      dateFilterMode === "range" ? rangeEnd : undefined
    )) {
      return false;
    }
    if (categoryFilter !== null && (e.category || "Other") !== categoryFilter) {
      return false;
    }
    if (expenseSearchLower === "") return true;
    const desc = (e.description ?? "").toLowerCase();
    const cat = (e.category ?? "").toLowerCase();
    const dateRaw = (e.date ?? "").toLowerCase();
    const dateDisplay = formatExpenseDateDisplay(e.date).toLowerCase();
    const amountStr = String(e.amount).toLowerCase();
    return (
      desc.includes(expenseSearchLower) ||
      cat.includes(expenseSearchLower) ||
      dateRaw.includes(expenseSearchLower) ||
      dateDisplay.includes(expenseSearchLower) ||
      amountStr.includes(expenseSearchLower)
    );
  });

  const filteredExpenses = [...filteredExpensesRaw].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "date") {
      const da = new Date(`${a.date ?? ""}T00:00:00`).getTime();
      const db = new Date(`${b.date ?? ""}T00:00:00`).getTime();
      cmp = da - db;
    } else if (sortBy === "description") {
      cmp = (a.description ?? "").localeCompare(b.description ?? "", undefined, { sensitivity: "base" });
    } else if (sortBy === "amount") {
      cmp = a.amount - b.amount;
    } else {
      cmp = (a.category ?? "").localeCompare(b.category ?? "", undefined, { sensitivity: "base" });
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const expensesForSummary =
    dateFilterMode === "all"
      ? expenses
      : expenses.filter((e) =>
          expenseInDateFilter(
            e.date,
            dateFilterMode,
            dateFilterMode === "day" ? filterDay : undefined,
            dateFilterMode === "dayOfMonth" ? filterDayOfMonth : undefined,
            dateFilterMode === "month" ? filterMonth : undefined,
            dateFilterMode === "month" || dateFilterMode === "year" ? filterYear : undefined,
            dateFilterMode === "range" ? rangeStart : undefined,
            dateFilterMode === "range" ? rangeEnd : undefined
          )
        );
  const total = expensesForSummary.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = expensesForSummary.reduce<Record<string, number>>((acc, e) => {
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
      title="Finances · Idea Home"
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
        {plaidLinkToken != null && (
          <PlaidLinkLauncher
            key={plaidLinkToken}
            token={plaidLinkToken}
            onSuccess={onPlaidSuccess}
            onExit={onPlaidExit}
            onOpened={onPlaidOpened}
          />
        )}
        <h1 className="tests-page-title">Finances</h1>

        <CollapsibleSection
          sectionId="expenses-summary"
          title={
            <>
              Summary{" "}
              {dateFilterMode !== "all" && (
                <span className="expenses-summary-period" aria-hidden="true">
                  {dateFilterMode === "day" && formatExpenseDateDisplay(filterDay)}
                  {dateFilterMode === "dayOfMonth" && `${dayOfMonthOrdinal(filterDayOfMonth)} of every month`}
                  {dateFilterMode === "month" && `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
                  {dateFilterMode === "year" && String(filterYear)}
                  {dateFilterMode === "range" && `${rangeStart} – ${rangeEnd}`}
                </span>
              )}{" "}
              <span
                className="tests-page-section-count"
                aria-label="Number of expenses"
              >
                {expensesForSummary.length} Expenses
              </span>
            </>
          }
          collapsed={isSectionCollapsed("expenses-summary")}
          onToggle={() => toggleSection("expenses-summary")}
          sectionClassName="expenses-summary-section"
        >
          <div className="expenses-summary-total" aria-label="Total amount">
            {formatCurrency(total)}
          </div>
          {Object.keys(byCategory).length > 0 && (
            <ul className="expenses-summary-list" aria-label="By category">
              {Object.entries(byCategory)
                .sort(([catA, sumA], [catB, sumB]) =>
                  sumB !== sumA ? sumB - sumA : catA.localeCompare(catB)
                )
                .map(([cat, sum]) => (
                  <li key={cat} className="expenses-summary-list-item">
                    <button
                      type="button"
                      className={
                        "expenses-summary-list-item-btn" +
                        (categoryFilter === cat ? " is-selected" : "")
                      }
                      onClick={() =>
                        setCategoryFilter((prev) => (prev === cat ? null : cat))
                      }
                      aria-pressed={categoryFilter === cat}
                      aria-label={
                        categoryFilter === cat
                          ? `Show all categories (currently filtering by ${cat})`
                          : `Show only ${cat} expenses`
                      }
                    >
                      <span className="expenses-summary-category">{cat}</span>
                      <span className="expenses-summary-amount">
                        {formatCurrency(sum)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </CollapsibleSection>

        {!isAuthenticated() && (
          <CollapsibleSection
            sectionId="expenses-auth-notice"
            title="Sync notice"
            collapsed={isSectionCollapsed("expenses-auth-notice")}
            onToggle={() => toggleSection("expenses-auth-notice")}
            sectionClassName="expenses-auth-notice"
          >
            <p className="expenses-auth-notice-text" role="status">
              Expenses are stored on this device only. Sign in to save them to your account and sync across devices.
            </p>
          </CollapsibleSection>
        )}
        {isAuthenticated() && (
          <CollapsibleSection
            sectionId="expenses-plaid"
            title="Link Financials"
            collapsed={isSectionCollapsed("expenses-plaid")}
            onToggle={() => toggleSection("expenses-plaid")}
            sectionClassName="expenses-plaid-section"
            headingId="expenses-plaid-heading"
          >
            <p className="expenses-plaid-desc">
              Connect a bank or credit card to import transactions as expenses.
            </p>
            {plaidError && (
              <p className="expenses-error-notice-text" role="alert">{plaidError}</p>
            )}
            <div className="expenses-plaid-actions">
              <button
                type="button"
                className="project-nav-add expenses-plaid-connect-btn"
                onClick={handleConnectPlaid}
                onMouseEnter={prefetchPlaidLinkToken}
                onFocus={prefetchPlaidLinkToken}
                disabled={plaidConnectButtonLoading}
                aria-label="Connect bank or card"
                aria-busy={plaidConnectButtonLoading}
              >
                {plaidConnectButtonLoading && (
                  <span className="upload-spinner upload-spinner--btn" aria-hidden="true" />
                )}
                <span className="expenses-plaid-connect-btn-text">
                  {plaidConnectButtonLoading ? "Connecting…" : "Connect bank or card"}
                </span>
              </button>
              {linkedAccounts.length > 0 && selectedProjectId && (
                <div className="expenses-plaid-action">
                  <button
                    type="button"
                    className="project-nav-add expenses-plaid-sync-btn"
                    onClick={handleSyncPlaid}
                    disabled={syncLoading}
                    aria-label="Sync transactions into expenses"
                    aria-busy={syncLoading}
                  >
                    {syncLoading ? "Syncing…" : "Sync transactions"}
                  </button>
                  {lastSyncedAt != null && (
                    <span className="expenses-plaid-last-synced" role="status">
                      Last synced {formatRelativeTime(lastSyncedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
            {linkedAccounts.length > 0 && (
              <div className="expenses-plaid-linked-wrap">
                <button
                  type="button"
                  className={
                    "expenses-plaid-linked-toggle" +
                    (linkedAccountsCollapsed ? " is-collapsed" : "")
                  }
                  onClick={() =>
                    setLinkedAccountsCollapsed((prev) => !prev)
                  }
                  aria-expanded={!linkedAccountsCollapsed}
                  aria-controls="expenses-plaid-linked-list"
                >
                  <span
                    className="expenses-plaid-linked-toggle-chevron"
                    aria-hidden="true"
                  >
                    ▶
                  </span>
                  <span className="expenses-plaid-linked-toggle-label">
                    Linked accounts
                  </span>
                  <span className="tests-page-section-count">
                    {linkedAccounts.length}
                  </span>
                </button>
                {!linkedAccountsCollapsed && (
                  <ul
                    id="expenses-plaid-linked-list"
                    className="expenses-plaid-linked-list"
                    aria-label="Linked accounts"
                  >
                    {linkedAccounts.map((acc) => (
                      <li key={acc.id} className="expenses-plaid-linked-item">
                        {editingLinkedAccountId === acc.id ? (
                          <input
                            type="text"
                            value={editingLinkedAccountName}
                            onChange={(e) =>
                              setEditingLinkedAccountName(e.target.value)
                            }
                            onBlur={() =>
                              saveLinkedAccountName(acc.id, editingLinkedAccountName)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelEditingLinkedAccount();
                              }
                            }}
                            autoFocus
                            aria-label="Edit linked account name"
                            className="expenses-item-description-input"
                          />
                        ) : (
                          <span
                            className="expenses-plaid-linked-name expenses-item-description-editable"
                            role="button"
                            tabIndex={0}
                            onClick={() => startEditingLinkedAccount(acc)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                startEditingLinkedAccount(acc);
                              }
                            }}
                            title="Click to rename account"
                            aria-label={`Rename ${acc.institutionName ?? "account"}`}
                          >
                            {acc.institutionName ?? "Bank or card"}
                          </span>
                        )}
                        <button
                          type="button"
                          className="expenses-plaid-disconnect-btn"
                          onClick={() => handleDisconnectPlaid(acc.id)}
                          disabled={renamingLinkedAccountId === acc.id}
                          aria-label={`Disconnect ${acc.institutionName ?? "account"}`}
                        >
                          Disconnect
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {importedCount > 0 && selectedProjectId && (
              <div className="expenses-plaid-delete-imported-wrap">
                {deleteImportedConfirming ? (
                  <>
                    <span className="expenses-plaid-delete-imported-prompt">
                      Delete all {importedCount} imported? Cannot be undone.
                    </span>
                    <div className="expenses-plaid-delete-imported-actions">
                      <button
                        type="button"
                        className="expenses-plaid-delete-imported-btn expenses-plaid-delete-imported-cancel"
                        onClick={handleDeleteAllImportedCancel}
                        disabled={deleteImportedLoading}
                        aria-label="Cancel"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="expenses-plaid-delete-imported-btn"
                        onClick={handleDeleteAllImportedSubmit}
                        disabled={deleteImportedLoading}
                        aria-label={`Delete all ${importedCount} imported expenses`}
                      >
                        {deleteImportedLoading ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="expenses-plaid-delete-imported-btn"
                    onClick={handleDeleteAllImportedConfirm}
                    disabled={deleteImportedLoading}
                    aria-label={`Delete all ${importedCount} imported expenses`}
                  >
                    Delete all imported expenses ({importedCount})
                  </button>
                )}
              </div>
            )}
          </CollapsibleSection>
        )}
        {addExpenseError && (
          <section className="tests-page-section expenses-error-notice" role="alert">
            <p className="expenses-error-notice-text">{addExpenseError}</p>
          </section>
        )}
        <CollapsibleSection
          sectionId="expenses-add-and-list"
          title={
            <>
              Expenses{" "}
              <span className="tests-page-section-count" aria-label="Count">
                {categoryFilter
                  ? `${filteredExpenses.length} of ${expenses.length} (${categoryFilter})`
                  : expenseSearchQuery.trim()
                    ? `${filteredExpenses.length} of ${expenses.length}`
                    : dateFilterMode !== "all"
                      ? `${filteredExpenses.length} of ${expenses.length}`
                      : expenses.length}
              </span>
            </>
          }
          collapsed={isSectionCollapsed("expenses-add-and-list")}
          onToggle={() => toggleSection("expenses-add-and-list")}
          sectionClassName="expenses-add-section expenses-list-section"
          headerExtra={
            expenses.length > 0 ? (
              <div className="expenses-list-controls">
                <ExpensesDateFilterDropdown
                  mode={dateFilterMode}
                  filterDay={filterDay}
                  filterDayOfMonth={filterDayOfMonth}
                  filterMonth={filterMonth}
                  filterYear={filterYear}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  onModeChange={setDateFilterMode}
                  onFilterDayChange={setFilterDay}
                  onFilterDayOfMonthChange={setFilterDayOfMonth}
                  onFilterMonthChange={setFilterMonth}
                  onFilterYearChange={setFilterYear}
                  onRangeStartChange={setRangeStart}
                  onRangeEndChange={setRangeEnd}
                  open={dateFilterOpen}
                  onOpenChange={setDateFilterOpen}
                />
                <div className="expenses-list-search-wrap">
                  <input
                    id="expenses-list-search"
                    type="search"
                    value={expenseSearchQuery}
                    onChange={(e) => setExpenseSearchQuery(e.target.value)}
                    placeholder="Search Expenses"
                    aria-label="Search expenses"
                    className="expenses-input expenses-list-search"
                  />
                </div>
              </div>
            ) : undefined
          }
        >
            <ProjectSectionGuard
              projectsLoaded={projectsLoaded}
              selectedProjectId={selectedProjectId}
              message="Select a project to add expenses."
              variant="add"
            >
              <form onSubmit={addExpense} className="expenses-form">
                <div
                  className="expenses-field expenses-field-date"
                  ref={datePickerRef}
                >
                  <label htmlFor="expenses-date-trigger">Date</label>
                  <div className="expenses-date-control">
                    <button
                      type="button"
                      id="expenses-date-trigger"
                      className="expenses-input expenses-date-trigger"
                      onClick={() => setDatePickerOpen((open) => !open)}
                      aria-haspopup="dialog"
                      aria-expanded={datePickerOpen}
                      aria-label="Choose date"
                    >
                      {formatExpenseDateDisplay(date)}
                    </button>
                    {datePickerOpen && (
                      <CalendarPickerPopup
                        value={date}
                        onChange={(dateStr) => {
                          setDate(dateStr);
                          setDatePickerOpen(false);
                        }}
                        onClose={() => setDatePickerOpen(false)}
                        showClear
                        showToday
                      />
                    )}
                  </div>
                </div>
                <div className="expenses-field expenses-field-description">
                  <label htmlFor="expenses-description">Description</label>
                  <input
                    id="expenses-description"
                    ref={descriptionInputRef}
                    type="text"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setAddExpenseError("");
                    }}
                    placeholder="What was this for?"
                    aria-label="Description"
                    className="expenses-input"
                  />
                </div>
                <div className="expenses-field expenses-field-amount">
                  <label htmlFor="expenses-amount">Amount ($)</label>
                  <input
                    id="expenses-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^-?\d*\.?\d*$/.test(v)) {
                        setAmount(v);
                        setAddExpenseError("");
                      }
                    }}
                    placeholder="0.00"
                    aria-label="Amount"
                    className="expenses-input"
                  />
                </div>
                <div className="expenses-field expenses-field-category">
                  <label htmlFor="expenses-category-trigger">Category</label>
                  <ExpenseCategoryDropdown
                    ref={categoryDropdownRef}
                    value={category}
                    onChange={setCategory}
                    categories={EXPENSE_CATEGORIES}
                    open={categoryDropdownOpen}
                    onOpenChange={setCategoryDropdownOpen}
                    variant="form"
                    listboxId="expenses-category-listbox"
                    triggerAriaLabel="Category"
                    triggerId="expenses-category-trigger"
                  />
                </div>
                <button
                  type="submit"
                  className="project-nav-add expenses-add-btn"
                  aria-label="Add Expense"
                  title="Add Expense"
                  disabled={!canAddExpense}
                >
                  <IconPlus />
                </button>
              </form>
            </ProjectSectionGuard>
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
              ) : filteredExpenses.length === 0 ? (
                <p className="tests-page-section-desc">
                  No expenses match your filters.
                </p>
              ) : (
                <>
                  <div className="expenses-list-table">
                <div className="expenses-list-header" role="presentation">
                  <button
                    type="button"
                    className={"expenses-list-header-label" + (sortBy === "date" ? " is-active" : "")}
                    onClick={() => handleSort("date")}
                    aria-label={`Sort by date ${sortBy === "date" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                    title="Sort by date"
                  >
                    Date{sortBy === "date" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                  <button
                    type="button"
                    className={"expenses-list-header-label" + (sortBy === "description" ? " is-active" : "")}
                    onClick={() => handleSort("description")}
                    aria-label={`Sort by description ${sortBy === "description" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                    title="Sort by description"
                  >
                    Description{sortBy === "description" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                    <button
                      type="button"
                      className={"expenses-list-header-label expenses-list-header-amount" + (sortBy === "amount" ? " is-active" : "")}
                      onClick={() => handleSort("amount")}
                    aria-label={`Sort by amount ${sortBy === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                    title="Sort by amount"
                  >
                    Amount{sortBy === "amount" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                    <button
                      type="button"
                      className={"expenses-list-header-label expenses-list-header-category" + (sortBy === "category" ? " is-active" : "")}
                      onClick={() => handleSort("category")}
                    aria-label={`Sort by category ${sortBy === "category" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                    title="Sort by category"
                  >
                    Category{sortBy === "category" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                  <span className="expenses-list-header-spacer" aria-hidden="true" />
                </div>
                <ul className="expenses-list" role="list">
                {filteredExpenses.map((item) => (
                  <li key={item.id} className="expenses-item">
                    <span className="expenses-item-date">
                      {formatExpenseDateDisplay(item.date)}
                    </span>
                    {editingDescriptionId === item.id ? (
                      <input
                        type="text"
                        value={editingDescriptionValue}
                        onChange={(e) =>
                          setEditingDescriptionValue(e.target.value)
                        }
                        onBlur={() =>
                          saveExpenseDescription(item.id, editingDescriptionValue)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          } else if (e.key === "Escape") {
                            cancelEditingDescription();
                          }
                        }}
                        autoFocus
                        aria-label="Edit description for expense"
                        className="expenses-item-description-input"
                      />
                    ) : (
                      <span
                        className="expenses-item-description expenses-item-description-editable"
                        role="button"
                        tabIndex={0}
                        onClick={() => startEditingDescription(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startEditingDescription(item);
                          }
                        }}
                        title="Click to edit description"
                        aria-label={`Edit description: ${item.description ?? ""}`}
                      >
                        {item.description}
                      </span>
                    )}
                    <span className="expenses-item-amount">
                      {formatCurrency(item.amount)}
                    </span>
                    {editingCategoryId === item.id ? (
                      <ExpenseCategoryDropdown
                        ref={listCategoryDropdownRef}
                        value={item.category}
                        onChange={(c) => {
                          updateExpenseCategory(item.id, c);
                          setEditingCategoryId(null);
                        }}
                        categories={EXPENSE_CATEGORIES}
                        open={true}
                        onOpenChange={(open) => {
                          if (!open) setEditingCategoryId(null);
                        }}
                        variant="inline"
                        listboxId={`expenses-list-category-listbox-${item.id}`}
                        triggerAriaLabel={`Edit category: ${item.category}`}
                        title="Click to edit category"
                      />
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
                  </li>
                ))}
                </ul>
                  </div>
                </>
              )}
            </ProjectSectionGuard>
        </CollapsibleSection>
      </div>
      )}
    </AppLayout>
  );
}

