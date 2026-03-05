import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { usePlaidLink } from "react-plaid-link";
import type {
  PlaidLinkError,
  PlaidLinkOnEventMetadata,
  PlaidLinkOnExitMetadata,
} from "react-plaid-link";
import { useRouter } from "next/router";
import { EXPENSE_CATEGORIES } from "@ideahome/shared";
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
  getUserScopedStorageKey,
  isAuthenticated,
  syncPlaidTransactions,
  updateTaxDocument,
  updateExpense,
  type Expense,
  type PlaidLinkedAccount,
  type TaxDocument as ApiTaxDocument,
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
import { IconGrip } from "../components/IconGrip";

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
  items: {
    amount: number;
    description: string;
    date: string;
    category: string;
  }[]
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TAX_DOCS_STORAGE_PREFIX = "ideahome-tax-docs";
const TAX_CHECKLIST_STORAGE_PREFIX = "ideahome-tax-checklist";
const FINANCES_DRAGGABLE_SECTION_IDS = [
  "expenses-summary",
  "expenses-financials",
  "expenses-taxes",
  "expenses-add-and-list",
] as const;

type TaxDocumentKind =
  | "w2"
  | "1099"
  | "1098"
  | "deduction"
  | "identity"
  | "prior_return"
  | "property"
  | "medical"
  | "retirement"
  | "crypto"
  | "business"
  | "payment"
  | "other";

type TaxDocument = ApiTaxDocument & {
  id: string;
  fileName: string;
  sizeBytes: number;
  kind: TaxDocumentKind;
  taxYear: number | null;
  notes: string;
  textPreview: string | null;
};

const TAX_CHECKLIST_ITEMS = [
  {
    id: "confirm-identity",
    label: "Confirm legal name, SSN, and address match tax records.",
  },
  {
    id: "collect-income-docs",
    label:
      "Collect all income forms (W-2, 1099, K-1, retirement distributions).",
  },
  {
    id: "collect-deduction-docs",
    label:
      "Collect deduction docs (mortgage interest, donations, medical, property taxes).",
  },
  {
    id: "collect-payment-docs",
    label: "Gather estimated tax payment and withholding records.",
  },
  {
    id: "review-last-return",
    label: "Review last year's return for carryovers and recurring items.",
  },
] as const;

type TaxChecklistState = Record<
  (typeof TAX_CHECKLIST_ITEMS)[number]["id"],
  boolean
>;

function getTaxDocsStorageKey(projectId: string | null): string {
  const suffix = projectId ? `-${projectId}` : "-none";
  return getUserScopedStorageKey(
    `${TAX_DOCS_STORAGE_PREFIX}${suffix}`,
    `${TAX_DOCS_STORAGE_PREFIX}${suffix}`
  );
}

function getTaxChecklistStorageKey(projectId: string | null): string {
  const suffix = projectId ? `-${projectId}` : "-none";
  return getUserScopedStorageKey(
    `${TAX_CHECKLIST_STORAGE_PREFIX}${suffix}`,
    `${TAX_CHECKLIST_STORAGE_PREFIX}${suffix}`
  );
}

function defaultTaxChecklistState(): TaxChecklistState {
  return {
    "confirm-identity": false,
    "collect-income-docs": false,
    "collect-deduction-docs": false,
    "collect-payment-docs": false,
    "review-last-return": false,
  };
}

function inferTaxDocumentKind(fileName: string): TaxDocumentKind {
  const n = fileName.toLowerCase();
  if (n.includes("w-2") || n.includes("w2")) return "w2";
  if (n.includes("1099")) return "1099";
  if (n.includes("1098")) return "1098";
  if (n.includes("ssn") || n.includes("passport") || n.includes("driver")) {
    return "identity";
  }
  if (n.includes("prior") || n.includes("last-year") || n.includes("1040")) {
    return "prior_return";
  }
  if (
    n.includes("donation") ||
    n.includes("charity") ||
    n.includes("receipt") ||
    n.includes("expense")
  ) {
    return "deduction";
  }
  if (n.includes("property") || n.includes("tax-bill")) return "property";
  if (n.includes("medical") || n.includes("hsa")) return "medical";
  if (n.includes("401k") || n.includes("ira") || n.includes("pension")) {
    return "retirement";
  }
  if (n.includes("crypto") || n.includes("coinbase") || n.includes("kraken")) {
    return "crypto";
  }
  if (
    n.includes("schedule-c") ||
    n.includes("business") ||
    n.includes("invoice")
  ) {
    return "business";
  }
  if (
    n.includes("estimated") ||
    n.includes("payment") ||
    n.includes("voucher")
  ) {
    return "payment";
  }
  return "other";
}

