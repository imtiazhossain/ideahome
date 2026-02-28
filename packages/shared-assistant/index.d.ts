export type AssistantTurn = {
  role: "user" | "assistant";
  text: string;
};

/**
 * Build conversation context for the idea/list assistant. Token-optimized.
 */
export function buildIdeaChatContext(
  messages: AssistantTurn[],
  nextPrompt: string
): string;

/**
 * Whether the user message likely needs web search (fresh data).
 */
export function shouldUseWebSearch(text: string): boolean;

export type ProjectListItems = Array<{ name: string; done: boolean }>;

export type ProjectListsForContext = {
  todos?: ProjectListItems;
  ideas?: ProjectListItems;
  bugs?: ProjectListItems;
  features?: ProjectListItems;
};

/**
 * Format project lists as a compact context block. Token-optimized (caps items and name length).
 */
export function formatProjectListsAsContext(
  lists: ProjectListsForContext
): string;

/**
 * Combine app list context with conversation context for the API.
 */
export function combineAssistantContext(
  appContext: string,
  conversationContext: string
): string;
