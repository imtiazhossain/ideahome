import React from "react";
import type { CustomTabIcon, CustomTabKind } from "../lib/customTabs";
import {
  IconBoard,
  IconBook,
  IconBug,
  IconCalendar,
  IconCart,
  IconCode,
  IconEnhancements,
  IconFeatures,
  IconForkKnife,
  IconGlobe,
  IconGoals,
  IconHome,
  IconIdeas,
  IconPackage,
  IconPages,
  IconPlane,
  IconShip,
  IconShirt,
  IconTodo,
} from "./icons";

type PresetDefinition = {
  id: string;
  label: string;
  Icon: React.FC;
  searchTerms?: string[];
};

export const CUSTOM_TAB_ICON_PRESETS: PresetDefinition[] = [
  { id: "ideas", label: "Ideas", Icon: IconIdeas, searchTerms: ["idea", "brainstorm", "concept", "inspiration"] },
  { id: "todo", label: "Checklist", Icon: IconTodo, searchTerms: ["todo", "task", "tasks", "check", "checklist", "errand", "plan"] },
  { id: "cart", label: "Shopping", Icon: IconCart, searchTerms: ["shop", "shopping", "buy", "purchase", "cart", "store", "market"] },
  { id: "ship", label: "Shipping", Icon: IconShip, searchTerms: ["ship", "shipping", "shipment", "freight", "cargo", "logistics", "transport"] },
  { id: "package", label: "Packages", Icon: IconPackage, searchTerms: ["package", "parcel", "delivery", "deliveries", "mail", "post", "box"] },
  { id: "shirt", label: "Clothing", Icon: IconShirt, searchTerms: ["cloth", "clothing", "shirt", "fashion", "wardrobe", "outfit", "dress", "shoes"] },
  { id: "book", label: "Reading", Icon: IconBook, searchTerms: ["book", "books", "read", "reading", "library", "study", "journal", "notes"] },
  { id: "food", label: "Food", Icon: IconForkKnife, searchTerms: ["food", "meal", "recipe", "cook", "kitchen", "grocery", "groceries", "dinner", "lunch", "breakfast", "restaurant"] },
  { id: "travel", label: "Travel", Icon: IconPlane, searchTerms: ["travel", "trip", "flight", "vacation", "holiday", "journey", "hotel", "packing"] },
  { id: "home", label: "Home", Icon: IconHome, searchTerms: ["home", "house", "room", "apartment", "rent", "garden", "family"] },
  { id: "features", label: "Features", Icon: IconFeatures, searchTerms: ["feature", "features", "roadmap", "product"] },
  { id: "pages", label: "Pages", Icon: IconPages, searchTerms: ["page", "pages", "doc", "docs", "document", "wiki"] },
  { id: "board", label: "Board", Icon: IconBoard, searchTerms: ["board", "kanban", "sprint", "backlog"] },
  { id: "goals", label: "Goals", Icon: IconGoals, searchTerms: ["goal", "target", "milestone", "habit"] },
  { id: "globe", label: "Summary", Icon: IconGlobe, searchTerms: ["summary", "overview", "dashboard", "report"] },
  { id: "calendar", label: "Calendar", Icon: IconCalendar, searchTerms: ["calendar", "schedule", "event", "meeting", "appointments"] },
  { id: "code", label: "Code", Icon: IconCode, searchTerms: ["code", "dev", "development", "engineering", "programming", "software"] },
  { id: "enhancements", label: "Spark", Icon: IconEnhancements, searchTerms: ["spark", "enhance", "improve", "upgrade", "polish"] },
  { id: "bug", label: "Bug", Icon: IconBug, searchTerms: ["bug", "issue", "fix", "defect", "incident"] },
];

