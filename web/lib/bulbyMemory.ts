import {
  fetchMyBulbyMemoryPrefs,
  updateMyBulbyMemoryPrefs,
  type BulbyRuleEntry,
  type BulbyMemoryPreferences,
} from "./api";

const BULBY_MEMORY_STORAGE_KEY = "ideahome-bulby-memory-v1";
const BULBY_MEMORY_VERSION = 1;
const MAX_NOTES = 16;
const MAX_NOTE_LENGTH = 220;
const MAX_RULE_ENTRIES = 64;
const MAX_INTELLIGENCE_CONTEXT_LENGTH = 1800;

type BulbyOrgContext = {
  product: string;
  architecture: string;
  apps: string[];
  coreDomains: string[];
  stack: string[];
  constraints: string[];
};

type BulbyMemoryData = {
  version: number;
  systemPrompt: string;
  orgContext: BulbyOrgContext;
  notes: string[];
  ruleEntries: BulbyRuleEntry[];
  rulesFileMarkdown: string;
  updatedAtIso: string;
};

const DEFAULT_SYSTEM_PROMPT =
  "You are Bulby, the IdeaHome org assistant. Be concise, action-oriented, and grounded in project data. Prefer deterministic answers from project lists/issues/expenses before general model speculation. Respect organization and project boundaries.";

const DEFAULT_ORG_CONTEXT: BulbyOrgContext = {
  product:
    "IdeaHome is a multi-tenant project execution platform with board/issues, checklists, expenses, calendar, tests, and AI assistant flows.",
  architecture:
    "Monorepo with Next.js web, NestJS+Prisma backend, React Native app, and shared packages for routes/types/constants.",
  apps: ["web", "backend", "app", "shared", "shared-config", "shared-assistant"],
  coreDomains: [
    "auth",
    "organizations",
    "projects",
    "users",
    "issues",
    "todos",
    "ideas",
    "bugs",
    "features",
    "expenses",
    "plaid",
    "calendar",
    "tests",
    "code",
    "tax-documents",
    "support",
  ],
  stack: ["Next.js", "NestJS", "Prisma", "PostgreSQL", "React Native", "Vercel"],
  constraints: [
    "Prefer internal project data over web search unless freshness is required.",
    "For expense questions, prioritize direct date/overview summaries from expense records.",
    "Ask one precise clarification only when required context is missing.",
    "Never claim a calendar action succeeded unless the calendar API actually succeeded.",
    "If a calendar action is unsupported or fails, say so clearly instead of implying it was completed.",
    "After successful calendar create, update, or delete actions, refresh the visible calendar state.",
    "Never claim a bug action succeeded unless the bug API actually succeeded.",
    "If a bug action is unsupported or fails, say so clearly instead of implying it was completed.",
    "After successful bug create, update, or delete actions, refresh the visible bug state.",
    "For weather questions, only report data fetched from the real-time weather tool; never invent, guess, or approximate weather conditions. If weather data is unavailable, say so clearly.",
  ],
};

