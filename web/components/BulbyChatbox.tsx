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
  fetchTodos,
  fetchIdeas,
  fetchBugs,
  fetchFeatures,
  generateListItemAssistantChat,
  getStoredOpenRouterModel,
  createTodo,
  fetchExpenses,
} from "../lib/api";
import { invalidateList } from "../lib/listCache";
import {
  isExpenseOverviewQuery,
  summarizeExpensesForDate,
  summarizeExpensesOverview,
  tryParseExpenseQuery,
} from "../lib/assistantExpenses";

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

/** If the message asks to add something to the to-do list, return the item name; otherwise null. */
function parseAddToTodoIntent(message: string): string | null {
  const trimmed = message.trim();
  const quoted = /add\s+(?:"([^"]*)"|'([^']*)')\s+to\s+(?:my\s+)?(?:the\s+)?(?:to\s*[- ]?do\s*)?list/i.exec(
    trimmed
  );
  if (quoted) return (quoted[1] ?? quoted[2] ?? "").trim() || null;
  const unquoted = /add\s+(.+?)\s+to\s+(?:my\s+)?(?:the\s+)?(?:to\s*[- ]?do\s*)?list/i.exec(
    trimmed
  );
  if (unquoted) return unquoted[1].trim() || null;
  const short = /add\s+(?:"([^"]*)"|'([^']*)'|(.+?))\s+to\s+todo/i.exec(
    trimmed
  );
  if (short) return (short[1] ?? short[2] ?? short[3] ?? "").trim() || null;
  return null;
}

type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

function createMessageId(): string {
  return `bulby-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

export interface BulbyChatboxProps {
  /** Current project id; use first project as fallback when none selected. */
  projectId: string;
}

export function BulbyChatbox({ projectId }: BulbyChatboxProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking...");
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatboxRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<DragPosition | null>(null);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [panelOpensBelow, setPanelOpensBelow] = useState(false);
  const [triggerHidden, setTriggerHiddenState] = useState(false);

  useEffect(() => {
    setPosition(loadStoredPosition() ?? getDefaultPosition());
    setTriggerHiddenState(getTriggerHidden());
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

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    if (!el) return;
    // Focus the chat input when the panel opens so the user can start typing immediately.
    el.focus();
    // Move caret to the end of any existing text.
    const len = el.value.length;
    try {
      el.setSelectionRange(len, len);
    } catch {
      // Some browsers may not support setSelectionRange on textarea; ignore.
    }
  }, [open]);

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
      return;
    }
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
  }, [open, position, messages, panelOpensBelow]);

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

  const sendMessage = useCallback(async () => {
    const draft = inputValue.trim();
    if (!draft || loading || !projectId) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text: draft,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    const addToTodoName = parseAddToTodoIntent(draft);
    if (addToTodoName) {
      setLoading(true);
      try {
        await createTodo({
          projectId,
          name: addToTodoName,
          done: false,
        });
        invalidateList("todos", projectId);
        appendAssistantMessage(
          `Added "${addToTodoName}" to your to-do list. Check the To-Do tab to see it.`
        );
      } catch (err) {
        appendAssistantMessage(
          err instanceof Error
            ? err.message
            : "Couldn't add that to your to-do list. Try again."
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const expenseQuery = tryParseExpenseQuery(draft);
    if (expenseQuery) {
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

    const prior = [...messages, userMessage];
    const conversationContext = buildIdeaChatContext(prior, draft);
    const appContext = await buildAppContextBlock(projectId);
    const context = combineAssistantContext(appContext, conversationContext);
    const includeWeb = shouldUseWebSearch(draft);
    const model = getStoredOpenRouterModel() ?? undefined;

    setLoading(true);
    setLoadingStatus("Thinking...");
    const loadingTicker = setInterval(() => {
      setLoadingStatus((prev) => {
        const elapsed = prev.match(/\((\d+)s\)/)?.[1];
        const sec = elapsed ? parseInt(elapsed, 10) + 1 : 1;
        return `Thinking... (${sec}s)`;
      });
    }, 1000);

    try {
      const result = await generateListItemAssistantChat(
        projectId,
        BULBY_ITEM_NAME,
        context,
        model ?? undefined,
        includeWeb
      );
      appendAssistantMessage(
        typeof result.message === "string" ? result.message : "Done."
      );
    } catch (err) {
      appendAssistantMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      clearInterval(loadingTicker);
      setLoading(false);
    }
  }, [inputValue, loading, messages, projectId, appendAssistantMessage]);

  if (!projectId) return null;

  if (triggerHidden) {
    if (typeof document !== "undefined") return createPortal(null, document.body);
    return null;
  }

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
          style={
            position != null
              ? {
                  position: "absolute",
                  left: "50%",
                  ...(panelOpensBelow
                    ? { top: "100%", marginTop: BULBY_CHATBOX_GAP }
                    : { bottom: "100%", marginBottom: BULBY_CHATBOX_GAP }),
                  transform: `translate(calc(-50% + ${panelOffset.x}px), ${panelOffset.y}px)`,
                }
              : undefined
          }
        >
          <div className="idea-plan-card-head">
            <span className="idea-plan-card-badge">Ask Bulby</span>
            <CloseButton
              className="bulby-chatbox-close"
              size="sm"
              onClick={() => {
                setMessages([]);
                setInputValue("");
                setOpen(false);
              }}
              aria-label="Close chat"
              title="Close chat"
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
              placeholder="Ask Bulby anything..."
              rows={1}
              aria-label="Ask Bulby"
              disabled={loading}
            />
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
        className={`bulby-chatbox-trigger bulby-chatbox-trigger--icon${open ? " bulby-chatbox-trigger--open" : ""}${loading ? " is-thinking" : ""}`}
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