function inferTaxYear(fileName: string): number | null {
  const match = fileName.match(/\b(20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function taxKindLabel(kind: TaxDocumentKind): string {
  if (kind === "w2") return "W-2";
  if (kind === "1099") return "1099";
  if (kind === "1098") return "1098";
  if (kind === "prior_return") return "Prior Return";
  if (kind === "deduction") return "Deductions";
  if (kind === "identity") return "Identity";
  if (kind === "property") return "Property";
  if (kind === "medical") return "Medical";
  if (kind === "retirement") return "Retirement";
  if (kind === "crypto") return "Crypto";
  if (kind === "business") return "Business";
  if (kind === "payment") return "Payments";
  return "Other";
}

function taxDocInsight(kind: TaxDocumentKind): string {
  if (kind === "w2" || kind === "1099") {
    return "Income form detected. Confirm payer info, withholding, and totals.";
  }
  if (kind === "1098") {
    return "Potential deduction form. Verify deductible interest and amounts.";
  }
  if (kind === "deduction" || kind === "medical" || kind === "property") {
    return "Potential deduction support doc. Keep this with your receipts backup.";
  }
  if (kind === "payment") {
    return "Payment record detected. Reconcile with estimated tax payments made.";
  }
  if (kind === "prior_return") {
    return "Prior return found. Use it to compare carryovers and recurring forms.";
  }
  if (kind === "identity") {
    return "Identity document found. Ensure filer and dependent identity details match.";
  }
  if (kind === "retirement" || kind === "crypto" || kind === "business") {
    return "Special-case tax document detected. Review for additional forms and schedules.";
  }
  return "Review and categorize this document before filing.";
}

async function readTaxTextPreview(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  const isTextLike =
    file.type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".json") ||
    name.endsWith(".md");
  if (!isTextLike) return null;
  try {
    const raw = await file.text();
    const compact = raw.replace(/\s+/g, " ").trim();
    if (!compact) return null;
    return compact.slice(0, 320);
  } catch {
    return null;
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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
  onEvent,
  onOpened,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
  onExit: (
    error: PlaidLinkError | null,
    metadata: PlaidLinkOnExitMetadata
  ) => void;
  onEvent: (eventName: string, metadata: PlaidLinkOnEventMetadata) => void;
  onOpened: () => void;
}) {
  const receivedRedirectUri = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    try {
      const current = new URL(window.location.href);
      return current.searchParams.has("oauth_state_id")
        ? window.location.href
        : undefined;
    } catch {
      return undefined;
    }
  }, []);
  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit,
    onEvent,
    receivedRedirectUri,
  });
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