const DEFAULT_RULE_ENTRIES: BulbyRuleEntry[] = [
  {
    id: "baseline-calendar-create-truth",
    kind: "rule",
    title: "Calendar create truthfulness",
    detail:
      "Bulby must not say a calendar event was added unless createCalendarEvent succeeded.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-calendar-followup-create",
    kind: "rule",
    title: "Calendar follow-up completion",
    detail:
      "When Bulby asks for a missing time, the next reply must complete the pending calendar create instead of falling back to generic assistant text.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-calendar-refresh",
    kind: "rule",
    title: "Calendar UI refresh after mutation",
    detail:
      "After successful calendar create, update, or delete actions, Bulby must refresh the visible calendar state so the UI reflects the backend result.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-calendar-edit-handler",
    kind: "rule",
    title: "Calendar edit intent handling",
    detail:
      "Calendar edit requests must use a real update handler and call updateCalendarEvent instead of summarizing events.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-calendar-delete-handler",
    kind: "rule",
    title: "Calendar delete intent handling",
    detail:
      "Calendar delete requests must find matching events and call deleteCalendarEvent instead of generating a false success message.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-unsupported-mutation-refusal",
    kind: "rule",
    title: "Unsupported mutation refusal",
    detail:
      "If Bulby cannot perform an app mutation through a real API handler, it must say it could not complete the action and must never imply success.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-mobile-first-tap",
    kind: "rule",
    title: "Mobile first-tap open",
    detail:
      "Bulby must open on the first mobile tap without requiring a second tap or double-triggering from synthetic clicks.",
    createdAtIso: "2026-03-01T04:05:32.000Z",
  },
  {
    id: "baseline-drag-reopen",
    kind: "rule",
    title: "Drag interaction stability",
    detail:
      "When Bulby is dragged, the panel should close during drag and reopen after drag end instead of getting stuck or mispositioned.",
    createdAtIso: "2026-03-01T04:26:16.000Z",
  },
  {
    id: "baseline-focus-retention",
    kind: "rule",
    title: "Input focus retention",
    detail:
      "After Bulby responds, the text input should stay focused so follow-up typing works without extra clicks.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-mobile-onscreen",
    kind: "rule",
    title: "Mobile panel visibility while thinking",
    detail:
      "While Bulby is thinking on mobile, the panel must remain on-screen and usable.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-calendar-qa-routing",
    kind: "rule",
    title: "Calendar question routing",
    detail:
      "Calendar questions for today, explicit dates, weeks, and date ranges must answer from synced calendar data instead of generic assistant text.",
    createdAtIso: "2026-03-06T00:00:00.000Z",
  },
  {
    id: "baseline-weather-truthfulness",
    kind: "rule",
    title: "Weather truthfulness",
    detail:
      "Bulby must only report weather from the live weather API result. Never fabricate, guess, or approximate temperatures, conditions, or locations. If weather data could not be fetched, say so clearly.",
    createdAtIso: "2026-03-07T00:00:00.000Z",
  },
];

let memoryCache: BulbyMemoryData | null = null;
let loadPromise: Promise<BulbyMemoryData> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function defaultMemory(): BulbyMemoryData {
  const base: BulbyMemoryData = {
    version: BULBY_MEMORY_VERSION,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    orgContext: DEFAULT_ORG_CONTEXT,
    notes: [],
    ruleEntries: DEFAULT_RULE_ENTRIES,
    rulesFileMarkdown: "",
    updatedAtIso: nowIso(),
  };
  return {
    ...base,
    rulesFileMarkdown: buildBulbyRulesFileMarkdown(base),
  };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function normalizeNotes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, MAX_NOTE_LENGTH))
    .slice(0, MAX_NOTES);
}

function normalizeApps(value: unknown, fallback: string[]): string[] {
  const apps = normalizeNotes(value);
  return apps.length > 0 ? apps : fallback;
}

function normalizeRuleEntries(value: unknown): BulbyRuleEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is BulbyRuleEntry =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          typeof (entry as BulbyRuleEntry).id === "string" &&
          typeof (entry as BulbyRuleEntry).kind === "string" &&
          typeof (entry as BulbyRuleEntry).title === "string" &&
          typeof (entry as BulbyRuleEntry).detail === "string" &&
          typeof (entry as BulbyRuleEntry).createdAtIso === "string"
      )
    )
    .map((entry) => ({
      id: entry.id.trim(),
      kind: entry.kind,
      title: entry.title.trim(),
      detail: entry.detail.trim(),
      createdAtIso: entry.createdAtIso.trim(),
    }))
    .filter((entry) => entry.id && entry.title && entry.detail);
}

function buildBulbyRulesFileMarkdown(
  memory: Pick<BulbyMemoryData, "orgContext" | "notes" | "ruleEntries" | "updatedAtIso">
): string {
  const lines = [
    "# Bulby Rules and Learnings",
    "",
    `Updated: ${memory.updatedAtIso}`,
    "",
    "## Active Rules",
    ...memory.orgContext.constraints.map((rule) => `- ${rule}`),
    "",
    "## Learnings",
    ...(memory.notes.length > 0
      ? memory.notes.map((note) => `- ${note}`)
      : ["- No saved learnings yet."]),
    "",
    "## Journal",
    ...(memory.ruleEntries.length > 0
      ? memory.ruleEntries.map(
          (entry) =>
            `- [${entry.kind}] ${entry.createdAtIso} | ${entry.title}: ${entry.detail}`
        )
      : ["- No journal entries yet."]),
  ];
  return lines.join("\n");
}

