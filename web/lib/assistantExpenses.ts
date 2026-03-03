import type { Expense } from "./api";
import { formatCurrency } from "./utils";

export type ParsedExpenseQuery = {
  isoDate: string;
  displayDate: string;
};

/** Detect overview-style expense questions (e.g. "current" or "total" expenses) without a specific date. */
export function isExpenseOverviewQuery(message: string): boolean {
  const lower = message.toLowerCase();
  if (!/(expense|expenses|spend|spent|spending|cost|purchase)/.test(lower)) {
    return false;
  }
  // Explicit date queries are handled separately by tryParseExpenseQuery.
  if (/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.test(message)) {
    return false;
  }
  // Common phrasings where the user is clearly asking about their expenses data.
  if (
    /\bcurrent (expense|expenses|spending|costs?)\b/.test(lower) ||
    /\b(total|overall|all)\s+(expense|expenses|spending|costs?)\b/.test(lower) ||
    /\bwhat (are|is)\b.*\b(expense|expenses|spending|costs?)\b/.test(lower) ||
    /\bhow much\b.*\b(spend|spent|spending|cost|costs|expenses?)\b/.test(lower) ||
    /\blist\b.*\b(expense|expenses|purchases|transactions)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

export function tryParseExpenseQuery(message: string): ParsedExpenseQuery | null {
  const lower = message.toLowerCase();
  if (!/(expense|expenses|spend|spent|spending|cost|purchase)/.test(lower)) {
    return null;
  }
  const dateMatch = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(message);
  if (!dateMatch) return null;
  const month = Number.parseInt(dateMatch[1], 10);
  const day = Number.parseInt(dateMatch[2], 10);
  let year = Number.parseInt(dateMatch[3], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }
  if (year < 100) {
    const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100;
    year = currentCentury + year;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const jsDate = new Date(Date.UTC(year, month - 1, day));
  if (
    jsDate.getUTCFullYear() !== year ||
    jsDate.getUTCMonth() !== month - 1 ||
    jsDate.getUTCDate() !== day
  ) {
    return null;
  }
  const isoDate = `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  const monthNames = [
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
  ] as const;
  const displayDate = `${monthNames[month - 1]} ${day}, ${year}`;
  return { isoDate, displayDate };
}

export function summarizeExpensesForDate(
  allExpenses: Expense[],
  query: ParsedExpenseQuery
): string {
  const onDate = allExpenses.filter((expense) => expense.date === query.isoDate);
  if (onDate.length === 0) {
    return `You had no recorded expenses on ${query.displayDate}.`;
  }
  let total = 0;
  const byCategory = new Map<string, number>();
  const perExpenseSummary: string[] = [];
  for (const expense of onDate) {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount)) continue;
    total += amount;
    const rawCategory =
      typeof expense.category === "string" ? expense.category.trim() : "";
    const category = rawCategory || "Uncategorized";
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
    const rawDescription =
      typeof expense.description === "string" ? expense.description.trim() : "";
    const description = rawDescription || "Expense";
    perExpenseSummary.push(
      `${description} (${category} ${formatCurrency(amount)})`
    );
  }
  const base = `On ${query.displayDate} you spent ${formatCurrency(
    total
  )} across ${onDate.length} expense${onDate.length === 1 ? "" : "s"}.`;
  if (byCategory.size === 0) {
    if (perExpenseSummary.length === 0) return base;
    if (perExpenseSummary.length === 1) {
      return `${base} Description: ${perExpenseSummary[0]}.`;
    }
    return `${base} Descriptions: ${perExpenseSummary.join(", ")}.`;
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => `${category} ${formatCurrency(amount)}`);
  if (perExpenseSummary.length === 0) {
    return `${base} Top categories: ${topCategories.join(", ")}.`;
  }
  if (perExpenseSummary.length === 1) {
    return `${base} Top categories: ${topCategories.join(
      ", "
    )}. Description: ${perExpenseSummary[0]}.`;
  }
  return `${base} Top categories: ${topCategories.join(
    ", "
  )}. Descriptions: ${perExpenseSummary.join(", ")}.`;
}

export function summarizeExpensesOverview(allExpenses: Expense[]): string {
  if (!Array.isArray(allExpenses) || allExpenses.length === 0) {
    return "You currently have no expenses recorded in this project. Add expenses in the Finances tab to start tracking them.";
  }

  let total = 0;
  const byCategory = new Map<string, number>();

  const sorted = [...allExpenses].sort((a, b) => {
    const ta = new Date(`${a.date ?? ""}T00:00:00`).getTime();
    const tb = new Date(`${b.date ?? ""}T00:00:00`).getTime();
    return tb - ta;
  });

  for (const expense of sorted) {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount)) continue;
    total += amount;

    const rawCategory =
      typeof expense.category === "string" ? expense.category.trim() : "";
    const category = rawCategory || "Uncategorized";
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
  }

  const baseLine = `You currently have ${
    allExpenses.length
  } expense${allExpenses.length === 1 ? "" : "s"} recorded, totaling ${formatCurrency(
    total
  )}.`;

  const categoryLines =
    byCategory.size > 0
      ? [
          `Top categories: ${Array.from(byCategory.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([category, amount]) => `${category} ${formatCurrency(amount)}`)
            .join(", ")}`,
        ]
      : [];

  const perExpenseLines = sorted.slice(0, 10).map((expense) => {
    const rawDescription =
      typeof expense.description === "string" ? expense.description.trim() : "";
    const description = rawDescription || "Expense";
    const rawCategory =
      typeof expense.category === "string" ? expense.category.trim() : "";
    const category = rawCategory || "Uncategorized";
    const amount = Number(expense.amount);
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const dateDisplay = expense.date || "Unknown date";
    return `${dateDisplay}: ${description} (${category} ${formatCurrency(safeAmount)})`;
  });

  const expenseLines =
    perExpenseLines.length > 0
      ? ["Expenses:", ...perExpenseLines.map((line) => `• ${line}`)]
      : [];

  return [baseLine, ...categoryLines, ...expenseLines].join("\n");
}

