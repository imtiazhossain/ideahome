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
