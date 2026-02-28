export type AssistantTurn = {
  role: "user" | "assistant";
  text: string;
};

const MAX_SUMMARY_TURNS = 10;
const MAX_SUMMARY_CHARS = 150;

function normalizeTurnText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function summarizeOlderTurns(turns: AssistantTurn[]): string[] {
  return turns.slice(-MAX_SUMMARY_TURNS).map((turn) => {
    const normalized = normalizeTurnText(turn.text);
    const clipped =
      normalized.length > MAX_SUMMARY_CHARS
        ? `${normalized.slice(0, MAX_SUMMARY_CHARS - 1)}…`
        : normalized;
    const prefix = turn.role === "user" ? "User" : "Assistant";
    return `- ${prefix}: ${clipped}`;
  });
}

export function buildIdeaChatContext(
  messages: AssistantTurn[],
  nextPrompt: string
): string {
  const latestPrompt = normalizeTurnText(nextPrompt);
  const normalized = messages
    .map((message) => ({
      role: message.role,
      text: normalizeTurnText(message.text),
    }))
    .filter((message): message is AssistantTurn => Boolean(message.text));
  const recentTurns = normalized.slice(-2);
  const olderTurns = normalized.slice(0, -2);
  const summaryLines = summarizeOlderTurns(olderTurns);

  const summaryBlock =
    summaryLines.length > 0
      ? `Conversation summary (older turns):\n${summaryLines.join("\n")}`
      : null;
  const recentBlock =
    recentTurns.length > 0
      ? `Recent turns:\n${recentTurns
          .map(
            (turn) =>
              `${turn.role === "user" ? "User" : "Assistant"}: ${turn.text}`
          )
          .join("\n")}`
      : null;

  return [
    "Continue the conversation and answer only the latest user request.",
    summaryBlock,
    recentBlock,
    `Latest user request: ${latestPrompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function shouldUseWebSearch(text: string): boolean {
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