function normalizeBulbyMemory(raw: unknown): BulbyMemoryData {
  const base = defaultMemory();
  if (!raw || typeof raw !== "object") return base;
  const candidate = raw as Partial<BulbyMemoryData>;
  const orgRaw =
    candidate.orgContext && typeof candidate.orgContext === "object"
      ? candidate.orgContext
      : {};
  const normalized: BulbyMemoryData = {
    version:
      typeof candidate.version === "number"
        ? candidate.version
        : BULBY_MEMORY_VERSION,
    systemPrompt:
      typeof candidate.systemPrompt === "string" && candidate.systemPrompt.trim()
        ? candidate.systemPrompt.trim()
        : base.systemPrompt,
    orgContext: {
      product:
        typeof (orgRaw as BulbyOrgContext).product === "string" &&
        (orgRaw as BulbyOrgContext).product.trim()
          ? (orgRaw as BulbyOrgContext).product.trim()
          : base.orgContext.product,
      architecture:
        typeof (orgRaw as BulbyOrgContext).architecture === "string" &&
        (orgRaw as BulbyOrgContext).architecture.trim()
          ? (orgRaw as BulbyOrgContext).architecture.trim()
          : base.orgContext.architecture,
      apps: normalizeApps((orgRaw as BulbyOrgContext).apps, base.orgContext.apps),
      coreDomains: normalizeApps(
        (orgRaw as BulbyOrgContext).coreDomains,
        base.orgContext.coreDomains
      ),
      stack: normalizeApps((orgRaw as BulbyOrgContext).stack, base.orgContext.stack),
      constraints: normalizeApps(
        (orgRaw as BulbyOrgContext).constraints,
        base.orgContext.constraints
      ),
    },
    notes: normalizeNotes(candidate.notes),
    ruleEntries: normalizeRuleEntries(candidate.ruleEntries),
    rulesFileMarkdown:
      typeof candidate.rulesFileMarkdown === "string"
        ? candidate.rulesFileMarkdown.trim()
        : "",
    updatedAtIso:
      typeof candidate.updatedAtIso === "string" && candidate.updatedAtIso.trim()
        ? candidate.updatedAtIso
        : base.updatedAtIso,
  };
  return {
    ...normalized,
    rulesFileMarkdown: buildBulbyRulesFileMarkdown(normalized),
  };
}

function fromApi(value: BulbyMemoryPreferences): BulbyMemoryData {
  return normalizeBulbyMemory(value);
}

function loadLocalMemory(): BulbyMemoryData {
  if (!canUseStorage()) return defaultMemory();
  try {
    const raw = localStorage.getItem(BULBY_MEMORY_STORAGE_KEY);
    if (!raw) return defaultMemory();
    return normalizeBulbyMemory(JSON.parse(raw));
  } catch {
    return defaultMemory();
  }
}

function saveLocalMemory(memory: BulbyMemoryData): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(BULBY_MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // ignore storage write failures
  }
}

async function loadServerMemory(): Promise<BulbyMemoryData> {
  const response = await fetchMyBulbyMemoryPrefs();
  return fromApi(response);
}