export const RESERVED_CUSTOM_TAB_ICON_IDS = [
  "ideas",
  "todo",
  "features",
  "pages",
  "board",
  "goals",
  "globe",
  "calendar",
  "code",
  "enhancements",
  "bug",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function colorFromSeed(seed: string): string {
  return `hsl(${hashString(seed) % 360}, 55%, 42%)`;
}

function normalizeCustomColor(color?: string): string | undefined {
  if (typeof color !== "string") return undefined;
  const trimmed = color.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : undefined;
}

function initialsFromSeed(seed: string): string {
  const trimmed = seed.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`
      .toUpperCase()
      .slice(0, 2);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function normalizeCustomInitials(initials?: string): string | undefined {
  if (typeof initials !== "string") return undefined;
  const normalized = initials.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 3);
  return normalized || undefined;
}

function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stemWord(value: string): string {
  let result = normalizeWord(value);
  if (result.endsWith("ies") && result.length > 4) {
    result = `${result.slice(0, -3)}y`;
  } else if (result.endsWith("ing") && result.length > 5) {
    result = result.slice(0, -3);
  } else if (result.endsWith("ed") && result.length > 4) {
    result = result.slice(0, -2);
  } else if (result.endsWith("es") && result.length > 4) {
    result = result.slice(0, -2);
  } else if (result.endsWith("s") && result.length > 3) {
    result = result.slice(0, -1);
  }
  return result;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = Array.from({ length: a.length + 1 }, (_, index) => index);
  for (let i = 1; i <= b.length; i += 1) {
    let prev = i - 1;
    rows[0] = i;
    for (let j = 1; j <= a.length; j += 1) {
      const current = rows[j];
      const substitution = a[j - 1] === b[i - 1] ? prev : prev + 1;
      rows[j] = Math.min(rows[j] + 1, rows[j - 1] + 1, substitution);
      prev = current;
    }
  }
  return rows[a.length];
}

export function createGeneratedCustomTabIcon(
  seed: string,
  kind: CustomTabKind,
  options?: { initials?: string; color?: string }
): CustomTabIcon {
  return {
    type: "generated",
    seed: seed.trim() || `New ${kind}`,
    initials: normalizeCustomInitials(options?.initials),
    color: normalizeCustomColor(options?.color),
  };
}

export function createPresetCustomTabIcon(
  presetId: string,
  seed: string,
  kind: CustomTabKind
): CustomTabIcon {
  return {
    type: "preset",
    presetId: presetId || getDefaultPresetIdForKind(kind),
    seed: seed.trim() || `New ${kind}`,
  };
}

export function getSuggestedPresetIdForName(
  name: string,
  kind: CustomTabKind
): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  const haystack = new Set<string>([
    normalized,
    stemWord(normalized),
    ...tokens,
    ...tokens.map((token) => stemWord(token)),
  ]);
  let bestMatch: { presetId: string; score: number } | null = null;

  for (const preset of CUSTOM_TAB_ICON_PRESETS) {
    let score = 0;
    const terms = [preset.label, ...(preset.searchTerms ?? [])];
    for (const term of terms) {
      const stemmedTerm = stemWord(term);
      for (const candidate of haystack) {
        const normalizedCandidate = stemWord(candidate);
        if (normalizedCandidate === stemmedTerm) {
          score += 4;
        } else if (
          normalizedCandidate.includes(stemmedTerm) ||
          stemmedTerm.includes(normalizedCandidate)
        ) {
          score += 2;
        } else if (
          normalizedCandidate.length >= 4 &&
          stemmedTerm.length >= 4 &&
          levenshteinDistance(normalizedCandidate, stemmedTerm) <= 2
        ) {
          score += 3;
        }
      }
    }
    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { presetId: preset.id, score };
    }
  }

  if (bestMatch) return bestMatch.presetId;

  if (kind === "page") return "pages";
  if (kind === "board") return "board";
  return null;
}

function getDefaultPresetIdForKind(kind: CustomTabKind): string {
  if (kind === "page") return "pages";
  if (kind === "board") return "board";
  return "todo";
}

export function generateCustomTabIconFromName(
  name: string,
  kind: CustomTabKind
): CustomTabIcon {
  const presetId = getSuggestedPresetIdForName(name, kind);
  if (presetId) {
    return createPresetCustomTabIcon(presetId, name, kind);
  }
  return createGeneratedCustomTabIcon(name, kind);
}

export function CustomTabIconPreview({
  icon,
  fallbackName,
}: {
  icon: CustomTabIcon;
  fallbackName: string;
}) {
  const preset =
    icon.type === "preset"
      ? CUSTOM_TAB_ICON_PRESETS.find((entry) => entry.id === icon.presetId)
      : null;
  if (preset) {
    const { Icon } = preset;
    return (
      <span className="custom-tab-icon custom-tab-icon--preset" aria-hidden>
        <Icon />
      </span>
    );
  }
  if (icon.type === "preset" && icon.presetId.includes(":")) {
    const src = getRemoteIconUrl(icon.presetId);
    return (
      <span
        className="custom-tab-icon custom-tab-icon--mask"
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
        }}
        aria-hidden
      >
        <span className="custom-tab-icon-mask-fill" />
      </span>
    );
  }
  const seed = icon.seed || fallbackName;
  const initials =
    icon.type === "generated"
      ? normalizeCustomInitials(icon.initials) ?? initialsFromSeed(seed)
      : initialsFromSeed(seed);
  const color =
    icon.type === "generated"
      ? normalizeCustomColor(icon.color) ?? colorFromSeed(seed)
      : colorFromSeed(seed);
  return (
    <span
      className="custom-tab-icon"
      style={{ background: color }}
      aria-hidden
      title={fallbackName}
    >
      {initials}
    </span>
  );
}

export function getRemoteIconUrl(iconId: string): string {
  const path = iconId.replace(":", "/");
  return `https://api.iconify.design/${path}.svg?width=20&height=20`;
}
