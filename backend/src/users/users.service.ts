import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import {
  APPEARANCE_PRESET_IDS,
  type AppearancePreferences,
  type AppearancePresetId,
} from "@ideahome/shared-config";
import { PrismaService } from "../prisma.service";

const APPEARANCE_PREFS_VERSION = 1;
const DEFAULT_APPEARANCE_PRESET: AppearancePresetId = "classic";
const BULBY_MEMORY_VERSION = 1;
const BULBY_MAX_NOTES = 16;
const BULBY_MAX_NOTE_LENGTH = 220;
const BULBY_MAX_PROMPT_LENGTH = 800;
const BULBY_MAX_CONTEXT_TEXT_LENGTH = 400;
const BULBY_MAX_CONTEXT_ITEMS = 24;
const BULBY_MAX_RULE_ENTRIES = 64;
const BULBY_MAX_RULE_TITLE_LENGTH = 120;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppearancePresetId(value: unknown): value is AppearancePresetId {
  return (
    typeof value === "string" &&
    (APPEARANCE_PRESET_IDS as readonly string[]).includes(value)
  );
}

function buildDefaultAppearancePreferences(): AppearancePreferences {
  return {
    version: APPEARANCE_PREFS_VERSION,
    lightPreset: DEFAULT_APPEARANCE_PRESET,
    darkPreset: DEFAULT_APPEARANCE_PRESET,
    updatedAt: new Date().toISOString(),
  };
}

type BulbyOrgContext = {
  product: string;
  architecture: string;
  apps: string[];
  coreDomains: string[];
  stack: string[];
  constraints: string[];
};

export type BulbyMemoryPreferences = {
  version: number;
  systemPrompt: string;
  orgContext: BulbyOrgContext;
  notes: string[];
  ruleEntries: BulbyRuleEntry[];
  rulesFileMarkdown: string;
  updatedAtIso: string;
};

export type BulbyRuleEntry = {
  id: string;
  kind: "learning" | "rule" | "action";
  title: string;
  detail: string;
  createdAtIso: string;
};

const DEFAULT_BULBY_RULE_ENTRIES: BulbyRuleEntry[] = [
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
];

function nowIso(): string {
  return new Date().toISOString();
}

