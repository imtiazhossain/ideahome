import { getList, setList, type ListCacheKey } from "./listCache";
import {
  fetchBugs,
  fetchEnhancements,
  fetchFeatures,
  fetchIdeas,
  fetchTodos,
  type Bug,
  type Enhancement,
  type Feature,
  type Idea,
  type Todo,
} from "./api/checklists";

export type SummaryListKey =
  | "todos"
  | "features"
  | "enhancements"
  | "ideas"
  | "bugs";

export type SummaryItem = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type SummaryLists = Record<SummaryListKey, SummaryItem[]>;

export type SummaryAreaMetric = {
  key: SummaryListKey;
  label: string;
  shortLabel: string;
  colorVar: `--${string}`;
  total: number;
  completed: number;
  open: number;
  completionRate: number;
};

export type SummaryTrendPoint = {
  dateKey: string;
  label: string;
  created: number;
  completedEstimate: number;
};

export type SummaryInsightTone = "success" | "warning" | "danger" | "neutral";

export type SummaryInsight = {
  id: string;
  tone: SummaryInsightTone;
  title: string;
  detail: string;
};

export type SummaryViewModel = {
  totalItems: number;
  completedItems: number;
  openItems: number;
  completionRate: number;
  openBugs: number;
  momentumCount: number;
  momentumCompletedEstimate: number;
  momentumDelta: number;
  statusText: string;
  areas: SummaryAreaMetric[];
  trend: SummaryTrendPoint[];
  insights: SummaryInsight[];
};

const AREA_META: {
  key: SummaryListKey;
  label: string;
  shortLabel: string;
  colorVar: `--${string}`;
  listType: ListCacheKey;
  fetcher: (projectId: string) => Promise<SummaryItem[]>;
}[] = [
  {
    key: "todos",
    label: "To-Do",
    shortLabel: "To-Do",
    colorVar: "--todo",
    listType: "todos",
    fetcher: fetchTodos as (projectId: string) => Promise<SummaryItem[]>,
  },
  {
    key: "features",
    label: "Features",
    shortLabel: "Feat",
    colorVar: "--summary-features",
    listType: "features",
    fetcher: fetchFeatures as (projectId: string) => Promise<SummaryItem[]>,
  },
  {
    key: "enhancements",
    label: "Enhancements",
    shortLabel: "Enh",
    colorVar: "--summary-enhancements",
    listType: "enhancements",
    fetcher: fetchEnhancements as (projectId: string) => Promise<SummaryItem[]>,
  },
  {
    key: "ideas",
    label: "Ideas",
    shortLabel: "Ideas",
    colorVar: "--summary-ideas",
    listType: "ideas",
    fetcher: fetchIdeas as (projectId: string) => Promise<SummaryItem[]>,
  },
  {
    key: "bugs",
    label: "Bugs",
    shortLabel: "Bugs",
    colorVar: "--summary-bugs",
    listType: "bugs",
    fetcher: fetchBugs as (projectId: string) => Promise<SummaryItem[]>,
  },
];

export type SummaryFetchResult = {
  lists: SummaryLists;
  fromCache: boolean;
};

function emptyLists(): SummaryLists {
  return {
    todos: [],
    features: [],
    enhancements: [],
    ideas: [],
    bugs: [],
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function computePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return clampPercent((part / total) * 100);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function buildTrendWindow(now: Date, days: number): SummaryTrendPoint[] {
  const start = addDays(startOfDay(now), -(days - 1));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return {
      dateKey: dateKey(date),
      label: shortDayLabel(date),
      created: 0,
      completedEstimate: 0,
    };
  });
}

function getItemsFromLists(lists: SummaryLists): SummaryItem[] {
  return AREA_META.flatMap((area) => lists[area.key]);
}

function buildStatusText(params: {
  totalItems: number;
  completionRate: number;
  openBugs: number;
  momentumCount: number;
}): string {
  const { totalItems, completionRate, openBugs, momentumCount } = params;
  if (totalItems === 0) {
    return "Start adding work items to turn this page into a live project pulse.";
  }
  if (openBugs >= 5 && completionRate < 50) {
    return "Blockers are starting to outweigh delivery progress this week.";
  }
  if (momentumCount === 0) {
    return "The project is quiet right now, with no new movement in the last week.";
  }
  if (completionRate >= 65 && openBugs <= 2) {
    return "Delivery looks healthy, with steady progress and limited blocker pressure.";
  }
  if (completionRate >= 40) {
    return "Progress is moving, but there is still meaningful open work to close.";
  }
  return "The backlog is still heavier than the completed work.";
}

