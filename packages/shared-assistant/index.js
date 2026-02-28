"use strict";

/** Token-optimized assistant context: one implementation for web and app. */

const MAX_SUMMARY_TURNS = 10;
const MAX_SUMMARY_CHARS = 150;
const MAX_ITEMS_PER_LIST = 30;
const MAX_ITEM_NAME_LENGTH = 80;

function normalizeTurnText(text) {
  return String(text).replace(/\s+/g, " ").trim();
}

function summarizeOlderTurns(turns) {
  return turns.slice(-MAX_SUMMARY_TURNS).map((turn) => {
    const normalized = normalizeTurnText(turn.text);
    const clipped =
      normalized.length > MAX_SUMMARY_CHARS
        ? normalized.slice(0, MAX_SUMMARY_CHARS - 1) + "\u2026"
        : normalized;
    const prefix = turn.role === "user" ? "User" : "Assistant";
    return "- " + prefix + ": " + clipped;
  });
}

/**
 * Build conversation context for the idea/list assistant. Token-optimized:
 * summarizes older turns, keeps last 2 full, appends latest request.
 * @param {Array<{ role: 'user' | 'assistant'; text: string }>} messages
 * @param {string} nextPrompt
 * @returns {string}
 */
function buildIdeaChatContext(messages, nextPrompt) {
  const latestPrompt = normalizeTurnText(nextPrompt);
  const normalized = (messages || [])
    .map((m) => ({ role: m.role, text: normalizeTurnText(m.text) }))
    .filter((m) => m.text);
  const recentTurns = normalized.slice(-2);
  const olderTurns = normalized.slice(0, -2);
  const summaryLines = summarizeOlderTurns(olderTurns);

  const summaryBlock =
    summaryLines.length > 0
      ? "Conversation summary (older turns):\n" + summaryLines.join("\n")
      : null;
  const recentBlock =
    recentTurns.length > 0
      ? "Recent turns:\n" +
        recentTurns
          .map(
            (t) =>
              (t.role === "user" ? "User" : "Assistant") + ": " + t.text
          )
          .join("\n")
      : null;

  return [
    "Continue the conversation and answer only the latest user request.",
    summaryBlock,
    recentBlock,
    "Latest user request: " + latestPrompt,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Whether the user message likely needs web search (fresh data).
 * @param {string} text
 * @returns {boolean}
 */
function shouldUseWebSearch(text) {
  const normalized = normalizeTurnText(text).toLowerCase();
  if (!normalized) return false;

  const hardSignals =
    /\b(weather|forecast|temperature|rain|snow|humidity|wind|time|date|year|news|headline|stock|price|exchange rate|score)\b/i;
  if (hardSignals.test(normalized)) return true;

  const freshnessSignals =
    /\b(latest|current|recent|right now|today|this week|this month|as of)\b/i;
  const questionSignals =
    /\?/.test(normalized) ||
    /^(what|when|where|who|which|how|is|are|do|does|did|can|could|should|will)\b/i.test(
      normalized
    );
  return freshnessSignals.test(normalized) && questionSignals;
}

/**
 * Format project lists as a compact context block for the assistant. Token-optimized:
 * caps items per list and name length. Use this with data you fetch (web or app).
 * @param {{ todos?: Array<{ name: string; done: boolean }>; ideas?: Array<{ name: string; done: boolean }>; bugs?: Array<{ name: string; done: boolean }>; features?: Array<{ name: string; done: boolean }> }} lists
 * @returns {string}
 */
function formatProjectListsAsContext(lists) {
  if (!lists || typeof lists !== "object") return "";

  const lines = [
    "The following are the user's actual project lists in Idea Home. Use this data to answer questions about their to-do list, ideas, bugs, or features. Do not say lists are empty if they are not.",
    "",
  ];

  function clip(name) {
    const s = String(name).trim();
    if (s.length <= MAX_ITEM_NAME_LENGTH) return s;
    return s.slice(0, MAX_ITEM_NAME_LENGTH - 1) + "\u2026";
  }

  function formatList(items, label) {
    const arr = Array.isArray(items) ? items.slice(0, MAX_ITEMS_PER_LIST) : [];
    if (arr.length === 0) {
      lines.push(label + ": (empty)");
    } else {
      lines.push(label + ":");
      arr.forEach((item) => {
        const status = item.done ? "[x] DONE" : "[ ]";
        lines.push("- " + status + " " + clip(item.name));
      });
    }
    lines.push("");
  }

  formatList(lists.todos || [], "To-do list");
  formatList(lists.ideas || [], "Ideas");
  formatList(lists.features || [], "Features");
  formatList(lists.bugs || [], "Bugs");

  return lines.join("\n").trim();
}

/**
 * Combine app list context with conversation context for the API. Use when you have
 * fetched lists and built conversation context (e.g. in Bulby or app chat).
 * @param {string} appContext - from formatProjectListsAsContext
 * @param {string} conversationContext - from buildIdeaChatContext
 * @returns {string}
 */
function combineAssistantContext(appContext, conversationContext) {
  if (!appContext || !appContext.trim()) return conversationContext || "";
  if (!conversationContext || !conversationContext.trim()) return appContext;
  return appContext.trim() + "\n\n---\n\n" + conversationContext.trim();
}

exports.buildIdeaChatContext = buildIdeaChatContext;
exports.shouldUseWebSearch = shouldUseWebSearch;
exports.formatProjectListsAsContext = formatProjectListsAsContext;
exports.combineAssistantContext = combineAssistantContext;