function SortableFinancesSection({
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
      aria-label="Drag to reorder"
      title="Drag to reorder"
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
  const [financesSectionOrder, setFinancesSectionOrder] = useState<string[]>(
    () => {
      if (typeof window === "undefined")
        return [...FINANCES_DRAGGABLE_SECTION_IDS];
      try {
        const raw = localStorage.getItem(financesSectionOrderStorageKey);
        if (!raw) return [...FINANCES_DRAGGABLE_SECTION_IDS];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0)
          return [...FINANCES_DRAGGABLE_SECTION_IDS];
        const valid = FINANCES_DRAGGABLE_SECTION_IDS as unknown as string[];
        const ordered = parsed.filter(
          (id: unknown) => typeof id === "string" && valid.includes(id)
        ) as string[];
        const missing = valid.filter((id) => !ordered.includes(id));
        return ordered.length
          ? [...ordered, ...missing]
          : [...FINANCES_DRAGGABLE_SECTION_IDS];
      } catch {
        return [...FINANCES_DRAGGABLE_SECTION_IDS];
      }
    }
  );
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
    if (typeof window === "undefined") return;
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
    const key = `ideahome-finances-section-order${selectedProjectId ? `-${selectedProjectId}` : ""}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const valid = FINANCES_DRAGGABLE_SECTION_IDS as unknown as string[];
      const ordered = (parsed as string[]).filter((id) => valid.includes(id));
      const missing = valid.filter((id) => !ordered.includes(id));
      setFinancesSectionOrder(
        ordered.length
          ? [...ordered, ...missing]
          : [...FINANCES_DRAGGABLE_SECTION_IDS]
      );
    } catch {
      // ignore
    }
  }, [selectedProjectId]);

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

  const expenseSearchLower = expenseSearchQuery.trim().toLowerCase();
  const filteredExpensesRaw = expenses.filter((e) => {
    if (
      !expenseInDateFilter(
        e.date,
        dateFilterMode,
        dateFilterMode === "day" ? filterDay : undefined,
        dateFilterMode === "dayOfMonth" ? filterDayOfMonth : undefined,
        dateFilterMode === "month" ? filterMonth : undefined,
        dateFilterMode === "month" || dateFilterMode === "year"
          ? filterYear
          : undefined,
        dateFilterMode === "range" ? rangeStart : undefined,
        dateFilterMode === "range" ? rangeEnd : undefined
      )
    ) {
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
      cmp = (a.description ?? "").localeCompare(
        b.description ?? "",
        undefined,
        { sensitivity: "base" }
      );
    } else if (sortBy === "amount") {
      cmp = a.amount - b.amount;
    } else {
      cmp = (a.category ?? "").localeCompare(b.category ?? "", undefined, {
        sensitivity: "base",
      });
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
            dateFilterMode === "month" || dateFilterMode === "year"
              ? filterYear
              : undefined,
            dateFilterMode === "range" ? rangeStart : undefined,
            dateFilterMode === "range" ? rangeEnd : undefined
          )
        );
  const total = expensesForSummary.reduce((sum, e) => sum + e.amount, 0);
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
  ) => {
    if (sectionId === "expenses-summary") {
      return (
        <CollapsibleSection
          sectionId="expenses-summary"
          title={
            <>
              Summary{" "}
              {dateFilterMode !== "all" && (
                <span className="expenses-summary-period" aria-hidden="true">
                  {dateFilterMode === "day" && formatExpenseDateDisplay(filterDay)}
                  {dateFilterMode === "dayOfMonth" &&
                    `${dayOfMonthOrdinal(filterDayOfMonth)} of every month`}
                  {dateFilterMode === "month" &&
                    `${MONTH_NAMES[filterMonth - 1]} ${filterYear}`}
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
          headerTrailing={dragHandle}
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
      );
    }

    if (sectionId === "expenses-financials") {
      if (!isAuthenticated()) {
        return (
          <CollapsibleSection
            sectionId="expenses-auth-notice"
            title="Sync notice"
            collapsed={isSectionCollapsed("expenses-auth-notice")}
            onToggle={() => toggleSection("expenses-auth-notice")}
            sectionClassName="expenses-auth-notice"
            headerTrailing={dragHandle}
          >
            <p className="expenses-auth-notice-text" role="status">
              Expenses are stored on this device only. Sign in to save them to
              your account and sync across devices.
            </p>
          </CollapsibleSection>
        );
      }

      return (
        <CollapsibleSection
          sectionId="expenses-plaid"
          title="Link Financials"
          collapsed={isSectionCollapsed("expenses-plaid")}
          onToggle={() => toggleSection("expenses-plaid")}
          sectionClassName="expenses-plaid-section"
          headingId="expenses-plaid-heading"
          headerTrailing={dragHandle}
        >
          <p className="expenses-plaid-desc">
            Connect a bank or credit card to import transactions as expenses.
          </p>
          {plaidError && (
            <p className="expenses-error-notice-text" role="alert">
              {plaidError}
            </p>
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
                <span
                  className="upload-spinner upload-spinner--btn"
                  aria-hidden="true"
                />
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
                onClick={() => setLinkedAccountsCollapsed((prev) => !prev)}
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
                          onChange={(e) => setEditingLinkedAccountName(e.target.value)}
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
      );
    }

    if (sectionId === "expenses-taxes") {
      return (
        <CollapsibleSection
          sectionId="expenses-taxes"
          title={
            <>
              Taxes{" "}
              <span className="tests-page-section-count" aria-label="Tax documents count">
                {taxDocuments.length} Docs
              </span>
            </>
          }
          collapsed={isSectionCollapsed("expenses-taxes")}
          onToggle={() => toggleSection("expenses-taxes")}
          sectionClassName="expenses-taxes-section"
          headingId="expenses-taxes-heading"
          headerTrailing={dragHandle}
        >
          <p className="expenses-taxes-desc">
            Upload tax documents, organize what they likely mean, and track
            filing readiness for this project.
          </p>
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to manage tax documents."
            variant="list"
          >
            <div className="expenses-taxes-actions">
              <input
                ref={taxUploadInputRef}
                type="file"
                multiple
                className="expenses-taxes-file-input"
                onChange={handleTaxUpload}
                accept=".pdf,.csv,.txt,.json,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"
                aria-label="Upload tax documents"
              />
              <button
                type="button"
                className="project-nav-add expenses-taxes-upload-btn"
                onClick={openTaxFilePicker}
                disabled={taxUploading}
                aria-busy={taxUploading}
              >
                {taxUploading ? "Processing…" : "Upload tax documents"}
              </button>
              {taxUploadError && (
                <p className="expenses-error-notice-text" role="alert">
                  {taxUploadError}
                </p>
              )}
            </div>

            <div className="expenses-taxes-readiness">
              <p className="expenses-taxes-readiness-score">
                <strong>{taxReadinessScore}%</strong> {taxReadinessLabel}
              </p>
              <p className="expenses-taxes-readiness-meta">
                Checklist {taxChecklistCompleted}/{TAX_CHECKLIST_ITEMS.length}{" "}
                complete
              </p>
              {missingTaxCoverageLabels.length > 0 ? (
                <p className="expenses-taxes-readiness-missing">
                  Missing: {missingTaxCoverageLabels.join(", ")}
                </p>
              ) : (
                <p className="expenses-taxes-readiness-missing">
                  Core document categories detected. Run a final review before
                  filing.
                </p>
              )}
            </div>

            <ul className="expenses-taxes-checklist" aria-label="Tax filing checklist">
              {TAX_CHECKLIST_ITEMS.map((item) => (
                <li key={item.id} className="expenses-taxes-checklist-item">
                  <label className="expenses-taxes-checklist-label">
                    <input
                      type="checkbox"
                      checked={taxChecklist[item.id]}
                      onChange={() => handleTaxChecklistToggle(item.id)}
                    />{" "}
                    {item.label}
                  </label>
                </li>
              ))}
            </ul>

            {taxDocuments.length === 0 ? (
              <p className="tests-page-section-desc finances-empty-state-msg">
                No tax documents uploaded yet.
              </p>
            ) : (
              <ul
                className="expenses-taxes-doc-list"
                aria-label="Uploaded tax documents"
              >
                {taxDocuments.map((doc) => (
                  <li key={doc.id} className="expenses-taxes-doc-item">
                    <div className="expenses-taxes-doc-header">
                      <div>
                        <p className="expenses-taxes-doc-name">{doc.fileName}</p>
                        <p className="expenses-taxes-doc-meta">
                          {taxKindLabel(doc.kind)} · {formatBytes(doc.sizeBytes)}
                          {doc.taxYear != null ? ` · ${doc.taxYear}` : ""}
                          {` · Uploaded ${new Date(doc.createdAt).toLocaleString()}`}
                        </p>
                      </div>
                      <div className="expenses-taxes-doc-actions">
                        {isAuthenticated() && (
                          <button
                            type="button"
                            className="expenses-plaid-disconnect-btn"
                            onClick={() => void handleTaxDownload(doc)}
                            aria-label={`Download ${doc.fileName}`}
                            title={`Download "${doc.fileName}"`}
                          >
                            Download
                          </button>
                        )}
                        <button
                          type="button"
                          className="features-list-remove"
                          onClick={() => void removeTaxDocument(doc.id)}
                          aria-label={`Remove ${doc.fileName}`}
                          title={`Remove "${doc.fileName}"`}
                        >
                          <IconTrash />
                        </button>
                      </div>
                    </div>
                    <p className="expenses-taxes-doc-insight">
                      {taxDocInsight(doc.kind)}
                    </p>
                    {doc.textPreview && (
                      <p className="expenses-taxes-doc-preview">
                        <strong>Text preview:</strong> {doc.textPreview}
                      </p>
                    )}
                    <label className="expenses-taxes-notes-label">
                      Notes for filing
                      <textarea
                        className="expenses-input expenses-taxes-notes"
                        value={doc.notes}
                        spellCheck
                        onChange={(e) =>
                          setTaxDocuments((prev) =>
                            prev.map((item) =>
                              item.id === doc.id
                                ? { ...item, notes: e.target.value }
                                : item
                            )
                          )
                        }
                        onBlur={(e) =>
                          void updateTaxDocumentNotes(doc.id, e.target.value)
                        }
                        placeholder="Add notes (what it is, where it belongs, follow-ups needed)."
                        rows={2}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </ProjectSectionGuard>
        </CollapsibleSection>
      );
    }

    if (sectionId === "expenses-add-and-list") {
      const listControls =
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
        ) : null;

      return (
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
          headerTrailing={dragHandle}
        >
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to add expenses."
            variant="add"
          >
            <form onSubmit={addExpense} className="expenses-form">
              <div className="expenses-field expenses-field-date" ref={datePickerRef}>
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
          {listControls}
          <ProjectSectionGuard
            projectsLoaded={projectsLoaded}
            selectedProjectId={selectedProjectId}
            message="Select a project to see and manage expenses."
            variant="list"
          >
            {expenses.length === 0 ? (
              <p className="tests-page-section-desc finances-empty-state-msg">
                It's dark in here...
                <br />
                Turn the lights on by adding something.
              </p>
            ) : filteredExpenses.length === 0 ? (
              <p className="tests-page-section-desc finances-empty-state-msg">
                No expenses match your filters.
              </p>
            ) : (
              <>
                <div className="expenses-list-table">
                  <div className="expenses-list-header" role="presentation">
                    <button
                      type="button"
                      className={
                        "expenses-list-header-label" +
                        (sortBy === "date" ? " is-active" : "")
                      }
                      onClick={() => handleSort("date")}
                      aria-label={`Sort by date ${sortBy === "date" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                      title="Sort by date"
                    >
                      Date
                      {sortBy === "date" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                    <button
                      type="button"
                      className={
                        "expenses-list-header-label" +
                        (sortBy === "description" ? " is-active" : "")
                      }
                      onClick={() => handleSort("description")}
                      aria-label={`Sort by description ${sortBy === "description" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                      title="Sort by description"
                    >
                      Description
                      {sortBy === "description"
                        ? sortDir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                    <button
                      type="button"
                      className={
                        "expenses-list-header-label expenses-list-header-amount" +
                        (sortBy === "amount" ? " is-active" : "")
                      }
                      onClick={() => handleSort("amount")}
                      aria-label={`Sort by amount ${sortBy === "amount" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                      title="Sort by amount"
                    >
                      Amount
                      {sortBy === "amount"
                        ? sortDir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
                    </button>
                    <button
                      type="button"
                      className={
                        "expenses-list-header-label expenses-list-header-category" +
                        (sortBy === "category" ? " is-active" : "")
                      }
                      onClick={() => handleSort("category")}
                      aria-label={`Sort by category ${sortBy === "category" ? (sortDir === "asc" ? "ascending" : "descending") : ""}`}
                      title="Sort by category"
                    >
                      Category
                      {sortBy === "category"
                        ? sortDir === "asc"
                          ? " ↑"
                          : " ↓"
                        : ""}
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
                            onChange={(e) => setEditingDescriptionValue(e.target.value)}
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
      );
    }

    return null;
  };

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