export async function loadBulbyMemory(
  options?: { forceRefresh?: boolean }
): Promise<BulbyMemoryData> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && memoryCache) return memoryCache;
  if (!forceRefresh && loadPromise) return loadPromise;

  const local = loadLocalMemory();
  loadPromise = (async () => {
    try {
      const server = await loadServerMemory();
      memoryCache = server;
      saveLocalMemory(server);
      return server;
    } catch {
      memoryCache = local;
      saveLocalMemory(local);
      return local;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export async function initializeBulbyMemory(): Promise<BulbyMemoryData> {
  return loadBulbyMemory({ forceRefresh: true });
}

export function extractRememberNote(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  const direct = /^remember(?:\s+that)?\s+(.+)$/i.exec(trimmed);
  if (direct?.[1]) return direct[1].trim().slice(0, MAX_NOTE_LENGTH);
  const addressed = /^bulby[,:]?\s+remember(?:\s+that)?\s+(.+)$/i.exec(trimmed);
  if (addressed?.[1]) return addressed[1].trim().slice(0, MAX_NOTE_LENGTH);
  return null;
}

function appendAndDedupeNotes(existing: string[], nextNote: string): string[] {
  const deduped = [nextNote, ...existing.filter((entry) => entry !== nextNote)];
  return deduped.slice(0, MAX_NOTES);
}

export async function saveBulbyMemoryNote(note: string): Promise<BulbyMemoryData> {
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  const current = await loadBulbyMemory();
  if (!trimmed) return current;

  try {
    const server = await updateMyBulbyMemoryPrefs({
      appendNote: trimmed,
      appendRuleEntry: {
        kind: "learning",
        title: "Bulby learned something new",
        detail: trimmed,
      },
    });
    const normalized = fromApi(server);
    memoryCache = normalized;
    saveLocalMemory(normalized);
    return normalized;
  } catch {
    const fallback: BulbyMemoryData = {
      ...current,
      notes: appendAndDedupeNotes(current.notes, trimmed),
      ruleEntries: [
        {
          id: `bulby-${Date.now()}`,
          kind: "learning" as const,
          title: "Bulby learned something new",
          detail: trimmed,
          createdAtIso: nowIso(),
        },
        ...current.ruleEntries,
      ].slice(0, MAX_RULE_ENTRIES),
      updatedAtIso: nowIso(),
      rulesFileMarkdown: "",
    };
    fallback.rulesFileMarkdown = buildBulbyRulesFileMarkdown(fallback);
    memoryCache = fallback;
    saveLocalMemory(fallback);
    return fallback;
  }
}

export async function appendBulbyRuleEntry(input: {
  kind: BulbyRuleEntry["kind"];
  title: string;
  detail: string;
}): Promise<BulbyMemoryData> {
  const title = input.title.trim();
  const detail = input.detail.trim();
  if (!title || !detail) return loadBulbyMemory();
  try {
    const server = await updateMyBulbyMemoryPrefs({
      appendRuleEntry: {
        kind: input.kind,
        title,
        detail,
      },
    });
    const normalized = fromApi(server);
    memoryCache = normalized;
    saveLocalMemory(normalized);
    return normalized;
  } catch {
    const current = await loadBulbyMemory();
    const fallback: BulbyMemoryData = {
      ...current,
      ruleEntries: [
        {
          id: `bulby-${Date.now()}`,
          kind: input.kind,
          title,
          detail,
          createdAtIso: nowIso(),
        },
        ...current.ruleEntries,
      ].slice(0, MAX_RULE_ENTRIES),
      updatedAtIso: nowIso(),
      rulesFileMarkdown: "",
    };
    fallback.rulesFileMarkdown = buildBulbyRulesFileMarkdown(fallback);
    memoryCache = fallback;
    saveLocalMemory(fallback);
    return fallback;
  }
}

export async function buildBulbyIntelligenceContext(): Promise<string> {
  const memory = await loadBulbyMemory();
  const notesBlock =
    memory.notes.length > 0
      ? memory.notes.map((note) => `- ${note}`).join("\n")
      : "- No user-saved memory notes yet.";
  const block = [
    "Bulby Intelligence Profile",
    `System prompt: ${memory.systemPrompt}`,
    `Product: ${memory.orgContext.product}`,
    `Architecture: ${memory.orgContext.architecture}`,
    `Apps: ${memory.orgContext.apps.join(", ")}`,
    `Core domains: ${memory.orgContext.coreDomains.join(", ")}`,
    `Tech stack: ${memory.orgContext.stack.join(", ")}`,
    "Behavior constraints:",
    ...memory.orgContext.constraints.map((line) => `- ${line}`),
    "Bulby rules file:",
    memory.rulesFileMarkdown,
    "User memory notes:",
    notesBlock,
  ].join("\n");
  return block.slice(-MAX_INTELLIGENCE_CONTEXT_LENGTH);
}
