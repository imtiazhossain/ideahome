"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BulbyCharacter } from "./BulbyCharacter";
import { CloseButton } from "./CloseButton";
import {
  buildIdeaChatContext,
  shouldUseWebSearch,
  formatProjectListsAsContext,
  combineAssistantContext,
} from "@ideahome/shared-assistant";
import {
  ASSISTANT_VOICE_CHANGE_EVENT,
  fetchCalendarEvents,
  fetchTodos,
  fetchIdeas,
  fetchBugs,
  fetchFeatures,
  generateListItemAssistantChat,
  getStoredOpenRouterModel,
  getStoredAssistantVoiceUri,
  createTodo,
  createIdea,
  createBug,
  createFeature,
  createEnhancement,
  createCalendarEvent,
  CALENDAR_EVENTS_CHANGED_EVENT,
  deleteCalendarEvent,
  updateCalendarEvent,
  fetchExpenses,
  fetchCurrentWeather,
  synthesizeIdeaChatSpeech,
} from "../lib/api";
import { invalidateList } from "../lib/listCache";
import {
  isExpenseOverviewQuery,
  isLatestExpenseQuery,
  summarizeLatestExpense,
  summarizeExpensesForDate,
  summarizeExpensesOverview,
  tryParseExpenseQuery,
} from "../lib/assistantExpenses";
import {
  formatCalendarEventsAsContext,
  getCalendarDayRange,
  getCalendarContextRange,
  isCalendarMutationRequest,
  isCalendarQuestion,
  summarizeMatchingCalendarEvents,
  summarizeCalendarEventsForDay,
  tryParseCalendarDeleteIntent,
  tryParseCalendarEditIntent,
  tryParseCalendarCreateFollowUp,
  tryParseCalendarCreateIntent,
  tryParseCalendarCreateRequest,
  tryParseCalendarEventLookupQuery,
  tryParseCalendarDayQuery,
} from "../lib/assistantCalendar";
import {
  appendBulbyRuleEntry,
  buildBulbyIntelligenceContext,
  extractRememberNote,
  initializeBulbyMemory,
  saveBulbyMemoryNote,
} from "../lib/bulbyMemory";
import {
  formatCurrentWeatherSummary,
  getBrowserPosition,
  isWeatherQuery,
  extractWeatherLocation,
  extractSetLocationIntent,
  saveBulbyLocation,
  getSavedBulbyLocation,
  readWeatherErrorMessage,
} from "../lib/assistantWeather";
import { formatTextForSpeech, splitTextForSpeech } from "../lib/utils";
import { IconMic, IconPlay, IconStop } from "./icons";

const BULBY_POSITION_KEY = "bulby-chatbox-position";

/** localStorage key for hiding the Bulby trigger. "1" = hidden. */
export const BULBY_TRIGGER_HIDDEN_KEY = "bulby-chatbox-trigger-hidden";
/** Custom event to sync hide state (e.g. from drawer settings). detail: { hidden: boolean } */
export const BULBY_TRIGGER_VISIBILITY_EVENT = "ideahome-bulby-trigger-visibility";

function getTriggerHidden(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BULBY_TRIGGER_HIDDEN_KEY) === "1";
}

function persistTriggerHidden(hidden: boolean) {
  if (typeof window === "undefined") return;
  if (hidden) localStorage.setItem(BULBY_TRIGGER_HIDDEN_KEY, "1");
  else localStorage.removeItem(BULBY_TRIGGER_HIDDEN_KEY);
}

/** When we have an explicit position, panel is absolutely positioned above the trigger so the container never grows (avoids open glitch). */
const BULBY_CHATBOX_GAP = 12;
/** Keep the chatbox panel within the viewport when Bulby is near an edge. */
const VIEWPORT_MARGIN = 24;
/** Min pointer movement (px) before treating as drag; avoids suppressing tap-to-open on mobile. */
const DRAG_THRESHOLD_PX = 10;
/** How far off-viewport (px) before stored position is considered off-screen (for load/restore). */
const HIDE_OFF_SCREEN_THRESHOLD = 20;
/** Trigger size for bounds and off-screen check (px); sized to fit alongside project nav (52px). */
const TRIGGER_SIZE = 52;
/** Margin from viewport edges when clamping drag (px). */
const DRAG_BOUNDS_MARGIN = 8;

type DragPosition = { x: number; y: number };

type ClampSize = { width: number; height: number };

function getFallbackTriggerSize(): ClampSize {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) {
    return { width: 44, height: 44 };
  }
  return { width: TRIGGER_SIZE, height: TRIGGER_SIZE };
}

/** Clamp position so the trigger stays fully on the viewport (never off page). */
function clampPositionToViewport(pos: DragPosition, size: ClampSize = getFallbackTriggerSize()): DragPosition {
  if (typeof window === "undefined") return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const minX = DRAG_BOUNDS_MARGIN;
  const minY = DRAG_BOUNDS_MARGIN;
  const maxX = Math.max(minX, w - size.width - DRAG_BOUNDS_MARGIN);
  const maxY = Math.max(minY, h - size.height - DRAG_BOUNDS_MARGIN);
  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  };
}

/** Default: Bulby at top-center of the page, fully on page. */
function getDefaultPosition(): DragPosition {
  if (typeof window === "undefined") return { x: 100, y: DRAG_BOUNDS_MARGIN };
  return clampPositionToViewport({
    x: window.innerWidth / 2 - TRIGGER_SIZE / 2,
    y: DRAG_BOUNDS_MARGIN,
  });
}

function loadStoredPosition(): DragPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BULBY_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      const clamped = clampPositionToViewport(parsed);
      const offScreen =
        parsed.x + TRIGGER_SIZE < HIDE_OFF_SCREEN_THRESHOLD ||
        parsed.x > window.innerWidth - HIDE_OFF_SCREEN_THRESHOLD ||
        parsed.y + TRIGGER_SIZE < HIDE_OFF_SCREEN_THRESHOLD ||
        parsed.y > window.innerHeight - HIDE_OFF_SCREEN_THRESHOLD;
      if (offScreen) {
        const fallback = getDefaultPosition();
        storePosition(fallback);
        return fallback;
      }
      return clamped;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function storePosition(pos: DragPosition | null) {
  if (typeof window === "undefined") return;
  try {
    if (pos) localStorage.setItem(BULBY_POSITION_KEY, JSON.stringify(pos));
    else localStorage.removeItem(BULBY_POSITION_KEY);
  } catch {
    /* ignore */
  }
}

