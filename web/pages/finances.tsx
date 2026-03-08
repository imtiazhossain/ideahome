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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import type {
  PlaidLinkError,
  PlaidLinkOnEventMetadata,
  PlaidLinkOnExitMetadata,
} from "react-plaid-link";
import { useRouter } from "next/router";
import {
  createTaxDocument,
  createExpense,
  deleteAllImportedExpenses,
  deleteTaxDocument,
  deleteExpense,
  downloadTaxDocument,
  disconnectPlaidLinkedAccount,
  exchangePlaidToken,
  fetchExpenses,
  fetchPlaidLinkedAccounts,
  fetchTaxDocuments,
  renamePlaidLinkedAccount,
  getPlaidLastSync,
  getPlaidLinkToken,
  isAuthenticated,
  syncPlaidTransactions,
  updateTaxDocument,
  updateExpense,
  type Expense,
  type PlaidLinkedAccount,
} from "../lib/api";
import { toYYYYMMDD } from "../lib/utils";
import { useProjectLayout } from "../lib/useProjectLayout";
import { AppLayout } from "../components/AppLayout";
import { type DateFilterMode } from "../components/ExpensesDateFilterDropdown";
import { SectionLoadingSpinner } from "../components/SectionLoadingSpinner";
import { useTheme } from "./_app";
import {
  PlaidLinkLauncher,
  SortableFinancesSection,
} from "../features/finances/components";
import { FinancesSectionContent } from "../features/finances/sections";
import {
  FINANCES_DRAGGABLE_SECTION_IDS,
  TAX_CHECKLIST_ITEMS,
  clearStoredExpensesLegacy,
  defaultTaxChecklistState,
  fileToBase64,
  filterAndSortExpenses,
  getExpensesStorageKey,
  getTaxChecklistStorageKey,
  getTaxDocsStorageKey,
  inferTaxDocumentKind,
  inferTaxYear,
  loadStoredExpensesLegacy,
  normalizeFinancesSectionOrder,
  readTaxTextPreview,
  saveStoredExpensesLegacy,
  type TaxChecklistState,
  type TaxDocument,
  type TaxDocumentKind,
  type ExpenseSortField,
} from "../features/finances/utils";

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
  const [editingDescriptionId, setEditingDescriptionId] = useState<
    string | null
  >(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState("");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [addExpenseError, setAddExpenseError] = useState("");
  const [sortBy, setSortBy] = useState<ExpenseSortField>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const migratedFromStorageRef = useRef(false);

  const now = new Date();
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [filterDay, setFilterDay] = useState(toYYYYMMDD(now));
  const [filterDayOfMonth, setFilterDayOfMonth] = useState(now.getDate());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState(
    toYYYYMMDD(new Date(now.getFullYear(), now.getMonth(), 1))
  );
  const [rangeEnd, setRangeEnd] = useState(toYYYYMMDD(now));
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState<
    Record<string, boolean>
  >({});
  const financesSectionOrderStorageKey = `ideahome-finances-section-order${selectedProjectId ? `-${selectedProjectId}` : ""}`;
  const financesSectionCollapsedStorageKey = `ideahome-finances-section-collapsed${selectedProjectId ? `-${selectedProjectId}` : ""}`;
  const linkedAccountsCollapsedStorageKey = `ideahome-finances-linked-accounts-collapsed${selectedProjectId ? `-${selectedProjectId}` : ""}`;
  const [financesSectionOrder, setFinancesSectionOrder] = useState<string[]>([
    ...FINANCES_DRAGGABLE_SECTION_IDS,
  ]);
  const hydratedFinancesSectionOrderKeyRef = useRef<string | null>(null);
  const [taxDocuments, setTaxDocuments] = useState<TaxDocument[]>([]);
  const [taxChecklist, setTaxChecklist] = useState<TaxChecklistState>(
    defaultTaxChecklistState
  );
  const [taxUploadError, setTaxUploadError] = useState("");
  const [taxUploading, setTaxUploading] = useState(false);
  const taxUploadInputRef = useRef<HTMLInputElement>(null);

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openTaxFilePicker = useCallback(() => {
    taxUploadInputRef.current?.click();
  }, []);

  const [linkedAccounts, setLinkedAccounts] = useState<PlaidLinkedAccount[]>(
    []
  );
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidError, setPlaidError] = useState("");
  const [plaidLoading, setPlaidLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [deleteImportedLoading, setDeleteImportedLoading] = useState(false);
  const [deleteImportedConfirming, setDeleteImportedConfirming] =
    useState(false);
  const prefetchedLinkTokenRef = useRef<string | null>(null);
  const [plaidOpenTriggered, setPlaidOpenTriggered] = useState(false);
  const [editingLinkedAccountId, setEditingLinkedAccountId] = useState<
    string | null
  >(null);
  const [editingLinkedAccountName, setEditingLinkedAccountName] = useState("");
  const [renamingLinkedAccountId, setRenamingLinkedAccountId] = useState<
    string | null
  >(null);
  const [linkedAccountsCollapsed, setLinkedAccountsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(financesSectionCollapsedStorageKey);
      if (!raw) {
        setSectionCollapsed({});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setSectionCollapsed({});
        return;
      }
      const valid = new Set<string>([
        "expenses-summary",
        "expenses-auth-notice",
        "expenses-plaid",
        "expenses-taxes",
        "expenses-add-and-list",
      ]);
      const next: Record<string, boolean> = {};
      for (const [id, collapsed] of Object.entries(
        parsed as Record<string, unknown>
      )) {
        if (!valid.has(id) || typeof collapsed !== "boolean") continue;
        next[id] = collapsed;
      }
      setSectionCollapsed(next);
    } catch {
      setSectionCollapsed({});
    }
  }, [financesSectionCollapsedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        financesSectionCollapsedStorageKey,
        JSON.stringify(sectionCollapsed)
      );
    } catch {
      // ignore
    }
  }, [financesSectionCollapsedStorageKey, sectionCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(linkedAccountsCollapsedStorageKey);
      setLinkedAccountsCollapsed(raw === "true");
    } catch {
      setLinkedAccountsCollapsed(false);
    }
  }, [linkedAccountsCollapsedStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        linkedAccountsCollapsedStorageKey,
        String(linkedAccountsCollapsed)
      );
    } catch {
      // ignore
    }
  }, [linkedAccountsCollapsed, linkedAccountsCollapsedStorageKey]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      hydratedFinancesSectionOrderKeyRef.current !==
        financesSectionOrderStorageKey
    ) {
      return;
    }
    try {
      localStorage.setItem(
        financesSectionOrderStorageKey,
        JSON.stringify(financesSectionOrder)
      );
    } catch {
      // ignore
    }
  }, [financesSectionOrder, financesSectionOrderStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(financesSectionOrderStorageKey);
      if (!raw) {
        setFinancesSectionOrder([...FINANCES_DRAGGABLE_SECTION_IDS]);
      } else {
        setFinancesSectionOrder(
          normalizeFinancesSectionOrder(JSON.parse(raw) as unknown)
        );
      }
    } catch {
      setFinancesSectionOrder([...FINANCES_DRAGGABLE_SECTION_IDS]);
    }
    hydratedFinancesSectionOrderKeyRef.current = financesSectionOrderStorageKey;
  }, [financesSectionOrderStorageKey]);

  const importedCount = expenses.filter((e) => e.source === "plaid").length;
  const plaidConnectButtonLoading =
    plaidLoading || (plaidLinkToken != null && !plaidOpenTriggered);

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setPlaidError("");
    setPlaidLinkToken(null);
    setPlaidOpenTriggered(false);
    try {
      await exchangePlaidToken(publicToken);
      const list = await fetchPlaidLinkedAccounts();
      setLinkedAccounts(list);
    } catch (err) {
      setPlaidError(
        err instanceof Error ? err.message : "Failed to connect account"
      );
    }
  }, []);

  const onPlaidExit = useCallback(
    (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
      if (error) {
        const code = error.error_code?.trim();
        const message =
          error.display_message?.trim() ||
          error.error_message?.trim() ||
          "Plaid Link exited with an error";
        const requestId = metadata?.request_id?.trim();
        setPlaidError(
          code
            ? `Plaid ${code}: ${message}${requestId ? ` (request: ${requestId})` : ""}`
            : `${message}${requestId ? ` (request: ${requestId})` : ""}`
        );
      }
      setPlaidLinkToken(null);
      setPlaidOpenTriggered(false);
      prefetchedLinkTokenRef.current = null;
    },
    [setPlaidError]
  );

  const onPlaidOpened = useCallback(() => {
    setPlaidOpenTriggered(true);
  }, []);

  const onPlaidEvent = useCallback(
    (eventName: string, metadata: PlaidLinkOnEventMetadata) => {
      if (eventName !== "ERROR") return;
      const code = metadata.error_code?.trim();
      const message = metadata.error_message?.trim() || "Plaid Link error";
      const requestId = metadata.request_id?.trim();
      setPlaidError(
        code
          ? `Plaid ${code}: ${message}${requestId ? ` (request: ${requestId})` : ""}`
          : `${message}${requestId ? ` (request: ${requestId})` : ""}`
      );
    },
    []
  );

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
    if (
      !selectedProjectId ||
      linkedAccounts.length === 0 ||
      !isAuthenticated()
    ) {
      setLastSyncedAt(null);
      return;
    }
    getPlaidLastSync(selectedProjectId)
      .then(({ lastSyncedAt: t }) => setLastSyncedAt(t))
      .catch(() => setLastSyncedAt(null));
  }, [selectedProjectId, linkedAccounts.length]);

  useEffect(() => {
    if (lastSyncedAt != null) return;
    const plaidExpenses = expenses.filter(
      (e) => e.source === "plaid" && e.createdAt
    );
    if (plaidExpenses.length === 0) return;
    const latest = plaidExpenses.reduce((max, e) =>
      new Date(e.createdAt) > new Date(max.createdAt) ? e : max
    );
    if (latest.createdAt) {
      setLastSyncedAt(new Date(latest.createdAt).toISOString());
    }
  }, [expenses, lastSyncedAt]);

  const prefetchPlaidLinkToken = useCallback(() => {
    if (
      !isAuthenticated() ||
      plaidLinkToken ||
      plaidLoading ||
      prefetchedLinkTokenRef.current
    )
      return;
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
    setPlaidLoading(true);
    setPlaidLinkToken(null);
    getPlaidLinkToken()
      .then(({ linkToken }) => setPlaidLinkToken(linkToken))
      .catch((err) => {
        setPlaidError(
          err instanceof Error ? err.message : "Could not start connection"
        );
      })
      .finally(() => setPlaidLoading(false));
  }, []);

  const handleSyncPlaid = useCallback(async () => {
    if (!selectedProjectId) return;
    setPlaidError("");
    setSyncLoading(true);
    try {
      const { added, lastSyncedAt: next } =
        await syncPlaidTransactions(selectedProjectId);
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
      setPlaidError(
        err instanceof Error ? err.message : "Failed to disconnect"
      );
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
      setPlaidError(
        err instanceof Error
          ? err.message
          : "Failed to delete imported expenses"
      );
    } finally {
      setDeleteImportedLoading(false);
    }
  }, [selectedProjectId, importedCount]);

  const handleSort = (field: ExpenseSortField) => {
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedProjectId) {
      setTaxDocuments([]);
      setTaxChecklist(defaultTaxChecklistState());
      return;
    }
    if (isAuthenticated()) {
      fetchTaxDocuments(selectedProjectId)
        .then((docs) => {
          const normalized = docs.map((doc) => ({
            ...doc,
            kind: (doc.kind as TaxDocumentKind) ?? "other",
            taxYear: doc.taxYear ?? null,
            notes: typeof doc.notes === "string" ? doc.notes : "",
            textPreview:
              typeof doc.textPreview === "string" ? doc.textPreview : null,
          }));
          setTaxDocuments(normalized);
        })
        .catch(() => setTaxDocuments([]));
    } else {
      try {
        const docsRaw = localStorage.getItem(
          getTaxDocsStorageKey(selectedProjectId)
        );
        const docsParsed = docsRaw ? (JSON.parse(docsRaw) as unknown) : [];
        if (Array.isArray(docsParsed)) {
          const normalized = docsParsed
            .filter((value): value is TaxDocument => {
              if (!value || typeof value !== "object") return false;
              const rec = value as Record<string, unknown>;
              return (
                typeof rec.id === "string" &&
                typeof rec.fileName === "string" &&
                typeof rec.sizeBytes === "number" &&
                typeof rec.kind === "string"
              );
            })
            .map((doc) => ({
              ...doc,
              notes: typeof doc.notes === "string" ? doc.notes : "",
              textPreview:
                typeof doc.textPreview === "string" ? doc.textPreview : null,
              createdAt:
                typeof doc.createdAt === "string"
                  ? doc.createdAt
                  : new Date().toISOString(),
              updatedAt:
                typeof doc.updatedAt === "string"
                  ? doc.updatedAt
                  : new Date().toISOString(),
              fileUrl:
                typeof doc.fileUrl === "string"
                  ? doc.fileUrl
                  : `local://${doc.fileName}`,
              projectId:
                typeof doc.projectId === "string"
                  ? doc.projectId
                  : selectedProjectId,
            }));
          setTaxDocuments(normalized);
        } else {
          setTaxDocuments([]);
        }
      } catch {
        setTaxDocuments([]);
      }
    }

    try {
      const checklistRaw = localStorage.getItem(
        getTaxChecklistStorageKey(selectedProjectId)
      );
      const parsed = checklistRaw
        ? (JSON.parse(checklistRaw) as unknown)
        : null;
      const next = defaultTaxChecklistState();
      if (parsed && typeof parsed === "object") {
        for (const item of TAX_CHECKLIST_ITEMS) {
          const value = (parsed as Record<string, unknown>)[item.id];
          next[item.id] = value === true;
        }
      }
      setTaxChecklist(next);
    } catch {
      setTaxChecklist(defaultTaxChecklistState());
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthenticated()) return;
    if (!selectedProjectId) return;
    try {
      localStorage.setItem(
        getTaxDocsStorageKey(selectedProjectId),
        JSON.stringify(taxDocuments)
      );
    } catch {
      // best effort local persistence
    }
  }, [selectedProjectId, taxDocuments]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedProjectId) return;
    try {
      localStorage.setItem(
        getTaxChecklistStorageKey(selectedProjectId),
        JSON.stringify(taxChecklist)
      );
    } catch {
      // best effort local persistence
    }
  }, [selectedProjectId, taxChecklist]);

  const handleTaxChecklistToggle = useCallback(
    (id: keyof TaxChecklistState) => {
      setTaxChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    []
  );

  const updateTaxDocumentNotes = useCallback(
    async (id: string, notes: string) => {
      const previous = taxDocuments;
      setTaxDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, notes } : doc))
      );
      if (!isAuthenticated()) return;
      try {
        const updated = await updateTaxDocument(id, { notes });
        setTaxDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id
              ? {
                  ...doc,
                  ...updated,
                  kind: updated.kind as TaxDocumentKind,
                  notes: updated.notes ?? "",
                  textPreview: updated.textPreview ?? null,
                  taxYear: updated.taxYear ?? null,
                }
              : doc
          )
        );
      } catch {
        setTaxDocuments(previous);
      }
    },
    [taxDocuments]
  );

  const removeTaxDocument = useCallback(
    async (id: string) => {
      const previous = taxDocuments;
      setTaxDocuments((prev) => prev.filter((doc) => doc.id !== id));
      if (!isAuthenticated()) return;
      try {
        await deleteTaxDocument(id);
      } catch {
        setTaxDocuments(previous);
      }
    },
    [taxDocuments]
  );

  const handleTaxDownload = useCallback(async (doc: TaxDocument) => {
    if (!isAuthenticated()) return;
    try {
      const blob = await downloadTaxDocument(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setTaxUploadError(
        err instanceof Error ? err.message : "Failed to download tax document."
      );
    }
  }, []);

  const handleTaxUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      setTaxUploadError("");
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;
      if (!selectedProjectId) {
        setTaxUploadError("Select a project before uploading tax documents.");
        event.target.value = "";
        return;
      }

      setTaxUploading(true);
      try {
        const created = await Promise.all(
          files.map(async (file) => {
            const kind = inferTaxDocumentKind(file.name);
            const taxYear = inferTaxYear(file.name);
            const textPreview = await readTaxTextPreview(file);
            if (isAuthenticated()) {
              const fileBase64 = await fileToBase64(file);
              const saved = await createTaxDocument({
                projectId: selectedProjectId,
                fileName: file.name,
                fileBase64,
                kind,
                taxYear,
                textPreview,
              });
              return {
                ...saved,
                kind: saved.kind as TaxDocumentKind,
                taxYear: saved.taxYear ?? null,
                notes: saved.notes ?? "",
                textPreview: saved.textPreview ?? null,
              } as TaxDocument;
            }
            return {
              id: `tax-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fileName: file.name,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              fileUrl: `local://${file.name}`,
              projectId: selectedProjectId,
              kind,
              taxYear,
              notes: "",
              textPreview,
            } as TaxDocument;
          })
        );
        setTaxDocuments((prev) => [...created, ...prev]);
      } catch (err) {
        setTaxUploadError(
          err instanceof Error
            ? err.message
            : "Failed to process uploaded documents."
        );
      } finally {
        setTaxUploading(false);
        event.target.value = "";
      }
    },
    [selectedProjectId]
  );

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
          err instanceof Error
            ? err.message
            : "Failed to save expense to server. Check your connection and try again."
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

  const { filteredExpenses, expensesForSummary, total } = useMemo(
    () =>
      filterAndSortExpenses(expenses, {
        dateFilterMode,
        filterDay,
        filterDayOfMonth,
        filterMonth,
        filterYear,
        rangeStart,
        rangeEnd,
        categoryFilter,
        expenseSearchQuery,
        sortBy,
        sortDir,
      }),
    [
      expenses,
      dateFilterMode,
      filterDay,
      filterDayOfMonth,
      filterMonth,
      filterYear,
      rangeStart,
      rangeEnd,
      categoryFilter,
      expenseSearchQuery,
      sortBy,
      sortDir,
    ]
  );
  const byCategory = expensesForSummary.reduce<Record<string, number>>(
    (acc, e) => {
      const c = e.category || "Other";
      acc[c] = (acc[c] ?? 0) + e.amount;
      return acc;
    },
    {}
  );
  const parsedAmount = parseFloat(amount.replace(/,/g, ""));
  const canAddExpense =
    Boolean(selectedProjectId) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0;
  const taxChecklistCompleted = TAX_CHECKLIST_ITEMS.filter(
    (item) => taxChecklist[item.id]
  ).length;
  const taxCoverage = {
    income: taxDocuments.some((doc) =>
      ["w2", "1099", "retirement", "business", "crypto"].includes(doc.kind)
    ),
    deductions: taxDocuments.some((doc) =>
      ["1098", "deduction", "property", "medical"].includes(doc.kind)
    ),
    payments: taxDocuments.some((doc) => doc.kind === "payment"),
    identity: taxDocuments.some((doc) => doc.kind === "identity"),
    priorReturn: taxDocuments.some((doc) => doc.kind === "prior_return"),
  };
  const taxCoverageCompleteCount =
    Object.values(taxCoverage).filter(Boolean).length;
  const taxReadinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.min(40, taxDocuments.length * 8) +
          (taxCoverageCompleteCount / 5) * 40 +
          (taxChecklistCompleted / TAX_CHECKLIST_ITEMS.length) * 20
      )
    )
  );
  const taxReadinessLabel =
    taxReadinessScore >= 85
      ? "Ready to file"
      : taxReadinessScore >= 60
        ? "Almost ready"
        : "Needs more prep";
  const missingTaxCoverageLabels = [
    !taxCoverage.income ? "income docs (W-2/1099/etc.)" : null,
    !taxCoverage.deductions ? "deduction docs" : null,
    !taxCoverage.payments ? "payment records" : null,
    !taxCoverage.identity ? "identity verification docs" : null,
    !taxCoverage.priorReturn ? "last year's return" : null,
  ].filter((value): value is string => value != null);
  const handleFinancesSectionDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = financesSectionOrder.indexOf(String(active.id));
      const newIndex = financesSectionOrder.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...financesSectionOrder];
      const [removed] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, removed);
      setFinancesSectionOrder(next);
    },
    [financesSectionOrder]
  );
  const renderFinancesSection = (
    sectionId: string,
    dragHandle: React.ReactNode
  ) => (
    <FinancesSectionContent
      sectionId={sectionId}
      dragHandle={dragHandle}
      projectsLoaded={projectsLoaded}
      selectedProjectId={selectedProjectId}
      dateFilterMode={dateFilterMode}
      filterDay={filterDay}
      filterDayOfMonth={filterDayOfMonth}
      filterMonth={filterMonth}
      filterYear={filterYear}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      expenses={expenses}
      expensesForSummary={expensesForSummary}
      filteredExpenses={filteredExpenses}
      categoryFilter={categoryFilter}
      expenseSearchQuery={expenseSearchQuery}
      sortBy={sortBy}
      sortDir={sortDir}
      total={total}
      byCategory={byCategory}
      canAddExpense={canAddExpense}
      taxDocuments={taxDocuments}
      taxChecklist={taxChecklist}
      taxChecklistCompleted={taxChecklistCompleted}
      taxReadinessScore={taxReadinessScore}
      taxReadinessLabel={taxReadinessLabel}
      missingTaxCoverageLabels={missingTaxCoverageLabels}
      taxUploadError={taxUploadError}
      taxUploading={taxUploading}
      plaidError={plaidError}
      plaidConnectButtonLoading={plaidConnectButtonLoading}
      linkedAccounts={linkedAccounts}
      linkedAccountsCollapsed={linkedAccountsCollapsed}
      lastSyncedAt={lastSyncedAt}
      syncLoading={syncLoading}
      importedCount={importedCount}
      deleteImportedConfirming={deleteImportedConfirming}
      deleteImportedLoading={deleteImportedLoading}
      editingLinkedAccountId={editingLinkedAccountId}
      editingLinkedAccountName={editingLinkedAccountName}
      renamingLinkedAccountId={renamingLinkedAccountId}
      date={date}
      description={description}
      amount={amount}
      category={category}
      categoryDropdownOpen={categoryDropdownOpen}
      datePickerOpen={datePickerOpen}
      editingCategoryId={editingCategoryId}
      editingDescriptionId={editingDescriptionId}
      editingDescriptionValue={editingDescriptionValue}
      dateFilterOpen={dateFilterOpen}
      categoryDropdownRef={categoryDropdownRef}
      listCategoryDropdownRef={listCategoryDropdownRef}
      datePickerRef={datePickerRef}
      descriptionInputRef={descriptionInputRef}
      taxUploadInputRef={taxUploadInputRef}
      isSectionCollapsed={isSectionCollapsed}
      toggleSection={toggleSection}
      setCategoryFilter={setCategoryFilter}
      setLinkedAccountsCollapsed={setLinkedAccountsCollapsed}
      setEditingLinkedAccountName={setEditingLinkedAccountName}
      setTaxDocuments={setTaxDocuments}
      setAddExpenseError={setAddExpenseError}
      setDate={setDate}
      setDatePickerOpen={setDatePickerOpen}
      setDescription={setDescription}
      setAmount={setAmount}
      setCategory={setCategory}
      setCategoryDropdownOpen={setCategoryDropdownOpen}
      setExpenseSearchQuery={setExpenseSearchQuery}
      setDateFilterMode={setDateFilterMode}
      setFilterDay={setFilterDay}
      setFilterDayOfMonth={setFilterDayOfMonth}
      setFilterMonth={setFilterMonth}
      setFilterYear={setFilterYear}
      setRangeStart={setRangeStart}
      setRangeEnd={setRangeEnd}
      setDateFilterOpen={setDateFilterOpen}
      setEditingCategoryId={setEditingCategoryId}
      setEditingDescriptionValue={setEditingDescriptionValue}
      openTaxFilePicker={openTaxFilePicker}
      handleConnectPlaid={handleConnectPlaid}
      prefetchPlaidLinkToken={prefetchPlaidLinkToken}
      handleSyncPlaid={handleSyncPlaid}
      startEditingLinkedAccount={startEditingLinkedAccount}
      saveLinkedAccountName={saveLinkedAccountName}
      cancelEditingLinkedAccount={cancelEditingLinkedAccount}
      handleDisconnectPlaid={handleDisconnectPlaid}
      handleDeleteAllImportedConfirm={handleDeleteAllImportedConfirm}
      handleDeleteAllImportedCancel={handleDeleteAllImportedCancel}
      handleDeleteAllImportedSubmit={handleDeleteAllImportedSubmit}
      handleTaxUpload={handleTaxUpload}
      handleTaxChecklistToggle={handleTaxChecklistToggle}
      handleTaxDownload={handleTaxDownload}
      removeTaxDocument={removeTaxDocument}
      updateTaxDocumentNotes={updateTaxDocumentNotes}
      addExpense={addExpense}
      handleSort={handleSort}
      startEditingDescription={startEditingDescription}
      saveExpenseDescription={saveExpenseDescription}
      cancelEditingDescription={cancelEditingDescription}
      updateExpenseCategory={updateExpenseCategory}
      removeExpense={removeExpense}
    />
  );

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
      onRenameProject={layout.renameProjectById}
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
              onEvent={onPlaidEvent}
              onOpened={onPlaidOpened}
            />
          )}
          <h1 className="tests-page-title">Finances</h1>

          <DndContext
            sensors={sensors}
            modifiers={[restrictToWindowEdges]}
            collisionDetection={closestCenter}
            onDragEnd={handleFinancesSectionDragEnd}
          >
            <SortableContext
              items={financesSectionOrder}
              strategy={verticalListSortingStrategy}
            >
              {financesSectionOrder.map((sectionId) => (
                <SortableFinancesSection key={sectionId} sectionId={sectionId}>
                  {(dragHandle) => renderFinancesSection(sectionId, dragHandle)}
                </SortableFinancesSection>
              ))}
            </SortableContext>
          </DndContext>
          {addExpenseError && (
            <section
              className="tests-page-section expenses-error-notice"
              role="alert"
            >
              <p className="expenses-error-notice-text">{addExpenseError}</p>
            </section>
          )}
        </div>
      )}
    </AppLayout>
  );
}
