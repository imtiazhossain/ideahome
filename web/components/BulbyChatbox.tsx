"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BulbyCharacter } from "./BulbyCharacter";
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

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

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
    <div className="bulby-chatbox">
      {open && (
        <div className="bulby-chatbox-panel idea-plan-card">
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
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Minimize Bulby chat" : "Open Bulby chat"}
        title={open ? "Minimize chat" : "Ask Bulby anything"}
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
