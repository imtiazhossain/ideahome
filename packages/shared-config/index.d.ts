export type UITestSuite = {
  name: string;
  tests: string[];
};

export type UITestFile = {
  file: string;
  suites: UITestSuite[];
};

export type ApiTestSuite = {
  suite: string;
  tests: string[];
};

export type User = { id: string; email: string; name: string | null };
export type Project = { id: string; name: string; createdAt?: string };
export type Organization = { id: string; name: string };

export type IssueRecording = {
  id: string;
  videoUrl: string;
  mediaType?: "video" | "audio";
  recordingType?: "screen" | "camera" | "audio";
  name?: string | null;
  issueId: string;
  createdAt: string;
};

export type IssueScreenshot = {
  id: string;
  imageUrl: string;
  name?: string | null;
  issueId: string;
  createdAt: string;
};

export type IssueFile = {
  id: string;
  fileUrl: string;
  fileName: string;
  issueId: string;
  createdAt: string;
};

export type Expense = {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  projectId: string;
  source?: string; // "manual" | "plaid"
  createdAt: string;
};

export type CommentAttachmentType =
  | "screenshot"
  | "video"
  | "screen_recording"
  | "camera_recording"
  | "audio_recording";

export type CommentAttachment = {
  id: string;
  type: CommentAttachmentType;
  mediaUrl: string;
  commentId: string;
  createdAt: string;
};

export type IssueCommentEditHistoryEntry = {
  body: string;
  editedAt: string;
};

export type IssueComment = {
  id: string;
  body: string;
  issueId: string;
  createdAt: string;
  editHistory?: IssueCommentEditHistoryEntry[];
  attachments?: CommentAttachment[];
};

export type RunUiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
  steps?: Array<{ title: string; duration?: number }>;
  screenshotCount?: number;
  videoBase64?: string;
};

export type RunApiTestResult = {
  success: boolean;
  exitCode: number | null;
  output: string;
  errorOutput: string;
};

export type NativeBridgeAuthChangePayload = {
  type: typeof NATIVE_BRIDGE_AUTH_CHANGE;
  token: string;
};

export type NativeBridgeAuthErrorPayload = {
  type: typeof NATIVE_BRIDGE_AUTH_ERROR;
  error: string;
};

export declare const AUTH_TOKEN_KEY: string;
export declare const AUTH_TOKEN_SESSION_KEY: string;
export declare const AUTH_TOKEN_COOKIE_KEY: string;
export declare const API_REQUEST_HEADER: string;
export declare const AUTH_CHANGE_EVENT: string;
export declare const ASSISTANT_VOICE_CHANGE_EVENT: string;
export declare const MOBILE_TOKEN_STORAGE_KEY: string;
export declare const MOBILE_AUTH_BYPASS_STORAGE_KEY: string;
export declare const MOBILE_ACTIVE_TAB_STORAGE_KEY: string;
export declare const MOBILE_SELECTED_PROJECT_STORAGE_KEY: string;
export declare const JUST_LOGGED_IN_SESSION_KEY: string;
export declare const AUTH_PARAM_TOKEN: string;
export declare const AUTH_PARAM_ERROR: string;
export declare const AUTH_PARAM_REDIRECT_URI: string;
export declare const MOBILE_DEEP_LINK_REDIRECT_URI: string;
export declare const NATIVE_BRIDGE_AUTH_CHANGE: "auth-change";
export declare const NATIVE_BRIDGE_AUTH_ERROR: "auth-error";
export declare const EXPENSE_CATEGORIES: string[];
export declare const IDEAHOME_APP_ORIGIN: string;
export declare const IDEAHOME_API_ORIGIN: string;
export declare const IDEAHOME_WEB_ORIGIN: string;

export type ChecklistItem = {
  id: string;
  name: string;
  done: boolean;
  order: number;
  projectId: string;
  createdAt: string;
};

export type Issue = {
  id: string;
  key?: string | null;
  title: string;
  description: string | null;
  acceptanceCriteria?: string | null;
  database?: string | null;
  api?: string | null;
  testCases?: string | null;
  automatedTest?: string | null;
  status: string;
  qualityScore?: number | null;
  projectId: string;
  assigneeId?: string | null;
  assignee?: User | null;
  project?: Project;
  recordings?: IssueRecording[];
  screenshots?: IssueScreenshot[];
  files?: IssueFile[];
  createdAt: string;
};