function buildInsights(params: {
  totalItems: number;
  completedItems: number;
  openItems: number;
  completionRate: number;
  openBugs: number;
  momentumCount: number;
  momentumCompletedEstimate: number;
  areas: SummaryAreaMetric[];
}): SummaryInsight[] {
  const {
    totalItems,
    completedItems,
    openItems,
    completionRate,
    openBugs,
    momentumCount,
    momentumCompletedEstimate,
    areas,
  } = params;
  const insights: SummaryInsight[] = [];

  if (totalItems === 0) {
    insights.push({
      id: "empty",
      tone: "neutral",
      title: "No project work yet",
      detail:
        "Add tasks, ideas, enhancements, features, or bugs to begin tracking momentum.",
    });
    return insights;
  }

  if (openBugs >= Math.max(3, completedItems)) {
    insights.push({
      id: "bugs-dominant",
      tone: "danger",
      title: "Bug pressure is high",
      detail: `${openBugs} open bugs are competing with ${completedItems} completed items.`,
    });
  }

  if (openItems >= 10 && completionRate < 35) {
    insights.push({
      id: "large-backlog",
      tone: "warning",
      title: "Backlog is building up",
      detail: `${openItems} items remain open and only ${Math.round(completionRate)}% of tracked work is complete.`,
    });
  }

  if (momentumCount === 0) {
    insights.push({
      id: "no-momentum",
      tone: "warning",
      title: "No fresh movement this week",
      detail:
        "Nothing new was created in the last 7 days, which usually signals stalled planning or execution.",
    });
  } else if (
    momentumCompletedEstimate >= Math.max(2, Math.ceil(momentumCount / 2))
  ) {
    insights.push({
      id: "healthy-momentum",
      tone: "success",
      title: "Momentum looks healthy",
      detail: `${momentumCompletedEstimate} of the ${momentumCount} items added this week are already marked done.`,
    });
  }

  const slowestArea = areas
    .filter((area) => area.total > 0)
    .sort((left, right) => left.completionRate - right.completionRate)[0];
  if (slowestArea && slowestArea.completionRate < 25) {
    insights.push({
      id: "slowest-area",
      tone: "neutral",
      title: `${slowestArea.label} need attention`,
      detail: `${slowestArea.open} of ${slowestArea.total} ${slowestArea.label.toLowerCase()} items are still open.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "steady-state",
      tone: "success",
      title: "Steady operating rhythm",
      detail:
        "The project has a balanced mix of open work and completion progress.",
    });
  }

  return insights.slice(0, 4);
}

export function aggregateSummaryViewModel(
  lists: SummaryLists,
  now: Date = new Date()
): SummaryViewModel {
  const areas = AREA_META.map((area) => {
    const items = lists[area.key];
    const total = items.length;
    const completed = items.reduce(
      (count, item) => count + (item.done ? 1 : 0),
      0
    );
    const open = total - completed;
    return {
      key: area.key,
      label: area.label,
      shortLabel: area.shortLabel,
      colorVar: area.colorVar,
      total,
      completed,
      open,
      completionRate: computePercent(completed, total),
    };
  });

  const allItems = getItemsFromLists(lists);
  const totalItems = allItems.length;
  const completedItems = areas.reduce((sum, area) => sum + area.completed, 0);
  const openItems = totalItems - completedItems;
  const trend = buildTrendWindow(now, 7);
  const trendIndex = new Map(trend.map((point) => [point.dateKey, point]));

  allItems.forEach((item) => {
    const createdAt = new Date(item.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;
    const point = trendIndex.get(dateKey(startOfDay(createdAt)));
    if (!point) return;
    point.created += 1;
    if (item.done) point.completedEstimate += 1;
  });

  const momentumCount = trend.reduce((sum, point) => sum + point.created, 0);
  const momentumCompletedEstimate = trend.reduce(
    (sum, point) => sum + point.completedEstimate,
    0
  );
  const openBugs = areas.find((area) => area.key === "bugs")?.open ?? 0;
  const completionRate = computePercent(completedItems, totalItems);
  const momentumDelta = momentumCount - openBugs;

  return {
    totalItems,
    completedItems,
    openItems,
    completionRate,
    openBugs,
    momentumCount,
    momentumCompletedEstimate,
    momentumDelta,
    statusText: buildStatusText({
      totalItems,
      completionRate,
      openBugs,
      momentumCount,
    }),
    areas,
    trend,
    insights: buildInsights({
      totalItems,
      completedItems,
      openItems,
      completionRate,
      openBugs,
      momentumCount,
      momentumCompletedEstimate,
      areas,
    }),
  };
}

export function getCachedSummaryLists(
  projectId: string
): SummaryFetchResult | null {
  const cached = emptyLists();
  let hasCachedData = false;

  AREA_META.forEach((area) => {
    const items = getList<SummaryItem>(area.listType, projectId) ?? [];
    if (items.length > 0) hasCachedData = true;
    cached[area.key] = items;
  });

  return hasCachedData ? { lists: cached, fromCache: true } : null;
}

export async function fetchSummaryLists(
  projectId: string
): Promise<SummaryFetchResult> {
  const entries = await Promise.all(
    AREA_META.map(async (area) => {
      const items = await area.fetcher(projectId);
      setList(area.listType, projectId, items);
      return [area.key, items] as const;
    })
  );

  const lists = emptyLists();
  entries.forEach(([key, items]) => {
    lists[key] = items;
  });

  return { lists, fromCache: false };
}

export const SUMMARY_AREA_META = AREA_META;

export type SummaryApiItem = Todo | Feature | Enhancement | Idea | Bug;
