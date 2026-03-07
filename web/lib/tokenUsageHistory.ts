/**
 * Shared token usage history store backed by localStorage.
 * Records per-prompt token usage from Bulby chat so the Code page
 * TokenUsageGraph can display real data.
 */

const STORAGE_KEY = "ideahome-token-usage-history";
const MAX_ENTRIES = 50;

export type TokenUsageEntry = {
  id: string;
  timestamp: number;
  promptText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

function loadEntries(): TokenUsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as TokenUsageEntry[]).filter(
      (e) =>
        typeof e.id === "string" &&
        typeof e.timestamp === "number" &&
        typeof e.promptTokens === "number"
    );
  } catch {
    return [];
  }
}

function saveEntries(entries: TokenUsageEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage full – ignore */
  }
}

export function recordTokenUsage(entry: Omit<TokenUsageEntry, "id" | "timestamp">): void {
  const entries = loadEntries();
  entries.push({
    ...entry,
    id: `tu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  });
  // Keep only the most recent entries
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
  saveEntries(entries);
  // Notify any listeners (the Code page graph)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ideahome-token-usage-updated"));
  }
}

export function getTokenUsageHistory(): TokenUsageEntry[] {
  return loadEntries();
}

export function clearTokenUsageHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("ideahome-token-usage-updated"));
}

/**
 * Generate a per-prompt efficiency suggestion based on the token counts.
 */
export function generatePromptSuggestion(entry: TokenUsageEntry): string {
  const { promptText, promptTokens, completionTokens } = entry;
  const ratio = completionTokens > 0 ? promptTokens / completionTokens : 0;
  const wordCount = promptText.trim().split(/\s+/).length;
  const suggestions: string[] = [];

  if (promptTokens > 300) {
    suggestions.push(
      "Your prompt used over 300 tokens. Try to be more concise — state the goal first, then only essential context."
    );
  }

  if (ratio > 3) {
    suggestions.push(
      "Your input tokens are 3×+ the output. You may be sending too much context. Reference files by name instead of pasting content."
    );
  }

  if (wordCount > 60) {
    suggestions.push(
      "Long prompt detected. Lead with the action verb (e.g. \"Fix\", \"Add\", \"Explain\") and trim background info."
    );
  }

  if (/please|could you|would you|can you/i.test(promptText)) {
    suggestions.push(
      "Skip politeness tokens — directly state what you need. \"Fix the login bug\" is better than \"Could you please fix the login bug?\"."
    );
  }

  if (promptTokens < 50 && completionTokens < 30) {
    suggestions.push(
      "Great efficiency! Short prompt, short response. Keep this pattern for simple queries."
    );
  }

  if (suggestions.length === 0) {
    if (promptTokens <= 150) {
      return "Good prompt efficiency. Your input token count is within an efficient range.";
    }
    return "Consider whether you can state the same request in fewer words to reduce input tokens.";
  }

  return suggestions[0];
}