function createRuleEntryId(): string {
  return `bulby-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, maxItemLength))
    .slice(0, maxItems);
}

function normalizeStringArrayOrDefault(
  value: unknown,
  fallback: string[]
): string[] {
  const normalized = normalizeStringArray(
    value,
    BULBY_MAX_CONTEXT_ITEMS,
    BULBY_MAX_CONTEXT_TEXT_LENGTH
  );
  return normalized.length > 0 ? normalized : fallback;
}

function buildDefaultBulbyMemoryPreferences(): BulbyMemoryPreferences {
  const base: BulbyMemoryPreferences = {
    version: BULBY_MEMORY_VERSION,
    systemPrompt:
      "You are Bulby, the IdeaHome org assistant. Be concise, action-oriented, and grounded in project data.",
    orgContext: {
      product:
        "IdeaHome is a multi-tenant project platform with board/issues, checklists, expenses, calendar, tests, and assistant workflows.",
      architecture:
        "Monorepo with Next.js web, NestJS+Prisma backend, React Native app, and shared packages.",
      apps: [
        "web",
        "backend",
        "app",
        "shared",
        "shared-config",
        "shared-assistant",
      ],
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
      stack: [
        "Next.js",
        "NestJS",
        "Prisma",
        "PostgreSQL",
        "React Native",
        "Vercel",
      ],
      constraints: [
        "Prefer internal project data before external web search.",
        "Answer expense questions from expense records when possible.",
        "Ask one precise clarification when required context is missing.",
        "Never claim a calendar action succeeded unless the calendar API actually succeeded.",
        "If a calendar action is unsupported or fails, say so clearly instead of implying it was completed.",
        "After successful calendar create, update, or delete actions, refresh the visible calendar state.",
        "Never claim a bug action succeeded unless the bug API actually succeeded.",
        "If a bug action is unsupported or fails, say so clearly instead of implying it was completed.",
        "After successful bug create, update, or delete actions, refresh the visible bug state.",
      ],
    },
    notes: [],
    ruleEntries: DEFAULT_BULBY_RULE_ENTRIES,
    rulesFileMarkdown: "",
    updatedAtIso: nowIso(),
  };
  return {
    ...base,
    rulesFileMarkdown: buildBulbyRulesFileMarkdown(base),
  };
}

function normalizeRuleKind(value: unknown): BulbyRuleEntry["kind"] | null {
  return value === "learning" || value === "rule" || value === "action"
    ? value
    : null;
}

function normalizeRuleEntries(value: unknown): BulbyRuleEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => isPlainObject(entry))
    .map((entry) => {
      const kind = normalizeRuleKind(entry.kind) ?? "rule";
      const title =
        typeof entry.title === "string"
          ? entry.title.trim().slice(0, BULBY_MAX_RULE_TITLE_LENGTH)
          : "";
      const detail =
        typeof entry.detail === "string"
          ? entry.detail.trim().slice(0, BULBY_MAX_CONTEXT_TEXT_LENGTH)
          : "";
      const createdAtIso =
        typeof entry.createdAtIso === "string" && entry.createdAtIso.trim()
          ? entry.createdAtIso
          : nowIso();
      if (!title || !detail) return null;
      return {
        id:
          typeof entry.id === "string" && entry.id.trim()
            ? entry.id.trim()
            : createRuleEntryId(),
        kind,
        title,
        detail,
        createdAtIso,
      };
    })
    .filter((entry): entry is BulbyRuleEntry => Boolean(entry))
    .slice(0, BULBY_MAX_RULE_ENTRIES);
}

function buildBulbyRulesFileMarkdown(
  memory: Pick<BulbyMemoryPreferences, "orgContext" | "notes" | "ruleEntries" | "updatedAtIso">
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

function resolveBulbyRulesFilePath(): string {
  const candidates = [
    resolve(process.cwd(), "../docs/BULBY_RULES.md"),
    resolve(process.cwd(), "docs/BULBY_RULES.md"),
    resolve(__dirname, "../../../docs/BULBY_RULES.md"),
    resolve(__dirname, "../../../../docs/BULBY_RULES.md"),
  ];
  const existing = candidates.find((candidate) => existsSync(candidate));
  return existing ?? candidates[0];
}

function normalizeBulbyMemoryPreferences(raw: unknown): BulbyMemoryPreferences {
  const defaults = buildDefaultBulbyMemoryPreferences();
  if (!isPlainObject(raw)) return defaults;
  const orgRaw = isPlainObject(raw.orgContext) ? raw.orgContext : {};
  const normalized: BulbyMemoryPreferences = {
    version: BULBY_MEMORY_VERSION,
    systemPrompt:
      typeof raw.systemPrompt === "string" && raw.systemPrompt.trim()
        ? raw.systemPrompt.trim().slice(0, BULBY_MAX_PROMPT_LENGTH)
        : defaults.systemPrompt,
    orgContext: {
      product:
        typeof orgRaw.product === "string" && orgRaw.product.trim()
          ? orgRaw.product.trim().slice(0, BULBY_MAX_CONTEXT_TEXT_LENGTH)
          : defaults.orgContext.product,
      architecture:
        typeof orgRaw.architecture === "string" && orgRaw.architecture.trim()
          ? orgRaw.architecture.trim().slice(0, BULBY_MAX_CONTEXT_TEXT_LENGTH)
          : defaults.orgContext.architecture,
      apps:
        normalizeStringArrayOrDefault(orgRaw.apps, defaults.orgContext.apps),
      coreDomains:
        normalizeStringArrayOrDefault(
          orgRaw.coreDomains,
          defaults.orgContext.coreDomains
        ),
      stack:
        normalizeStringArrayOrDefault(orgRaw.stack, defaults.orgContext.stack),
      constraints:
        normalizeStringArrayOrDefault(
          orgRaw.constraints,
          defaults.orgContext.constraints
        ),
    },
    notes: normalizeStringArray(raw.notes, BULBY_MAX_NOTES, BULBY_MAX_NOTE_LENGTH),
    ruleEntries: normalizeRuleEntries(raw.ruleEntries),
    rulesFileMarkdown:
      typeof raw.rulesFileMarkdown === "string" && raw.rulesFileMarkdown.trim()
        ? raw.rulesFileMarkdown.trim()
        : "",
    updatedAtIso:
      typeof raw.updatedAtIso === "string" && raw.updatedAtIso.trim()
        ? raw.updatedAtIso
        : defaults.updatedAtIso,
  };
  return {
    ...normalized,
    rulesFileMarkdown: buildBulbyRulesFileMarkdown(normalized),
  };
}

function extractPrefs(raw: unknown): {
  appearanceRaw: unknown;
  bulbyMemoryRaw: unknown;
} {
  if (!isPlainObject(raw)) {
    return { appearanceRaw: undefined, bulbyMemoryRaw: undefined };
  }
  const hasContainerKeys = "appearance" in raw || "bulbyMemory" in raw;
  if (hasContainerKeys) {
    return {
      appearanceRaw: raw.appearance,
      bulbyMemoryRaw: raw.bulbyMemory,
    };
  }
  return {
    appearanceRaw: raw,
    bulbyMemoryRaw: undefined,
  };
}

function buildPrefsContainer(
  appearance: AppearancePreferences,
  bulbyMemory: BulbyMemoryPreferences
): Record<string, unknown> {
  return {
    appearance,
    bulbyMemory,
  };
}

function normalizeAppearancePreferences(raw: unknown): AppearancePreferences {
  const defaults = buildDefaultAppearancePreferences();
  if (!isPlainObject(raw)) return defaults;
  const lightPreset = isAppearancePresetId(raw.lightPreset)
    ? raw.lightPreset
    : defaults.lightPreset;
  const darkPreset = isAppearancePresetId(raw.darkPreset)
    ? raw.darkPreset
    : defaults.darkPreset;
  const updatedAt =
    typeof raw.updatedAt === "string" && raw.updatedAt.trim()
      ? raw.updatedAt
      : defaults.updatedAt;
  return {
    version: APPEARANCE_PREFS_VERSION,
    lightPreset,
    darkPreset,
    updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private syncBulbyRulesFile(memory: BulbyMemoryPreferences): void {
    try {
      const path = resolveBulbyRulesFilePath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${memory.rulesFileMarkdown}\n`, "utf8");
    } catch {
      // Keep preferences working even if the local workspace file cannot be written.
    }
  }

  async list(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    let orgId = me?.organizationId ?? null;
    if (!orgId) {
      const membership = await this.prisma.organizationMembership.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      });
      orgId = membership?.organizationId ?? null;
    }
    if (!orgId) return [];
    return this.prisma.user.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { organizationMemberships: { some: { organizationId: orgId } } },
        ],
      },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    });
  }

  async getAppearancePreferences(userId: string): Promise<AppearancePreferences> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appearancePrefs: true },
    });
    const extracted = extractPrefs(me?.appearancePrefs);
    return normalizeAppearancePreferences(extracted.appearanceRaw);
  }

  async updateAppearancePreferences(
    userId: string,
    input: { lightPreset?: unknown; darkPreset?: unknown }
  ): Promise<AppearancePreferences> {
    if (!isAppearancePresetId(input.lightPreset)) {
      throw new BadRequestException("Invalid lightPreset");
    }
    if (!isAppearancePresetId(input.darkPreset)) {
      throw new BadRequestException("Invalid darkPreset");
    }

    const next: AppearancePreferences = {
      version: APPEARANCE_PREFS_VERSION,
      lightPreset: input.lightPreset,
      darkPreset: input.darkPreset,
      updatedAt: new Date().toISOString(),
    };
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appearancePrefs: true },
    });
    const extracted = extractPrefs(me?.appearancePrefs);
    const existingBulbyMemory = normalizeBulbyMemoryPreferences(
      extracted.bulbyMemoryRaw
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        appearancePrefs: buildPrefsContainer(
          next,
          existingBulbyMemory
        ) as Prisma.InputJsonValue,
      },
    });
    return next;
  }

  async getBulbyMemoryPreferences(
    userId: string
  ): Promise<BulbyMemoryPreferences> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appearancePrefs: true },
    });
    const extracted = extractPrefs(me?.appearancePrefs);
    const memory = normalizeBulbyMemoryPreferences(extracted.bulbyMemoryRaw);
    this.syncBulbyRulesFile(memory);
    return memory;
  }

  async updateBulbyMemoryPreferences(
    userId: string,
    input: {
      systemPrompt?: unknown;
      orgContext?: unknown;
      notes?: unknown;
      appendNote?: unknown;
      appendRuleEntry?: unknown;
    }
  ): Promise<BulbyMemoryPreferences> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { appearancePrefs: true },
    });
    const extracted = extractPrefs(me?.appearancePrefs);
    const currentAppearance = normalizeAppearancePreferences(extracted.appearanceRaw);
    const currentBulby = normalizeBulbyMemoryPreferences(extracted.bulbyMemoryRaw);

    const nextOrgRaw = isPlainObject(input.orgContext) ? input.orgContext : {};
    const mergedRaw = {
      ...currentBulby,
      ...(typeof input.systemPrompt === "string"
        ? { systemPrompt: input.systemPrompt }
        : {}),
      ...(isPlainObject(input.orgContext)
        ? { orgContext: { ...currentBulby.orgContext, ...nextOrgRaw } }
        : {}),
      ...(Array.isArray(input.notes) ? { notes: input.notes } : {}),
    };
    const normalized = normalizeBulbyMemoryPreferences(mergedRaw);
    const appendNote =
      typeof input.appendNote === "string" ? input.appendNote.trim() : "";
    const notes = appendNote
      ? [appendNote.slice(0, BULBY_MAX_NOTE_LENGTH), ...normalized.notes]
      : normalized.notes;
    const dedupedNotes = [...new Set(notes)].slice(0, BULBY_MAX_NOTES);
    const appendRuleEntry = isPlainObject(input.appendRuleEntry)
      ? input.appendRuleEntry
      : null;
    const nextRuleEntry =
      appendRuleEntry &&
      typeof appendRuleEntry.title === "string" &&
      typeof appendRuleEntry.detail === "string"
        ? {
            id: createRuleEntryId(),
            kind: normalizeRuleKind(appendRuleEntry.kind) ?? "rule",
            title: appendRuleEntry.title.trim().slice(0, BULBY_MAX_RULE_TITLE_LENGTH),
            detail: appendRuleEntry.detail.trim().slice(0, BULBY_MAX_CONTEXT_TEXT_LENGTH),
            createdAtIso: nowIso(),
          }
        : null;
    const ruleEntries = nextRuleEntry?.title && nextRuleEntry.detail
      ? [nextRuleEntry, ...normalized.ruleEntries].slice(0, BULBY_MAX_RULE_ENTRIES)
      : normalized.ruleEntries;

    const nextBase: BulbyMemoryPreferences = {
      ...normalized,
      notes: dedupedNotes,
      ruleEntries,
      rulesFileMarkdown: "",
      updatedAtIso: nowIso(),
    };
    const next: BulbyMemoryPreferences = {
      ...nextBase,
      rulesFileMarkdown: buildBulbyRulesFileMarkdown(nextBase),
    };

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        appearancePrefs: buildPrefsContainer(
          currentAppearance,
          next
        ) as Prisma.InputJsonValue,
      },
    });

    this.syncBulbyRulesFile(next);
    return next;
  }
}
