"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BulbyCharacter } from "./BulbyCharacter";

const BULBY_POSITION_KEY = "bulby-chatbox-position";

/** When we have an explicit position, panel is absolutely positioned above the trigger so the container never grows (avoids open glitch). */
const BULBY_CHATBOX_GAP = 12;
/** Keep the chatbox panel within the viewport when Bulby is near an edge. */
const VIEWPORT_MARGIN = 24;

type DragPosition = { x: number; y: number };

function loadStoredPosition(): DragPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BULBY_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (typeof parsed.x === "number" && typeof parsed.y === "number") return parsed;
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
} from "../lib/api";
import { invalidateList } from "../lib/listCache";

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
  const chatboxRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<DragPosition | null>(loadStoredPosition);
  const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
  const [panelOpensBelow, setPanelOpensBelow] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const justDraggedRef = useRef(false);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    setPosition(loadStoredPosition());
  }, []);

  const lastPositionRef = useRef<DragPosition | null>(null);

  /* When open with explicit position: open below if not enough room above; nudge panel so it stays visible; never overlap Bulby. */
  useLayoutEffect(() => {
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
    if (!state.moved && (Math.abs(clientX - state.startX) > 4 || Math.abs(clientY - state.startY) > 4)) {
      state.moved = true;
      justDraggedRef.current = true;
    }
    if (!state.moved) return;
    if ("touches" in e) e.preventDefault();
    const box = chatboxRef.current?.getBoundingClientRect();
    const w = box?.width ?? 88;
    const h = box?.height ?? 120;
    const x = Math.max(0, Math.min(window.innerWidth - w, clientX - state.offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - h, clientY - state.offsetY));
    const next = { x, y };
    lastPositionRef.current = next;
    setPosition(next);
  }, []);

  const handleDragEnd = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    const toStore = lastPositionRef.current ?? position;
    if (state?.moved && toStore) {
      storePosition(toStore);
    }
  }, [position]);

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
      const onEnd = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
        window.removeEventListener("touchmove", onMove, endOpts);
        window.removeEventListener("touchend", onEnd, endOpts);
        handleDragEnd();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      window.addEventListener("touchmove", onMove, { capture: true, passive: false });
      window.addEventListener("touchend", onEnd, endOpts);
    },
    [position, handleDragMove, handleDragEnd]
  );

  const handleTriggerClick = useCallback(() => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
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
            <button
              type="button"
              className="bulby-chatbox-close"
              onClick={() => {
                setMessages([]);
                setInputValue("");
                setOpen(false);
              }}
              aria-label="Close chat"
              title="Close chat"
            >
              ×
            </button>
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
                <p className="idea-plan-summary">{msg.text}</p>
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
              className="idea-chat-input"
              value={inputValue}
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