export type CreateProjectInput = { name: string };
export type UpdateProjectInput = { name?: string };

export type CreateIssueInput = {
  title: string;
  projectId?: string;
  description?: string;
  acceptanceCriteria?: string;
  database?: string;
  api?: string;
  testCases?: string;
  automatedTest?: string;
  assigneeId?: string;
  qualityScore?: number;
};

export type UpdateIssueInput = Record<string, unknown>;
export type UpdateIssueStatusInput = { status: string };

export type CreateIssueCommentInput = { body: string };
export type UpdateIssueCommentInput = { body: string };
export type AddCommentAttachmentInput = {
  type: CommentAttachmentType;
  imageBase64?: string;
  videoBase64?: string;
};

export type CreateExpenseInput = {
  projectId: string;
  amount: number;
  description: string;
  date: string;
  category?: string;
};
export type UpdateExpenseInput = {
  amount?: number;
  description?: string;
  date?: string;
  category?: string;
};

export type RunUiTestInput = { grep: string };
export type RunApiTestInput = { testNamePattern: string };

export declare const UI_TESTS: UITestFile[];
export declare const API_TESTS: ApiTestSuite[];
export declare const ISSUE_STATUS_IDS: Array<"backlog" | "todo" | "in_progress" | "done">;
export declare const STATUS_OPTIONS: Array<{
  id: "backlog" | "todo" | "in_progress" | "done";
  label: string;
}>;

export declare function testNameToSlug(name: string): string;
export declare function readUrlParam(url: string, key: string): string;
export declare function sanitizeAuthToken(rawValue: string): string;
export declare function projectNameToAcronym(name: string): string;
export declare function pathProjects(): string;
export declare function pathProjectById(projectId: string): string;
export declare function pathOrganizations(): string;
export declare function pathOrganizationsEnsure(): string;
export declare function pathIssues(projectId?: string, search?: string): string;
export declare function pathIssueById(issueId: string): string;
export declare function pathIssueStatus(issueId: string): string;
export declare function pathIssuesBulk(projectId?: string): string;
export declare function pathIssueComments(issueId: string): string;
export declare function pathIssueCommentById(issueId: string, commentId: string): string;
export declare function pathCommentAttachments(issueId: string, commentId: string): string;
export declare function pathCommentAttachmentById(
  issueId: string,
  commentId: string,
  attachmentId: string
): string;
export declare function pathTestsRunUi(): string;
export declare function pathTestsRunApi(): string;
export declare function pathUsers(): string;
export declare function pathExpenses(projectId?: string): string;
export declare function pathExpenseById(expenseId: string): string;
export declare function pathExpensesDeleteImported(projectId: string): string;
export declare function pathIssueRecordings(issueId: string): string;
export declare function pathIssueRecordingById(issueId: string, recordingId: string): string;
export declare function pathIssueScreenshots(issueId: string): string;
export declare function pathIssueScreenshotById(issueId: string, screenshotId: string): string;
export declare function pathIssueFiles(issueId: string): string;
export declare function pathIssueFileById(issueId: string, fileId: string): string;
export declare function pathIssueFileStream(issueId: string, fileId: string): string;
export declare function pathRecordingStream(filename: string): string;
export declare function pathScreenshotStream(filename: string): string;
export declare function pathChecklistList(
  resource: "features" | "todos" | "ideas" | "bugs",
  projectId?: string,
  search?: string
): string;
export declare function pathChecklistItem(
  resource: "features" | "todos" | "ideas" | "bugs",
  itemId: string
): string;
export declare function pathChecklistReorder(
  resource: "features" | "todos" | "ideas" | "bugs"
): string;
export declare function pathIdeaPlan(ideaId: string): string;
export declare function pathIdeaAssistantChat(ideaId: string): string;
export declare function pathIdeasAssistantChat(): string;
export declare function pathIdeasOpenrouterModels(): string;
export declare function pathIdeasElevenlabsVoices(): string;
export declare function pathIdeasTts(): string;
export declare function pathAuthProviders(): string;
export declare function pathAuthGoogle(): string;
export declare function pathAuthApple(): string;
export declare function pathAuthGithub(): string;
export declare function pathAuthMobile(provider: string): string;
export declare function pathApiUiTests(): string;
