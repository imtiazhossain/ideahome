import type { Expense, TaxDocument as ApiTaxDocument } from "../../lib/api";
import { getUserScopedStorageKey } from "../../lib/api";
import type { DateFilterMode } from "../../components/ExpensesDateFilterDropdown";

const EXPENSES_STORAGE_PREFIX = "ideahome-expenses";
const LEGACY_EXPENSES_KEY = "ideahome-expenses";
const LEGACY_COSTS_KEY = "ideahome-costs-expenses";

export const MONTH_NAMES = [
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

export const FINANCES_DRAGGABLE_SECTION_IDS = [
  "expenses-summary",
  "expenses-financials",
  "expenses-add-and-list",
  "expenses-taxes",
] as const;

const LEGACY_FINANCES_DRAGGABLE_SECTION_IDS = [
  "expenses-summary",
  "expenses-financials",
  "expenses-taxes",
  "expenses-add-and-list",
] as const;

export type TaxDocumentKind =
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

export type TaxDocument = ApiTaxDocument & {
  id: string;
  fileName: string;
  sizeBytes: number;
  kind: TaxDocumentKind;
  taxYear: number | null;
  notes: string;
  textPreview: string | null;
};

export const TAX_CHECKLIST_ITEMS = [
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

export type TaxChecklistState = Record<
  (typeof TAX_CHECKLIST_ITEMS)[number]["id"],
  boolean
>;

export function getExpensesStorageKey(): string {
  return getUserScopedStorageKey(EXPENSES_STORAGE_PREFIX, LEGACY_EXPENSES_KEY);
}

export function loadStoredExpensesLegacy(): {
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

export function clearStoredExpensesLegacy(): void {
  if (typeof window === "undefined") return;
  const key = getExpensesStorageKey();
  localStorage.removeItem(key);
  localStorage.removeItem(LEGACY_EXPENSES_KEY);
  localStorage.removeItem(LEGACY_COSTS_KEY);
}

export function saveStoredExpensesLegacy(
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

export function formatExpenseDateDisplay(value: string): string {
  if (!value) return "Select date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
}

export function normalizeFinancesSectionOrder(parsed: unknown): string[] {
  const valid = FINANCES_DRAGGABLE_SECTION_IDS as unknown as string[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [...FINANCES_DRAGGABLE_SECTION_IDS];
  }
  const ordered = parsed.filter(
    (id: unknown) => typeof id === "string" && valid.includes(id)
  ) as string[];
  const missing = valid.filter((id) => !ordered.includes(id));
  const combined = ordered.length ? [...ordered, ...missing] : [...valid];

  const legacy = [...LEGACY_FINANCES_DRAGGABLE_SECTION_IDS];
  const isLegacyDefault =
    combined.length === legacy.length &&
    combined.every((id, index) => id === legacy[index]);
  if (isLegacyDefault) {
    return [...FINANCES_DRAGGABLE_SECTION_IDS];
  }
  return combined;
}

export function getTaxDocsStorageKey(projectId: string | null): string {
  const suffix = projectId ? `-${projectId}` : "-none";
  return getUserScopedStorageKey(
    `${TAX_DOCS_STORAGE_PREFIX}${suffix}`,
    `${TAX_DOCS_STORAGE_PREFIX}${suffix}`
  );
}

export function getTaxChecklistStorageKey(projectId: string | null): string {
  const suffix = projectId ? `-${projectId}` : "-none";
  return getUserScopedStorageKey(
    `${TAX_CHECKLIST_STORAGE_PREFIX}${suffix}`,
    `${TAX_CHECKLIST_STORAGE_PREFIX}${suffix}`
  );
}

export function defaultTaxChecklistState(): TaxChecklistState {
  return {
    "confirm-identity": false,
    "collect-income-docs": false,
    "collect-deduction-docs": false,
    "collect-payment-docs": false,
    "review-last-return": false,
  };
}

export function inferTaxDocumentKind(fileName: string): TaxDocumentKind {
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

export function inferTaxYear(fileName: string): number | null {
  const match = fileName.match(/\b(20\d{2})\b/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!Number.isFinite(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function taxKindLabel(kind: TaxDocumentKind): string {
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

export function taxDocInsight(kind: TaxDocumentKind): string {
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

export async function readTaxTextPreview(file: File): Promise<string | null> {
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

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function expenseInDateFilter(
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

export type ExpenseSortField = "date" | "description" | "amount" | "category";

type FilterOptions = {
  dateFilterMode: DateFilterMode;
  filterDay: string;
  filterDayOfMonth?: number;
  filterMonth?: number;
  filterYear: number;
  rangeStart: string;
  rangeEnd: string;
  categoryFilter: string | null;
  expenseSearchQuery: string;
  sortBy: ExpenseSortField;
  sortDir: "asc" | "desc";
};

function dateFilterArgs(options: FilterOptions) {
  const { dateFilterMode, filterDay, filterDayOfMonth, filterMonth, filterYear, rangeStart, rangeEnd } =
    options;
  return {
    day: dateFilterMode === "day" ? filterDay : undefined,
    dayOfMonth: dateFilterMode === "dayOfMonth" ? filterDayOfMonth : undefined,
    month: dateFilterMode === "month" ? filterMonth : undefined,
    year: dateFilterMode === "month" || dateFilterMode === "year" ? filterYear : undefined,
    rangeStart: dateFilterMode === "range" ? rangeStart : undefined,
    rangeEnd: dateFilterMode === "range" ? rangeEnd : undefined,
  };
}

export function filterAndSortExpenses(
  expenses: Expense[],
  options: FilterOptions
): { filteredExpenses: Expense[]; expensesForSummary: Expense[]; total: number } {
  const query = options.expenseSearchQuery.trim().toLowerCase();
  const args = dateFilterArgs(options);
  const filteredExpensesRaw = expenses.filter((e) => {
    if (
      !expenseInDateFilter(
        e.date,
        options.dateFilterMode,
        args.day,
        args.dayOfMonth,
        args.month,
        args.year,
        args.rangeStart,
        args.rangeEnd
      )
    ) {
      return false;
    }
    if (
      options.categoryFilter !== null &&
      (e.category || "Other") !== options.categoryFilter
    ) {
      return false;
    }
    if (query === "") return true;
    const desc = (e.description ?? "").toLowerCase();
    const cat = (e.category ?? "").toLowerCase();
    const dateRaw = (e.date ?? "").toLowerCase();
    const dateDisplay = formatExpenseDateDisplay(e.date).toLowerCase();
    const amountStr = String(e.amount).toLowerCase();
    return (
      desc.includes(query) ||
      cat.includes(query) ||
      dateRaw.includes(query) ||
      dateDisplay.includes(query) ||
      amountStr.includes(query)
    );
  });

  const filteredExpenses = [...filteredExpensesRaw].sort((a, b) => {
    let cmp = 0;
    if (options.sortBy === "date") {
      const da = new Date(`${a.date ?? ""}T00:00:00`).getTime();
      const db = new Date(`${b.date ?? ""}T00:00:00`).getTime();
      cmp = da - db;
    } else if (options.sortBy === "description") {
      cmp = (a.description ?? "").localeCompare(b.description ?? "", undefined, {
        sensitivity: "base",
      });
    } else if (options.sortBy === "amount") {
      cmp = a.amount - b.amount;
    } else {
      cmp = (a.category ?? "").localeCompare(b.category ?? "", undefined, {
        sensitivity: "base",
      });
    }
    return options.sortDir === "asc" ? cmp : -cmp;
  });

  const expensesForSummary =
    options.dateFilterMode === "all"
      ? expenses
      : expenses.filter((e) =>
          expenseInDateFilter(
            e.date,
            options.dateFilterMode,
            args.day,
            args.dayOfMonth,
            args.month,
            args.year,
            args.rangeStart,
            args.rangeEnd
          )
        );

  const total = expensesForSummary.reduce((sum, e) => sum + e.amount, 0);
  return { filteredExpenses, expensesForSummary, total };
}
