import type { Expense } from "./api";
import { formatCurrency } from "./utils";

export type ParsedExpenseQuery = {
  isoDate: string;
  displayDate: string;
};

function formatIsoDateForDisplay(value: string | null | undefined): string {
  if (!value) return "an unknown date";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const SMALL_NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;

const TENS_WORDS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

function integerToWords(value: number): string {
  if (!Number.isFinite(value)) return "zero";
  if (value < 0) return `minus ${integerToWords(Math.abs(value))}`;
  if (value < 20) return SMALL_NUMBER_WORDS[value];
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return remainder === 0
      ? TENS_WORDS[tens]
      : `${TENS_WORDS[tens]}-${SMALL_NUMBER_WORDS[remainder]}`;
  }
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const remainder = value % 100;
    return remainder === 0
      ? `${SMALL_NUMBER_WORDS[hundreds]} hundred`
      : `${SMALL_NUMBER_WORDS[hundreds]} hundred and ${integerToWords(remainder)}`;
  }

  const scales = [
    { value: 1_000_000_000, label: "billion" },
    { value: 1_000_000, label: "million" },
    { value: 1_000, label: "thousand" },
  ] as const;

  for (const scale of scales) {
    if (value >= scale.value) {
      const major = Math.floor(value / scale.value);
      const remainder = value % scale.value;
      if (remainder === 0) {
        return `${integerToWords(major)} ${scale.label}`;
      }
      const separator = remainder < 100 ? " and " : " ";
      return `${integerToWords(major)} ${scale.label}${separator}${integerToWords(remainder)}`;
    }
  }

  return String(value);
}

function formatCurrencyForSpeech(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = Math.round(safeAmount * 100);
  const dollars = Math.floor(rounded / 100);
  const cents = rounded % 100;
  const dollarWords = `${integerToWords(dollars)} dollar${dollars === 1 ? "" : "s"}`;
  if (cents === 0) return dollarWords;
  return `${dollarWords} and ${integerToWords(cents)} cent${cents === 1 ? "" : "s"}`;
}

function isExpenseKeywordMessage(message: string): boolean {
  return /(expense|expenses|spend|spent|spending|cost|purchase|transaction)/.test(
    message.toLowerCase()
  );
}

/** Detect overview-style expense questions (e.g. "current" or "total" expenses) without a specific date. */
export function isExpenseOverviewQuery(message: string): boolean {
  const lower = message.toLowerCase();
  if (!isExpenseKeywordMessage(message)) {
    return false;
  }
  // Explicit date queries are handled separately by tryParseExpenseQuery.
  if (/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.test(message)) {
    return false;
  }
  if (isLatestExpenseQuery(message)) {
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

export function isLatestExpenseQuery(message: string): boolean {
  const lower = message.toLowerCase();
  if (!isExpenseKeywordMessage(message)) {
    return false;
  }
  return (
    /\b(latest|most recent|newest)\b.*\b(expense|expenses|purchase|transaction)\b/.test(
      lower
    ) ||
    /\b(last)\b.*\b(expense|purchase|transaction)\b/.test(lower) ||
    /\bwhat (was|is)\b.*\b(latest|most recent|newest|last)\b.*\b(expense|purchase|transaction)\b/.test(
      lower
    )
  );
}

export function tryParseExpenseQuery(message: string): ParsedExpenseQuery | null {
  if (!isExpenseKeywordMessage(message)) {
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

export function summarizeLatestExpense(allExpenses: Expense[]): string {
  if (!Array.isArray(allExpenses) || allExpenses.length === 0) {
    return "You currently have no expenses recorded in this project. Add expenses in the Finances tab to start tracking them.";
  }

  const latest = [...allExpenses].sort((a, b) => {
    const dateCompare = (b.date || "").localeCompare(a.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  })[0];

  if (!latest) {
    return "I couldn't determine your latest expense from the current project data.";
  }

  const amount = Number(latest.amount);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const description =
    typeof latest.description === "string" && latest.description.trim()
      ? latest.description.trim()
      : "Expense";
  const category =
    typeof latest.category === "string" && latest.category.trim()
      ? latest.category.trim()
      : "Uncategorized";
  const source =
    latest.source === "plaid"
      ? " imported from Plaid"
      : latest.source === "manual"
        ? " added manually"
        : "";

  return `Your latest recorded expense was ${description} on ${
    formatIsoDateForDisplay(latest.date)
  } in ${category} for ${formatCurrencyForSpeech(safeAmount)}${source}.`;
}