const BULBY_ITEM_NAME = "General";

type AddListTarget = "todos" | "ideas" | "bugs" | "features" | "enhancements";

type AddToListIntent = {
  target: AddListTarget;
  name: string;
};

type ProjectOption = { id: string; name: string };

type MatchProjectResult =
  | { kind: "match"; project: ProjectOption }
  | { kind: "ambiguous"; names: string[] }
  | { kind: "none" };

/** Parse commands like "switch to the Rocky project" and return the target name phrase. */
function parseSwitchProjectIntent(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const patterns = [
    /^(?:can you\s+)?(?:please\s+)?(?:switch|change|set)\s+(?:me\s+)?(?:to\s+)?(?:the\s+)?(.+?)\s+project[.!?]*$/i,
    /^(?:can you\s+)?(?:please\s+)?(?:switch|change|set)\s+project\s+to\s+(.+?)[.!?]*$/i,
    /^(?:open|use|select)\s+(?:the\s+)?(.+?)\s+project[.!?]*$/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    const candidate = match?.[1]?.trim();
    if (candidate) return candidate;
  }
  return null;
}

function normalizeProjectPhrase(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^["']|["']$/g, "")
    .replace(/\bproject\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeFirstCharacter(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeDraftForDisplayAndRouting(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/[?!.]$/.test(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  const looksLikeQuestion =
    /^(what|when|where|who|whom|whose|which|why|how)\b/.test(lower) ||
    /^(can|could|would|should|will|is|are|am|do|does|did|have|has|had)\b/.test(lower) ||
    /^tell me\b/.test(lower) ||
    /^show me\b/.test(lower);

  return looksLikeQuestion ? `${trimmed}?` : trimmed;
}

function matchProjectByName(
  projects: ProjectOption[],
  query: string
): MatchProjectResult {
  const normalizedQuery = normalizeProjectPhrase(query);
  if (!normalizedQuery) return { kind: "none" };

  const indexed = projects
    .map((project) => ({
      project,
      normalized: normalizeProjectPhrase(project.name),
    }))
    .filter((entry) => entry.normalized.length > 0);

  const exact = indexed.filter((entry) => entry.normalized === normalizedQuery);
  if (exact.length === 1) return { kind: "match", project: exact[0].project };
  if (exact.length > 1) {
    return {
      kind: "ambiguous",
      names: exact.map((entry) => entry.project.name),
    };
  }

  const partial = indexed.filter(
    (entry) =>
      entry.normalized.includes(normalizedQuery) ||
      normalizedQuery.includes(entry.normalized)
  );
  if (partial.length === 1) return { kind: "match", project: partial[0].project };
  if (partial.length > 1) {
    return {
      kind: "ambiguous",
      names: partial.map((entry) => entry.project.name),
    };
  }

  return { kind: "none" };
}

/** If the message asks to add something to a list, return target list + item name; otherwise null. */
function parseAddToListIntent(message: string): AddToListIntent | null {
  const trimmed = message.trim();
  const quoted = /add\s+(?:"([^"]*)"|'([^']*)')\s+to\s+(?:my\s+)?(?:the\s+)?([a-z][a-z\s-]*?)(?:\s+list)?$/i.exec(
    trimmed
  );
  if (quoted) {
    const item = (quoted[1] ?? quoted[2] ?? "").trim();
    const target = resolveListTarget(quoted[3] ?? "");
    if (!item || !target) return null;
    return { target, name: capitalizeFirstCharacter(item) };
  }
  const unquoted = /add\s+(.+?)\s+to\s+(?:my\s+)?(?:the\s+)?([a-z][a-z\s-]*?)(?:\s+list)?$/i.exec(
    trimmed
  );
  if (unquoted) {
    const item = unquoted[1].trim();
    const target = resolveListTarget(unquoted[2] ?? "");
    if (!item || !target) return null;
    return { target, name: capitalizeFirstCharacter(item) };
  }
  return null;
}

function resolveListTarget(raw: string): AddListTarget | null {
  const phrase = raw.trim().toLowerCase();
  if (!phrase) return null;
  if (
    phrase.includes("todo") ||
    phrase.includes("to-do") ||
    phrase.includes("to do")
  ) {
    return "todos";
  }
  if (phrase.includes("idea")) return "ideas";
  if (phrase.includes("bug")) return "bugs";
  if (phrase.includes("feature")) return "features";
  if (phrase.includes("enhancement")) return "enhancements";
  return null;
}

function getListTabLabel(target: AddListTarget): string {
  if (target === "todos") return "To-Do";
  if (target === "ideas") return "Ideas";
  if (target === "bugs") return "Bugs";
  if (target === "features") return "Features";
  return "Enhancements";
}

function getListPhrase(target: AddListTarget): string {
  if (target === "todos") return "to-do list";
  if (target === "ideas") return "ideas list";
  if (target === "bugs") return "bugs list";
  if (target === "features") return "features list";
  return "enhancements list";
}

async function createItemForListIntent(
  intent: AddToListIntent,
  projectId: string
): Promise<void> {
  const payload = { projectId, name: intent.name, done: false };
  if (intent.target === "todos") {
    await createTodo(payload);
    return;
  }
  if (intent.target === "ideas") {
    await createIdea(payload);
    return;
  }
  if (intent.target === "bugs") {
    await createBug(payload);
    return;
  }
  if (intent.target === "features") {
    await createFeature(payload);
    return;
  }
  await createEnhancement(payload);
}

function invalidateListForIntent(target: AddListTarget, projectId: string) {
  invalidateList(target, projectId);
}

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };
type AssistantPlaybackStatus = "idle" | "playing" | "paused";
type PendingCalendarCreate = { title: string };

function createMessageId(): string {
  return `bulby-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCalendarCreateSuccess(event: {
  title: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
}): string {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (event.isAllDay) {
    const dateLabel = new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(start);
    return `Added "${event.title}" to your calendar for ${dateLabel}.`;
  }
  const whenLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(end);
  return `Added "${event.title}" to your calendar for ${whenLabel} to ${endLabel}.`;
}

function notifyCalendarEventsChanged(projectId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CALENDAR_EVENTS_CHANGED_EVENT, {
      detail: { projectId },
    })
  );
}

async function logBulbyRule(input: {
  kind: "learning" | "rule" | "action";
  title: string;
  detail: string;
}): Promise<void> {
  try {
    await appendBulbyRuleEntry(input);
  } catch {
    // Keep Bulby responsive even if memory sync fails.
  }
}

function formatCalendarEditSuccess(event: {
  title: string;
  startAt: string;
}): string {
  const whenLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.startAt));
  return `Updated your calendar event to "${event.title}" for ${whenLabel}.`;
}

function formatCalendarDeleteSuccess(count: number): string {
  return count === 1
    ? "Deleted the matching calendar event."
    : `Deleted ${count} matching calendar events.`;
}

function isLikelyAppMutationRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  const hasMutationVerb =
    /\b(add|create|schedule|put|edit|rename|change|update|delete|remove|cancel|complete|mark|move)\b/.test(
      normalized
    );
  if (!hasMutationVerb) return false;
  return /\b(todo|to-do|idea|bug|feature|enhancement|calendar|event|events|expense|project|projects)\b/.test(
    normalized
  );
}

function findMatchingCalendarEvents(
  events: Array<{
    id: string;
    title: string;
    description: string | null;
    location: string | null;
  }>,
  searchText: string
) {
  const tokens = searchText
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  return events.filter((event) => {
    const haystack = `${event.title} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

/** Fetch project lists and format as context via shared module (token-optimized). */
async function buildAppContextBlock(projectId: string): Promise<string> {
  try {
    const [todos, ideas, bugs, features] = await Promise.all([
      fetchTodos(projectId),
      fetchIdeas(projectId),
      fetchBugs(projectId),
      fetchFeatures(projectId),
    ]);
    return formatProjectListsAsContext({
      todos,
      ideas,
      bugs,
      features,
    });
  } catch {
    return "";
  }
}

async function buildCalendarContextBlock(projectId: string): Promise<string> {
  try {
    const { start, end } = getCalendarContextRange();
    const events = await fetchCalendarEvents(projectId, start, end);
    return formatCalendarEventsAsContext(events);
  } catch {
    return "";
  }
}

export interface BulbyChatboxProps {
  /** Current project id; use first project as fallback when none selected. */
  projectId: string;
  projects: ProjectOption[];
  onSwitchProject?: (id: string) => void;
}

export function BulbyChatbox({
  projectId,
  projects,
  onSwitchProject,
}: BulbyChatboxProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking...");
  const [recording, setRecording] = useState(false);
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(false);
  const [playbackStatus, setPlaybackStatus] =
    useState<AssistantPlaybackStatus>("idle");
  const [pendingCalendarCreate, setPendingCalendarCreate] =
    useState<PendingCalendarCreate | null>(null);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>(
    () => getStoredAssistantVoiceUri() ?? ""
  );
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const speechRecognitionRef = useRef<any | null>(null);
  const assistantAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantAudioMetaRef = useRef<{
    messageId: string | null;
    voiceUri: string | null;
  }>({ messageId: null, voiceUri: null });
  const assistantSpeechMetaRef = useRef<{ messageId: string | null }>({
    messageId: null,
  });
  const spokenMessageIdRef = useRef<string | null>(null);
  const playbackIdRef = useRef<number>(0);
  const chatboxRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<DragPosition | null>(null);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [panelOpensBelow, setPanelOpensBelow] = useState(false);
  const [panelLockedHeight, setPanelLockedHeight] = useState<number | null>(null);
  const unlockPanelHeightRafRef = useRef<number | null>(null);
  const panelPlacementLockedRef = useRef(false);
  const [triggerHidden, setTriggerHiddenState] = useState(false);

  useEffect(() => {
    setPosition(loadStoredPosition() ?? getDefaultPosition());
    setTriggerHiddenState(getTriggerHidden());
    void initializeBulbyMemory();
  }, []);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  /** Last position when trigger was in viewport; used to restore when unhiding. */
  const lastInViewportPositionRef = useRef<DragPosition | null>(null);

  const setTriggerHidden = useCallback((hidden: boolean) => {
    setTriggerHiddenState(hidden);
    persistTriggerHidden(hidden);
    if (!hidden) {
      const bottomRight = getDefaultPosition();
      lastInViewportPositionRef.current = bottomRight;
      setPosition(bottomRight);
      storePosition(bottomRight);
    }
    window.dispatchEvent(
      new CustomEvent(BULBY_TRIGGER_VISIBILITY_EVENT, { detail: { hidden } })
    );
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ hidden: boolean }>;
      if (ev.detail?.hidden !== undefined) {
        setTriggerHiddenState(ev.detail.hidden);
        if (ev.detail.hidden) {
          setOpen(false);
        } else {
          const bottomRight = getDefaultPosition();
          lastInViewportPositionRef.current = bottomRight;
          setPosition(bottomRight);
          storePosition(bottomRight);
        }
      }
    };
    window.addEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
    return () => window.removeEventListener(BULBY_TRIGGER_VISIBILITY_EVENT, handler);
  }, []);
  const justDraggedRef = useRef(false);
  /** Set when we toggle open on touchend so the subsequent synthetic click doesn't toggle again. */
  const tapHandledInTouchendRef = useRef(false);
  /** When we close the panel because user started dragging, reopen when they release. */
  const reopenOnDragEndRef = useRef(false);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const scrollThreadToBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollThreadToBottom();
  }, [messages, loading, scrollThreadToBottom]);

  useEffect(() => {
    if (!open) return;
    const raf1 = requestAnimationFrame(() => scrollThreadToBottom());
    const raf2 = requestAnimationFrame(() => scrollThreadToBottom());
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [open, scrollThreadToBottom]);

  useEffect(() => {
    const syncVoice = () =>
      setSelectedVoiceUri(getStoredAssistantVoiceUri() ?? "");
    syncVoice();
    if (typeof window === "undefined") return;
    window.addEventListener(ASSISTANT_VOICE_CHANGE_EVENT, syncVoice);
    window.addEventListener("storage", syncVoice);
    return () => {
      window.removeEventListener(ASSISTANT_VOICE_CHANGE_EVENT, syncVoice);
      window.removeEventListener("storage", syncVoice);
    };
  }, []);

  const focusInputToEnd = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // Some browsers may not support setSelectionRange on textarea; ignore.
    }
  }, []);

  const syncInputViewport = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      if (document.activeElement === el) {
        const len = el.value.length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          // Some browsers may not support setSelectionRange on textarea; ignore.
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Focus on open can race with portal mount/layout; retry over the next frames.
    focusInputToEnd();
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      focusInputToEnd();
      raf2 = requestAnimationFrame(() => focusInputToEnd());
    });
    const timer = window.setTimeout(() => focusInputToEnd(), 120);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);
      window.clearTimeout(timer);
    };
  }, [open, focusInputToEnd]);

  useEffect(() => {
    if (!open || loading) return;
    // Keep typing flow uninterrupted after assistant replies.
    const raf = requestAnimationFrame(() => focusInputToEnd());
    return () => cancelAnimationFrame(raf);
  }, [open, loading, messages.length, focusInputToEnd]);

  useEffect(() => {
    if (!recording) return;
    syncInputViewport();
  }, [inputValue, recording, syncInputViewport]);

  const stopAssistantPlayback = useCallback(() => {
    playbackIdRef.current += 1;
    assistantSpeechMetaRef.current = { messageId: null };
    assistantAudioMetaRef.current = { messageId: null, voiceUri: null };
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    const audio = assistantAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaybackStatus("idle");
  }, []);

  const lockPanelHeight = useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelLockedHeight(rect.height);
  }, []);

  useEffect(() => {
    if (unlockPanelHeightRafRef.current != null) {
      cancelAnimationFrame(unlockPanelHeightRafRef.current);
      unlockPanelHeightRafRef.current = null;
    }
    if (!open) {
      setPanelLockedHeight(null);
      return;
    }
    if (loading || panelLockedHeight == null) return;
    // Hold lock for one extra paint cycle to avoid a single-frame resize pop.
    unlockPanelHeightRafRef.current = requestAnimationFrame(() => {
      unlockPanelHeightRafRef.current = requestAnimationFrame(() => {
        setPanelLockedHeight(null);
        unlockPanelHeightRafRef.current = null;
      });
    });
    return () => {
      if (unlockPanelHeightRafRef.current != null) {
        cancelAnimationFrame(unlockPanelHeightRafRef.current);
        unlockPanelHeightRafRef.current = null;
      }
    };
  }, [open, loading, panelLockedHeight]);

  useEffect(() => {
    return () => {
      if (unlockPanelHeightRafRef.current != null) {
        cancelAnimationFrame(unlockPanelHeightRafRef.current);
        unlockPanelHeightRafRef.current = null;
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      stopAssistantPlayback();
      if (assistantAudioRef.current) {
        if (assistantAudioRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(assistantAudioRef.current.src);
        }
        assistantAudioRef.current.src = "";
      }
    }
  }, [stopAssistantPlayback]);

  useEffect(() => {
    setPosition(loadStoredPosition());
  }, []);

  const isOffScreen = useCallback((pos: DragPosition) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 0;
    const h = typeof window !== "undefined" ? window.innerHeight : 0;
    return (
      pos.x + TRIGGER_SIZE < HIDE_OFF_SCREEN_THRESHOLD ||
      pos.x > w - HIDE_OFF_SCREEN_THRESHOLD ||
      pos.y + TRIGGER_SIZE < HIDE_OFF_SCREEN_THRESHOLD ||
      pos.y > h - HIDE_OFF_SCREEN_THRESHOLD
    );
  }, []);

  useEffect(() => {
    const pos = position ?? loadStoredPosition();
    if (pos && !isOffScreen(pos)) lastInViewportPositionRef.current = pos;
  }, [position, isOffScreen]);

  const lastPositionRef = useRef<DragPosition | null>(null);

  const clampWithTriggerSize = useCallback((pos: DragPosition): DragPosition => {
    const trigger = triggerRef.current;
    const size = trigger
      ? {
          width: Math.max(1, trigger.offsetWidth),
          height: Math.max(1, trigger.offsetHeight),
        }
      : getFallbackTriggerSize();
    return clampPositionToViewport(pos, size);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPosition((current) => {
        if (!current) return current;
        const clamped = clampWithTriggerSize(current);
        if (clamped.x === current.x && clamped.y === current.y) return current;
        storePosition(clamped);
        return clamped;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampWithTriggerSize]);

  /* When open with explicit position: open below if not enough room above; nudge panel so it stays visible; never overlap Bulby. */
  useEffect(() => {
    if (!open || position == null) {
      setPanelOffset({ x: 0, y: 0 });
      setPanelOpensBelow(false);
      panelPlacementLockedRef.current = false;
      return;
    }
    if (panelPlacementLockedRef.current) return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (rect.top < VIEWPORT_MARGIN && !panelOpensBelow) {
      setPanelOpensBelow(true);
      setPanelOffset({ x: 0, y: 0 });
      return;
    }

    let x = 0;
    let y = 0;
    if (rect.left < VIEWPORT_MARGIN) x = VIEWPORT_MARGIN - rect.left;
    else if (rect.right > w - VIEWPORT_MARGIN) x = w - VIEWPORT_MARGIN - rect.right;
    if (rect.top < VIEWPORT_MARGIN) y = VIEWPORT_MARGIN - rect.top;
    else if (rect.bottom > h - VIEWPORT_MARGIN) y = h - VIEWPORT_MARGIN - rect.bottom;
    if (panelOpensBelow && y < 0) y = 0;
    else if (!panelOpensBelow && y > 0) y = 0;
    setPanelOffset({ x, y });
    panelPlacementLockedRef.current = true;
  }, [open, position, panelOpensBelow]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    const state = dragRef.current;
    if (!state) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    if (!state.moved && (Math.abs(clientX - state.startX) > DRAG_THRESHOLD_PX || Math.abs(clientY - state.startY) > DRAG_THRESHOLD_PX)) {
      state.moved = true;
      justDraggedRef.current = true;
      if (openRef.current) {
        setOpen(false);
        reopenOnDragEndRef.current = true;
      }
    }
    if (!state.moved) return;
    if ("touches" in e) e.preventDefault();
    const x = clientX - state.offsetX;
    const y = clientY - state.offsetY;
    const next = clampWithTriggerSize({ x, y });
    lastPositionRef.current = next;
    setPosition(next);
  }, [clampWithTriggerSize]);

  const handleDragEnd = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    const raw = lastPositionRef.current ?? position;
    if (!state?.moved || !raw) return;
    const toStore = clampWithTriggerSize(raw);
    lastInViewportPositionRef.current = toStore;
    setPosition(toStore);
    storePosition(toStore);
  }, [position, clampWithTriggerSize]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const box = chatboxRef.current?.getBoundingClientRect();
      if (!box) return;
      const currentX = position?.x ?? window.innerWidth - box.width - 20;
      const currentY = position?.y ?? window.innerHeight - box.height - 20;
      dragRef.current = {
        startX: clientX,
        startY: clientY,
        offsetX: clientX - currentX,
        offsetY: clientY - currentY,
        moved: false,
      };
      const onMove = (ev: MouseEvent | TouchEvent) => handleDragMove(ev);
      const endOpts = { capture: true };

      const removeListeners = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onMouseEnd);
        window.removeEventListener("touchmove", onMove, endOpts);
        window.removeEventListener("touchend", onTouchEnd, endOpts);
      };

      const onMouseEnd = () => {
        removeListeners();
        handleDragEnd();
        if (reopenOnDragEndRef.current) {
          reopenOnDragEndRef.current = false;
          setOpen(true);
        }
      };

      const onTouchEnd = () => {
        const state = dragRef.current;
        removeListeners();
        handleDragEnd();
        if (reopenOnDragEndRef.current) {
          reopenOnDragEndRef.current = false;
          setOpen(true);
        } else if (state && !state.moved) {
          setOpen((o) => !o);
          tapHandledInTouchendRef.current = true;
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onMouseEnd);
      window.addEventListener("touchmove", onMove, { capture: true, passive: false });
      window.addEventListener("touchend", onTouchEnd, endOpts);
    },
    [position, handleDragMove, handleDragEnd]
  );

  const handleTriggerClick = useCallback(() => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (tapHandledInTouchendRef.current) {
      tapHandledInTouchendRef.current = false;
      return;
    }
    setOpen((o) => !o);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      handleDragStart(e);
    },
    [handleDragStart]
  );

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: createMessageId(), role: "assistant", text },
    ]);
  }, []);

  const getLatestAssistantMessage = useCallback(
    () =>
      [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.text.trim()),
    [messages]
  );

  const pauseAssistantPlayback = useCallback(() => {
    if (assistantAudioRef.current && !assistantAudioRef.current.paused) {
      assistantAudioRef.current.pause();
      setPlaybackStatus("paused");
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      if (
        assistantSpeechMetaRef.current.messageId &&
        synth.speaking &&
        !synth.paused
      ) {
        synth.pause();
        setPlaybackStatus("paused");
      }
    }
  }, []);

  const playAssistantMessage = useCallback(
    async (message: { id: string; text: string }, opts?: { restart?: boolean }) => {
      if (typeof window === "undefined") return;
      const currentPlaybackId = ++playbackIdRef.current;
      const restart = opts?.restart ?? false;
      const speechText = formatTextForSpeech(message.text);
      const playBrowserSpeech = async () => {
        if (!("speechSynthesis" in window)) {
          throw new Error("Speech synthesis is not available in this browser.");
        }
        const synth = window.speechSynthesis;
        const sameSpeechMessage = assistantSpeechMetaRef.current.messageId === message.id;
        if (sameSpeechMessage && synth.speaking && synth.paused && !restart) {
          synth.resume();
          setPlaybackStatus("playing");
          return;
        }
        synth.cancel();
        const browserVoiceUri = selectedVoiceUri.startsWith("browser:")
          ? selectedVoiceUri.replace(/^browser:/, "")
          : selectedVoiceUri;
        const selectedVoice = synth
          .getVoices()
          .find((voice) => voice.voiceURI === browserVoiceUri);
        const speechChunks = splitTextForSpeech(speechText);
        if (speechChunks.length === 0) {
          setPlaybackStatus("idle");
          return;
        }

        assistantSpeechMetaRef.current = { messageId: message.id };
        let remainingChunks = speechChunks.length;
        let failed = false;
        for (const chunk of speechChunks) {
          const utterance = new SpeechSynthesisUtterance(chunk);
          if (selectedVoice) utterance.voice = selectedVoice;
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.onend = () => {
            if (
              currentPlaybackId !== playbackIdRef.current ||
              assistantSpeechMetaRef.current.messageId !== message.id
            ) {
              return;
            }
            remainingChunks -= 1;
            if (remainingChunks === 0 && !failed) {
              setPlaybackStatus("idle");
            }
          };
          utterance.onerror = () => {
            if (
              currentPlaybackId !== playbackIdRef.current ||
              assistantSpeechMetaRef.current.messageId !== message.id
            ) {
              return;
            }
            failed = true;
            setPlaybackStatus("idle");
          };
          synth.speak(utterance);
        }
        setPlaybackStatus("playing");
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (!synth.speaking && !synth.pending) {
          throw new Error("Browser speech did not start");
        }
      };

      if (assistantAudioRef.current) {
        assistantAudioRef.current.pause();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }

      if (selectedVoiceUri.startsWith("elevenlabs:")) {
        const voiceId = selectedVoiceUri.replace(/^elevenlabs:/, "").trim();
        if (!assistantAudioRef.current) {
          assistantAudioRef.current = new Audio();
        }
        const audio = assistantAudioRef.current;
        audio.preload = "auto";
        audio.volume = 1;
        audio.onplay = () => setPlaybackStatus("playing");
        audio.onpause = () => {
          if (!audio.ended) setPlaybackStatus("paused");
        };
        audio.onended = () => setPlaybackStatus("idle");
        audio.onerror = () => setPlaybackStatus("idle");

        try {
          const canReuseSource =
            assistantAudioMetaRef.current.messageId === message.id &&
            assistantAudioMetaRef.current.voiceUri === selectedVoiceUri &&
            Boolean(audio.src);
          if (!canReuseSource) {
            const blob = await synthesizeIdeaChatSpeech(
              speechText,
              voiceId || undefined
            );

            if (currentPlaybackId !== playbackIdRef.current) return;

            const previousSrc = audio.src;
            const nextUrl = URL.createObjectURL(blob);
            audio.pause();
            audio.src = nextUrl;
            if (previousSrc?.startsWith("blob:")) {
              URL.revokeObjectURL(previousSrc);
            }
            assistantAudioMetaRef.current = {
              messageId: message.id,
              voiceUri: selectedVoiceUri,
            };
          }
          if (restart) audio.currentTime = 0;
          await audio.play();

          if (currentPlaybackId !== playbackIdRef.current) {
            audio.pause();
            return;
          }

          setPlaybackStatus("playing");
          return;
        } catch {
          assistantAudioMetaRef.current = { messageId: null, voiceUri: null };
        }
      }

      if (currentPlaybackId !== playbackIdRef.current) return;
      await playBrowserSpeech();
    },
    [selectedVoiceUri]
  );

  const resumeAssistantPlayback = useCallback(
    async (message: { id: string; text: string }) => {
      if (assistantAudioRef.current && assistantAudioMetaRef.current.messageId === message.id) {
        await assistantAudioRef.current.play();
        setPlaybackStatus("playing");
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        if (
          assistantSpeechMetaRef.current.messageId === message.id &&
          synth.speaking &&
          synth.paused
        ) {
          synth.resume();
          setPlaybackStatus("playing");
          return;
        }
      }
      await playAssistantMessage(message);
    },
    [playAssistantMessage]
  );

  const handleVoiceReplyControl = useCallback(async () => {
    const latestAssistant = getLatestAssistantMessage();
    if (!latestAssistant) {
      appendAssistantMessage("No assistant response to play yet.");
      return;
    }
    setVoiceRepliesEnabled(true);
    try {
      if (playbackStatus === "playing") {
        pauseAssistantPlayback();
        return;
      }
      if (playbackStatus === "paused") {
        await resumeAssistantPlayback(latestAssistant);
        return;
      }
      await playAssistantMessage(latestAssistant, { restart: true });
    } catch {
      appendAssistantMessage(
        "Voice playback failed. Check browser sound and try a different voice."
      );
      setPlaybackStatus("idle");
    }
  }, [
    appendAssistantMessage,
    getLatestAssistantMessage,
    pauseAssistantPlayback,
    playbackStatus,
    playAssistantMessage,
    resumeAssistantPlayback,
  ]);

  const handleCloseChat = useCallback(() => {
    stopAssistantPlayback();
    setMessages([]);
    setInputValue("");
    setOpen(false);
  }, [stopAssistantPlayback]);

  const sendMessage = useCallback(async (draftOverride?: string) => {
    const draft = normalizeDraftForDisplayAndRouting(draftOverride ?? inputValue);
    if (!draft || loading || !projectId) return;
    let overrideWeatherContext = "";

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text: draft,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    const switchProjectPhrase = parseSwitchProjectIntent(draft);
    if (switchProjectPhrase) {
      const matched = matchProjectByName(projects, switchProjectPhrase);
      if (matched.kind === "match") {
        if (matched.project.id === projectId) {
          appendAssistantMessage(`You're already in the ${matched.project.name} project.`);
        } else if (onSwitchProject) {
          onSwitchProject(matched.project.id);
          appendAssistantMessage(`Switched to the ${matched.project.name} project.`);
        } else {
          appendAssistantMessage("Project switching is unavailable right now.");
        }
      } else if (matched.kind === "ambiguous") {
        appendAssistantMessage(
          `I found multiple matches: ${matched.names.slice(0, 5).join(", ")}. Tell me the exact project name.`
        );
      } else {
        const available = projects.slice(0, 6).map((p) => p.name).join(", ");
        appendAssistantMessage(
          available
            ? `I couldn't find "${switchProjectPhrase}". Available projects: ${available}.`
            : `I couldn't find "${switchProjectPhrase}" because no projects are available yet.`
        );
      }
      return;
    }

    const addIntent = parseAddToListIntent(draft);
    if (addIntent) {
      lockPanelHeight();
      setLoading(true);
      try {
        await createItemForListIntent(addIntent, projectId);
        invalidateListForIntent(addIntent.target, projectId);
        appendAssistantMessage(
          `Added "${addIntent.name}" to your ${getListPhrase(addIntent.target)}. Check the ${getListTabLabel(addIntent.target)} tab to see it.`
        );
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : `Couldn't add that to your ${getListPhrase(addIntent.target)}. Try again.`
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const locationIntent = extractSetLocationIntent(draft);
    if (locationIntent) {
      saveBulbyLocation(locationIntent);
      appendAssistantMessage(`Got it! I've saved your location as "${locationIntent}". I'll use this for weather queries from now on.`);
      return;
    }

    const rememberNote = extractRememberNote(draft);
    if (rememberNote) {
      await saveBulbyMemoryNote(rememberNote);
      appendAssistantMessage(`Saved to memory: "${rememberNote}"`);
      return;
    }

    if (isWeatherQuery(draft)) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Checking Google Weather API...");
      try {
        const namedLocation = extractWeatherLocation(draft);
        const savedLocation = getSavedBulbyLocation();
        let weather;
        if (namedLocation) {
          weather = await fetchCurrentWeather({ location: namedLocation });
        } else if (savedLocation) {
          weather = await fetchCurrentWeather({ location: savedLocation });
        } else {
          const { latitude, longitude } = await getBrowserPosition();
          weather = await fetchCurrentWeather({ latitude, longitude });
        }
        overrideWeatherContext = `\n\n=== GOOGLE WEATHER API DATA ===\nAPI Provided Location: ${weather.locationLabel} (Lat: ${weather.latitude}, Lon: ${weather.longitude})\nTemperature: ${weather.temperatureF}°F\nFeels Like: ${weather.apparentTemperatureF}°F\nCondition: ${weather.condition}\nWind: ${weather.windMph} mph\nPrecipitation: ${weather.precipitationIn} in\nIs Day: ${weather.isDay ? "Yes" : "No"}\n\nCRITICAL RULES:\n1. Never make up the weather.\n2. Never lie about the weather.\n3. Never lie about the location.\n4. You must tell the user the weather for where they are using the exact data above if they ask about their area.\n5. Answer based entirely on the API Provided Location above. Do not fallback to search unless the API data is explicitly mismatched.\n================================\n`;
      } catch (err) {
        overrideWeatherContext = `\n\n=== GOOGLE WEATHER API ===\nUser's current location is unavailable. Remind them to allow location access if they ask about their area.\nCRITICAL RULES:\n1. Never make up the weather.\n2. Never lie about the weather.\n3. Never lie about the location.\n4. If they ask for a named location, use your web search results.\n==========================\n`;
      } finally {
        setLoading(false);
      }
    }

    const expenseQuery = tryParseExpenseQuery(draft);
    if (expenseQuery) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Looking up your expenses...");
      try {
        const expenses = await fetchExpenses(projectId);
        const summary = summarizeExpensesForDate(expenses, expenseQuery);
        appendAssistantMessage(summary);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't look up your expenses right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isExpenseOverviewQuery(draft)) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Looking up your expenses...");
      try {
        const expenses = await fetchExpenses(projectId);
        const summary = summarizeExpensesOverview(expenses);
        appendAssistantMessage(summary);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't look up your expenses right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isLatestExpenseQuery(draft)) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Looking up your expenses...");
      try {
        const expenses = await fetchExpenses(projectId);
        const summary = summarizeLatestExpense(expenses);
        appendAssistantMessage(summary);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't look up your expenses right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (pendingCalendarCreate) {
      const followUpIntent = tryParseCalendarCreateFollowUp(
        draft,
        pendingCalendarCreate.title
      );
      if (!followUpIntent) {
        appendAssistantMessage(
          `I still need the time for "${pendingCalendarCreate.title}". For example: "11:59 p.m. today".`
        );
        return;
      }
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Adding to your calendar...");
      try {
        const created = await createCalendarEvent(projectId, followUpIntent);
        setPendingCalendarCreate(null);
        notifyCalendarEventsChanged(projectId);
        await logBulbyRule({
          kind: "action",
          title: "Calendar Event Created",
          detail: `Created "${created.title}" for project ${projectId}.`,
        });
        appendAssistantMessage(formatCalendarCreateSuccess(created));
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't add that to your calendar right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const calendarCreateIntent = tryParseCalendarCreateIntent(draft);
    if (calendarCreateIntent) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Adding to your calendar...");
      try {
        const created = await createCalendarEvent(projectId, calendarCreateIntent);
        setPendingCalendarCreate(null);
        notifyCalendarEventsChanged(projectId);
        await logBulbyRule({
          kind: "action",
          title: "Calendar Event Created",
          detail: `Created "${created.title}" for project ${projectId}.`,
        });
        appendAssistantMessage(formatCalendarCreateSuccess(created));
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't add that to your calendar right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const calendarCreateRequest = tryParseCalendarCreateRequest(draft);
    if (calendarCreateRequest) {
      setPendingCalendarCreate({ title: calendarCreateRequest.title });
      await logBulbyRule({
        kind: "rule",
        title: "Calendar Create Requires Time",
        detail: `Asked for missing time before creating "${calendarCreateRequest.title}".`,
      });
      appendAssistantMessage(
        `Please specify the time you would like to add "${calendarCreateRequest.title}" to your calendar.`
      );
      return;
    }

    const calendarEditIntent = tryParseCalendarEditIntent(draft);
    if (calendarEditIntent) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Updating your calendar...");
      try {
        const range = calendarEditIntent.dayQuery
          ? getCalendarDayRange(calendarEditIntent.dayQuery)
          : getCalendarContextRange();
        const events = await fetchCalendarEvents(projectId, range.start, range.end);
        const matches = findMatchingCalendarEvents(events, calendarEditIntent.searchText);
        if (matches.length === 0) {
          appendAssistantMessage("I couldn't find that calendar event to update.");
          return;
        }
        if (matches.length > 1) {
          appendAssistantMessage("I found multiple matching calendar events. Please be more specific.");
          return;
        }
        const match = matches[0];
        const updated = await updateCalendarEvent(projectId, match.id, {
          title: calendarEditIntent.newTitle,
        });
        notifyCalendarEventsChanged(projectId);
        await logBulbyRule({
          kind: "action",
          title: "Calendar Event Updated",
          detail: `Renamed "${match.title}" to "${updated.title}" for project ${projectId}.`,
        });
        appendAssistantMessage(formatCalendarEditSuccess(updated));
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't update that calendar event right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const calendarDeleteIntent = tryParseCalendarDeleteIntent(draft);
    if (calendarDeleteIntent) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Deleting from your calendar...");
      try {
        const range = calendarDeleteIntent.dayQuery
          ? getCalendarDayRange(calendarDeleteIntent.dayQuery)
          : getCalendarContextRange();
        const events = await fetchCalendarEvents(projectId, range.start, range.end);
        const matches = findMatchingCalendarEvents(events, calendarDeleteIntent.searchText);
        if (matches.length === 0) {
          appendAssistantMessage("I couldn't find that calendar event to delete.");
          return;
        }
        await Promise.all(
          matches.map((event) => deleteCalendarEvent(projectId, event.id))
        );
        notifyCalendarEventsChanged(projectId);
        await logBulbyRule({
          kind: "action",
          title: "Calendar Event Deleted",
          detail: `Deleted ${matches.length} matching calendar event(s) for project ${projectId}.`,
        });
        appendAssistantMessage(formatCalendarDeleteSuccess(matches.length));
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't delete that calendar event right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isCalendarMutationRequest(draft)) {
      await logBulbyRule({
        kind: "rule",
        title: "Truthfulness Rule Applied",
        detail: `Refused unsupported calendar mutation: "${draft}".`,
      });
      appendAssistantMessage(
        "I couldn't complete that calendar action. I can only confirm it after the calendar API succeeds."
      );
      return;
    }

    const calendarQuery = tryParseCalendarDayQuery(draft);
    if (calendarQuery) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Checking your calendar...");
      try {
        const { start, end, dayStart, dayEnd } = getCalendarDayRange(calendarQuery);
        const events = await fetchCalendarEvents(projectId, start, end);
        const summary = summarizeCalendarEventsForDay(
          events,
          calendarQuery,
          dayStart,
          dayEnd
        );
        appendAssistantMessage(summary);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't look up your calendar right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const calendarEventLookup = tryParseCalendarEventLookupQuery(draft);
    if (calendarEventLookup) {
      lockPanelHeight();
      setLoading(true);
      setLoadingStatus("Searching your calendar...");
      try {
        const { start, end } = getCalendarContextRange();
        const events = await fetchCalendarEvents(projectId, start, end);
        const summary = summarizeMatchingCalendarEvents(events, calendarEventLookup);
        appendAssistantMessage(summary);
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "I couldn't search your calendar right now. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isLikelyAppMutationRequest(draft)) {
      await logBulbyRule({
        kind: "rule",
        title: "Truthfulness Rule Applied",
        detail: `Refused unsupported app mutation: "${draft}".`,
      });
      appendAssistantMessage(
        "I couldn't complete that action here. I will only confirm app changes after the API succeeds."
      );
      return;
    }

    const prior = [...messages, userMessage];
    const conversationContext = buildIdeaChatContext(prior, draft);
    const [appContext, calendarContext] = await Promise.all([
      buildAppContextBlock(projectId),
      isCalendarQuestion(draft) ? buildCalendarContextBlock(projectId) : Promise.resolve(""),
    ]);
    const intelligenceContext = await buildBulbyIntelligenceContext();
    const appWithCalendarContext = combineAssistantContext(appContext, calendarContext);
    const baseContext = combineAssistantContext(
      appWithCalendarContext,
      conversationContext
    );
    const context = combineAssistantContext(baseContext, intelligenceContext) + overrideWeatherContext;
    const includeWeb = shouldUseWebSearch(draft);
    const model = getStoredOpenRouterModel() ?? undefined;

    lockPanelHeight();
    setLoading(true);
    setLoadingStatus("Thinking...");

    try {
      const result = await generateListItemAssistantChat(
        projectId,
        BULBY_ITEM_NAME,
        context,
        model ?? undefined,
        includeWeb
      ) as { message?: string; tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number } | null };
      appendAssistantMessage(
        typeof result.message === "string" ? result.message : "Done."
      );
    } catch (err) {
      appendAssistantMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  }, [inputValue, loading, messages, projectId, projects, onSwitchProject, appendAssistantMessage]);

  const toggleVoiceRecording = useCallback(async () => {
    if (speechRecognitionRef.current && recording) {
      speechRecognitionRef.current.stop();
      return;
    }

    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition
        : null;
    if (!SpeechRecognitionCtor) {
      appendAssistantMessage("Voice input is not supported in this browser.");
      return;
    }

    let finalTranscript = "";
    const recognition = new SpeechRecognitionCtor();
    speechRecognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    setRecording(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? "";
        if (event.results[i].isFinal) finalTranscript += piece;
        transcript += piece;
      }
      const merged = (finalTranscript || transcript).trim();
      setInputValue(merged);
      syncInputViewport();
    };

    recognition.onerror = (event: any) => {
      appendAssistantMessage(
        `Voice input error: ${String(event?.error ?? "unknown error")}`
      );
    };

    recognition.onend = () => {
      setRecording(false);
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
      }
      const transcript = finalTranscript.trim();
      if (transcript) {
        void sendMessage(transcript);
      }
    };

    try {
      recognition.start();
    } catch {
      setRecording(false);
      appendAssistantMessage(
        "Could not start voice input. Please allow microphone access."
      );
    }
  }, [appendAssistantMessage, recording, sendMessage, syncInputViewport]);

  useEffect(() => {
    if (!voiceRepliesEnabled || loading) return;
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.text.trim());
    if (!latestAssistant) return;
    if (spokenMessageIdRef.current === latestAssistant.id) return;
    if (playbackStatus !== "idle") return;
    spokenMessageIdRef.current = latestAssistant.id;
    void playAssistantMessage(latestAssistant, { restart: true });
  }, [messages, loading, playbackStatus, playAssistantMessage, voiceRepliesEnabled]);

  if (!projectId) return null;

  if (triggerHidden) {
    if (typeof document !== "undefined") return createPortal(null, document.body);
    return null;
  }

  const voiceButtonLabel =
    playbackStatus === "playing"
      ? "Pause voice reply"
      : playbackStatus === "paused"
        ? "Resume voice reply"
        : "Play voice reply";
  const isPlaybackActive = playbackStatus !== "idle";

  const content = (
    <div
      ref={chatboxRef}
      className="bulby-chatbox"
      style={
        position != null
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : undefined
      }
    >
      {open && (
        <div
          ref={panelRef}
          className="bulby-chatbox-panel idea-plan-card"
          style={{
            ...(position != null
              ? {
                  position: "absolute",
                  left: "50%",
                  ...(panelOpensBelow
                    ? { top: "100%", marginTop: BULBY_CHATBOX_GAP }
                    : { bottom: "100%", marginBottom: BULBY_CHATBOX_GAP }),
                  transform: `translate(calc(-50% + ${panelOffset.x}px), ${panelOffset.y}px)`,
                }
              : {}),
            ...(loading && panelLockedHeight != null
              ? {
                  height: `${panelLockedHeight}px`,
                  minHeight: `${panelLockedHeight}px`,
                  maxHeight: `${panelLockedHeight}px`,
                }
              : {}),
          }}
        >
          <div className="idea-plan-card-head">
            <span className="idea-plan-card-badge">Ask Bulby</span>
            <CloseButton
              className="bulby-chatbox-close"
              size="sm"
              onClick={handleCloseChat}
              aria-label="Close Chat"
              title="Close Chat"
            />
          </div>
          <div className="idea-chat-thread" ref={threadRef}>
            {messages.length === 0 && !loading && (
              <div className="idea-chat-message idea-chat-message--assistant">
                <p className="idea-plan-summary">
                  Hi! I&apos;m Bulby. Ask me anything about your project, ideas,
                  or how to use Idea Home.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`idea-chat-message idea-chat-message--${msg.role}`}
              >
                {msg.text.split(/\r?\n/).map((line, index) => (
                  <p
                    key={`${msg.id}-${index}`}
                    className="idea-plan-summary"
                  >
                    {line}
                  </p>
                ))}
              </div>
            ))}
            {loading && (
              <div className="idea-chat-message idea-chat-message--assistant">
                <p className="idea-plan-summary">{loadingStatus}</p>
              </div>
            )}
          </div>
          <div className="idea-chat-input-row">
            <textarea
              ref={inputRef}
              className="idea-chat-input"
              value={inputValue}
              spellCheck
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={messages.length > 0 ? "Ask Bulby a follow-up..." : "Ask Bulby anything..."}
              rows={1}
              aria-label="Ask Bulby"
            />
            <button
              type="button"
              className={`idea-chat-voice-btn${recording ? " is-recording" : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void toggleVoiceRecording();
              }}
              disabled={loading}
              aria-label={recording ? "Stop recording" : "Record voice message"}
              title={recording ? "Stop recording" : "Record voice message"}
            >
              {recording ? <IconStop size={14} /> : <IconMic size={14} />}
            </button>
            <button
              type="button"
              className={`idea-chat-voice-btn${isPlaybackActive || voiceRepliesEnabled ? " is-active" : ""}`}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleVoiceReplyControl();
              }}
              aria-label={voiceButtonLabel}
              title={voiceButtonLabel}
            >
              {playbackStatus === "playing" ? (
                <IconStop size={12} />
              ) : (
                <IconPlay size={12} />
              )}
            </button>
            <button
              type="button"
              className="idea-chat-send-btn"
              onClick={() => void sendMessage()}
              disabled={loading || !inputValue.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        className={`bulby-chatbox-trigger bulby-chatbox-trigger--icon${open ? " bulby-chatbox-trigger--open" : ""}${loading && !open ? " is-thinking" : ""}`}
        onClick={handleTriggerClick}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        aria-label={open ? "Minimize Bulby chat" : "Open Bulby chat"}
        title={open ? "Minimize chat" : "Ask Bulby — drag to move"}
      >
        <BulbyCharacter />
      </button>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}
