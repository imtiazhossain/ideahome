/**
 * Shared types used by both web and native app.
 */

export type AuthProvider = "google";

export type AppTab =
  | "board"
  | "home"
  | "projects"
  | "issues"
  | "expenses"
  | "features"
  | "todos"
  | "ideas"
  | "bugs"
  | "enhancements"
  | "tests"
  | "timeline"
  | "calendar"
  | "goals"
  | "development"
  | "pages"
  | "settings"
  | `custom-${string}`;

export type ChecklistKind = "features" | "todos" | "ideas" | "bugs" | "enhancements";

export type PendingCommentAttachment = {
  id: string;
  type: "screenshot" | "video";
  base64: string;
};

export type TestExecutionResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
};

export type AssistantChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type PromptUsageSource =
  | "bulby-openrouter"
  | "gpt-openai"
  | "codex-estimated";

export type PromptUsageTrendMode = "project" | "mine";

export type PromptEfficiencyBreakdown = {
  brevity: number;
  outputEfficiency: number;
  redundancyPenalty: number;
  instructionDensity: number;
};

export type PromptUsageTrendPoint = {
  timestamp: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  promptCount: number;
};

export type PromptUsageDetailEntry = {
  id: string;
  timestamp: string;
  source: PromptUsageSource;
  promptText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptWordCount: number;
  efficiencyScore: number;
  improvementHints: string[];
  breakdown: PromptEfficiencyBreakdown;
};

export type PromptUsageTrendResponse = {
  mode: PromptUsageTrendMode;
  source: PromptUsageSource | "all";
  points: PromptUsageTrendPoint[];
};

export type PromptUsageMineResponse = {
  source: PromptUsageSource | "all";
  entries: PromptUsageDetailEntry[];
};
