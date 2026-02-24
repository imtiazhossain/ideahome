import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  fetchProjects,
  fetchIssues,
  fetchIssue,
  fetchUsers,
  fetchOrganizations,
  createIssue,
  createOrganization,
  createProject,
  updateProject,
  deleteProject,
  updateIssue,
  updateIssueStatus,
  fetchIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  deleteIssue,
  deleteAllIssues,
  addCommentAttachment,
  deleteCommentAttachment,
  runUiTest,
  uploadIssueRecording,
  updateIssueRecording,
  deleteIssueRecording,
  getRecordingUrl,
  uploadIssueScreenshot,
  updateIssueScreenshot,
  deleteIssueScreenshot,
  getScreenshotUrl,
  uploadIssueFile,
  deleteIssueFile,
  getIssueFileUrl,
  STATUSES,
  type Issue,
  type IssueComment,
  type IssueRecording,
  type IssueScreenshot,
  type IssueFile,
  type CommentAttachmentType,
  type Organization,
  type Project,
  type User,
  type RunUiTestResult,
} from "../lib/api";
import { uiTests, testNameToSlug } from "../lib/ui-tests";
import { ProjectNavBar, DrawerCollapsedNav } from "../components/ProjectNavBar";
import { useTheme } from "./_app";

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(adjustHeight, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.stopPropagation();
      }}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  );
}

function PendingAttachmentVideoPlayer({
  base64,
  onClose,
}: {
  base64: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      const bin = atob(base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const blob = new Blob([arr], { type: "video/webm" });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch {
      setUrl(null);
    }
  }, [base64]);
  if (!url) return null;
  return (
    <video
      src={url}
      controls
      playsInline
      style={{ maxWidth: "100%", maxHeight: "80vh", display: "block" }}
      onError={onClose}
    >
      Your browser does not support the video tag.
    </video>
  );
}

/** Splits comment body into text and file-name segments for rendering (file names as buttons). */
function commentBodyWithFileButtons(
  body: string,
  attachments: { mediaUrl: string; type: string }[] | undefined,
  getRecordingUrlFn: (url: string) => string,
  getScreenshotUrlFn: (url: string) => string,
  options?: {
    recordings?: IssueRecording[];
    screenshots?: IssueScreenshot[];
    files?: IssueFile[];
    onScrollToRecording?: (recordingId: string) => void;
    onScrollToScreenshot?: (screenshotId: string) => void;
    onScrollToFile?: (fileId: string) => void;
  }
): React.ReactNode[] {
  const segments: Array<
    { type: "text"; value: string } | { type: "file"; value: string }
  > = [];
  const filePattern = /(comment-[a-z0-9]+-\d+\.webm|\[[^\]]+\])/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(filePattern.source, "gi");
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, m.index) });
    }
    segments.push({ type: "file", value: m[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  const nodes: React.ReactNode[] = [];
  const recordings = options?.recordings ?? [];
  const screenshots = options?.screenshots ?? [];
  const files = options?.files ?? [];
  const onScrollToRecording = options?.onScrollToRecording;
  const onScrollToScreenshot = options?.onScrollToScreenshot;
  const onScrollToFile = options?.onScrollToFile;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === "text") {
      nodes.push(seg.value);
      continue;
    }
    const raw = seg.value;
    const isBracket = raw.startsWith("[") && raw.endsWith("]");
    const label = isBracket ? raw.slice(1, -1) : raw;
    let href: string | undefined;
    let recordingId: string | undefined;
    let screenshotId: string | undefined;
    let fileId: string | undefined;
    if (!isBracket && /^comment-[a-z0-9]+-\d+\.webm$/i.test(raw)) {
      href = getRecordingUrlFn(raw);
    } else if (attachments?.length) {
      const filename = label.replace(/^.*[/\\]/, "");
      const att = attachments.find((a) => {
        const attName = a.mediaUrl.replace(/^.*\//, "");
        return (
          attName === filename ||
          attName === label ||
          a.mediaUrl.endsWith(label)
        );
      });
      if (att) {
        href =
          att.type === "screenshot"
            ? getScreenshotUrlFn(att.mediaUrl)
            : getRecordingUrlFn(att.mediaUrl);
      }
    }
    if (!href && isBracket && /^comment-[a-z0-9]+-\d+\.webm$/i.test(label)) {
      href = getRecordingUrlFn(label);
    }
    if (!href && recordings.length > 0 && onScrollToRecording) {
      const rec = recordings.find((r) => {
        const url = r.videoUrl ?? "";
        const kf = url.includes("-audio.webm")
          ? "audio"
          : url.includes("-camera.webm")
            ? "camera"
            : url.includes("-screen.webm")
              ? "screen"
              : null;
        const isAudio = r.mediaType === "audio" || kf === "audio";
        const kind: "audio" | "screen" | "camera" = isAudio
          ? "audio"
          : ((kf as "screen" | "camera" | null) ?? r.recordingType ?? "screen");
        const rIdx = recordings.indexOf(r) + 1;
        const defaultLabel =
          kind === "audio"
            ? `Audio Recording ${rIdx}`
            : kind === "camera"
              ? `Camera Recording ${rIdx}`
              : `Screen Recording ${rIdx}`;
        // Match by current display name OR by default label (so comment still resolves after user renames the recording)
        return (
          (r.name ?? defaultLabel) === label ||
          r.name === label ||
          defaultLabel === label
        );
      });
      if (rec) recordingId = rec.id;
    }
    if (
      !href &&
      !recordingId &&
      screenshots.length > 0 &&
      onScrollToScreenshot
    ) {
      const screenshotIdPrefix = "screenshot:";
      if (label.startsWith(screenshotIdPrefix)) {
        const id = label.slice(screenshotIdPrefix.length);
        const byId = screenshots.find((s) => s.id === id);
        if (byId) screenshotId = byId.id;
      }
      if (!screenshotId) {
        const screenshotMatch = /^Screenshot (\d+)$/.exec(label);
        if (screenshotMatch) {
          const idx = parseInt(screenshotMatch[1], 10);
          if (idx >= 1 && idx <= screenshots.length)
            screenshotId = screenshots[idx - 1].id;
        }
      }
      if (!screenshotId) {
        const byName = screenshots.find((s) => (s.name ?? "").trim() === label);
        if (byName) screenshotId = byName.id;
      }
      if (!screenshotId) {
        const unnamed = screenshots.filter((s) => !(s.name ?? "").trim());
        const looksLikeImageFilename = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(
          label.trim()
        );
        if (unnamed.length === 1 && looksLikeImageFilename)
          screenshotId = unnamed[0].id;
      }
    }
    if (
      !href &&
      !recordingId &&
      !screenshotId &&
      files.length > 0 &&
      onScrollToFile
    ) {
      const f = files.find((x) => x.fileName === label);
      if (f) fileId = f.id;
    }
    const buttonStyle = {
      display: "inline-flex" as const,
      alignItems: "center",
      gap: 4,
      padding: "4px 8px",
      borderRadius: 6,
      textDecoration: "none",
      fontSize: 12,
      marginRight: 4,
      marginBottom: 4,
    };
    if (recordingId && onScrollToRecording) {
      const rec = recordings.find((r) => r.id === recordingId);
      const recIdx = rec ? recordings.indexOf(rec) + 1 : 0;
      const url = rec?.videoUrl ?? "";
      const kf = url.includes("-audio.webm")
        ? "audio"
        : url.includes("-camera.webm")
          ? "camera"
          : url.includes("-screen.webm")
            ? "screen"
            : null;
      const isAudio = rec?.mediaType === "audio" || kf === "audio";
      const kind: "audio" | "screen" | "camera" = isAudio
        ? "audio"
        : ((kf as "screen" | "camera" | null) ??
          rec?.recordingType ??
          "screen");
      const defaultLabel =
        kind === "audio"
          ? `Audio Recording ${recIdx}`
          : kind === "camera"
            ? `Camera Recording ${recIdx}`
            : `Screen Recording ${recIdx}`;
      const displayLabel = rec ? (rec.name ?? defaultLabel) : label;
      nodes.push(
        <button
          key={`file-${i}-${raw}`}
          type="button"
          className="btn btn-secondary"
          style={buttonStyle}
          onClick={() => onScrollToRecording(recordingId!)}
          aria-label={`Go to recording: ${displayLabel}`}
          title={`Go to recording: ${displayLabel}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          {displayLabel}
        </button>
      );
    } else if (screenshotId && onScrollToScreenshot) {
      const shot = screenshots.find((s) => s.id === screenshotId);
      const displayLabel = shot ? (shot.name ?? label) : label;
      nodes.push(
        <button
          key={`file-${i}-${raw}`}
          type="button"
          className="btn btn-secondary"
          style={buttonStyle}
          onClick={() => onScrollToScreenshot(screenshotId!)}
          aria-label={`Go to ${displayLabel}`}
          title={`Go to ${displayLabel}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          {displayLabel}
        </button>
      );
    } else if (fileId && onScrollToFile) {
      nodes.push(
        <button
          key={`file-${i}-${raw}`}
          type="button"
          className="btn btn-secondary"
          style={buttonStyle}
          onClick={() => onScrollToFile(fileId!)}
          aria-label={`Go to file: ${label}`}
          title={`Go to file: ${label}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {label}
        </button>
      );
    } else {
      nodes.push(
        <a
          key={`file-${i}-${raw}`}
          href={href ?? "#"}
          target={href ? "_blank" : undefined}
          rel={href ? "noopener noreferrer" : undefined}
          className="btn btn-secondary"
          style={buttonStyle}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          {label}
        </a>
      );
    }
  }
  return nodes;
}

function parseTestCases(raw: string | null | undefined): string[] {
  if (!raw) return [""];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(String);
  } catch {
    // not JSON — treat legacy plain-text value as a single test case
  }
  return [raw];
}

function serializeTestCases(cases: string[]): string | null {
  if (cases.length === 0) return null;
  if (cases.length === 1 && cases[0].trim() === "") return null;
  return JSON.stringify(cases);
}

function parseAutomatedTests(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return raw ? [raw] : [];
}

function serializeAutomatedTests(tests: string[]): string | null {
  if (tests.length === 0) return null;
  return JSON.stringify(tests);
}

function hasIssueDetailChanges(
  selected: Issue | null,
  original: Issue | null
): boolean {
  if (!selected || !original || selected.id !== original.id) return false;
  return (
    (selected.title ?? "") !== (original.title ?? "") ||
    (selected.description ?? "") !== (original.description ?? "") ||
    (selected.acceptanceCriteria ?? "") !==
      (original.acceptanceCriteria ?? "") ||
    (selected.database ?? "") !== (original.database ?? "") ||
    (selected.api ?? "") !== (original.api ?? "") ||
    (selected.testCases ?? "") !== (original.testCases ?? "") ||
    (selected.automatedTest ?? "") !== (original.automatedTest ?? "") ||
    (selected.assigneeId ?? "") !== (original.assigneeId ?? "")
  );
}

/** Same stops as .quality-score-bar-fill: red → yellow (50%) → green. Returns hex for a score 0–100. */
function getQualityScoreColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent)) / 100;
  const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = lerp(229, 236, t);
    g = lerp(62, 201, t);
    b = lerp(62, 75, t);
  } else {
    const t = (p - 0.5) * 2;
    r = lerp(236, 56, t);
    g = lerp(201, 161, t);
    b = lerp(75, 105, t);
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Quality score = number of filled input fields (title, description, acceptanceCriteria, database, api, testCases). +1 per field. */
function computeQualityScore(issue: {
  title?: string | null;
  description?: string | null;
  acceptanceCriteria?: string | null;
  database?: string | null;
  api?: string | null;
  testCases?: string | null;
}): number {
  let score = 0;
  if ((issue.title ?? "").trim()) score += 1;
  if ((issue.description ?? "").trim()) score += 1;
  if ((issue.acceptanceCriteria ?? "").trim()) score += 1;
  if ((issue.database ?? "").trim()) score += 1;
  if ((issue.api ?? "").trim()) score += 1;
  const cases = parseTestCases(issue.testCases);
  if (cases.some((c) => (c ?? "").trim() !== "")) score += 1;
  return score;
}

/** Project name to acronym, e.g. "Idea Home Launch" -> "IHL". */
function projectNameToAcronym(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "PRJ";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => (w[0] ?? "").toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 3).toUpperCase() || "PRJ";
}

function issueKey(issue: Issue): string {
  if (issue.key) return issue.key;
  const acronym = projectNameToAcronym(issue.project?.name ?? "");
  const num = issue.id.slice(-4).toUpperCase();
  return `${acronym}-${num}`;
}

function AssigneeAvatar({ issue }: { issue: Issue }) {
  if (!issue.assignee) return null;
  const initial = (issue.assignee.name || issue.assignee.email)
    .slice(0, 1)
    .toUpperCase();
  return (
    <div className="assignee-avatar" title={issue.assignee.email}>
      {initial}
    </div>
  );
}

const DRAG_ISSUE_KEY = "application/x-issue-id";

function IssueCard({
  issue,
  columnStatusId,
  onStatusChange,
  onSelect,
  onDragStart,
  onDragEnd,
  isPreview,
}: {
  issue: Issue;
  columnStatusId: string;
  onStatusChange: (id: string, status: string) => void;
  onSelect: (issue: Issue) => void;
  onDragStart?: (issueId: string) => void;
  onDragEnd?: () => void;
  isPreview?: boolean;
}) {
  const [wasDragging, setWasDragging] = React.useState(false);
  const scoreDisplay = Math.round((computeQualityScore(issue) / 6) * 100);
  const scoreColor = getQualityScoreColor(scoreDisplay);
  const scoreTextColor =
    scoreDisplay >= 40 && scoreDisplay <= 65 ? "#1a1a1a" : "#fff";

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DRAG_ISSUE_KEY, issue.id);
    e.dataTransfer.effectAllowed = "move";
    setWasDragging(true);
    onDragStart?.(issue.id);
  };

  const handleDragEnd = () => {
    setWasDragging(false);
    onDragEnd?.();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedId = e.dataTransfer.getData(DRAG_ISSUE_KEY);
    if (droppedId && columnStatusId) onStatusChange(droppedId, columnStatusId);
  };

  const handleClick = () => {
    if (wasDragging) {
      setTimeout(() => setWasDragging(false), 0);
      return;
    }
    onSelect(issue);
  };

  return (
    <div
      className={`issue-card${isPreview ? " issue-card-preview" : ""}`}
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="issue-card-quality-score"
        title={`Quality Score: ${scoreDisplay}/100`}
        style={{
          background: scoreColor,
          borderColor: scoreColor,
          color: scoreTextColor,
        }}
      >
        {scoreDisplay}
      </div>
      <div className="issue-card-title">{issue.title}</div>
      <div className="issue-card-meta">
        <span className="issue-key">{issueKey(issue)}</span>
        <AssigneeAvatar issue={issue} />
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createAcceptanceCriteria, setCreateAcceptanceCriteria] = useState("");
  const [createDatabase, setCreateDatabase] = useState("");
  const [createApi, setCreateApi] = useState("");
  const [createTestCases, setCreateTestCases] = useState("");
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectOrgId, setNewProjectOrgId] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [projectCreateError, setProjectCreateError] = useState<string | null>(
    null
  );
  const [projectSubmitting, setProjectSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueSaveError, setIssueSaveError] = useState<string | null>(null);
  const [issueSaveSuccess, setIssueSaveSuccess] = useState(false);
  const [issueDetailOriginal, setIssueDetailOriginal] = useState<Issue | null>(
    null
  );
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [draggingIssueId, setDraggingIssueId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [projectDeleting, setProjectDeleting] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<Issue | null>(null);
  const [issueDeleting, setIssueDeleting] = useState(false);
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const [deleteAllDeleting, setDeleteAllDeleting] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const [automatedTestDropdownOpen, setAutomatedTestDropdownOpen] =
    useState(false);
  const automatedTestDropdownRef = useRef<HTMLDivElement>(null);
  /** Per-test run results in the issue detail modal (key = test name). */
  const [automatedTestRunResults, setAutomatedTestRunResults] = useState<
    Record<string, RunUiTestResult | "running">
  >({});
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
  const [issueCommentDraft, setIssueCommentDraft] = useState("");
  const [issueCommentsLoading, setIssueCommentsLoading] = useState(false);
  const [issueCommentSubmitting, setIssueCommentSubmitting] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  );
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentIssueId, setEditingCommentIssueId] = useState<
    string | null
  >(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState("");
  const [editingCommentBlocks, setEditingCommentBlocks] = useState<
    CommentBlock[] | null
  >(null);
  const [updatingCommentId, setUpdatingCommentId] = useState<string | null>(
    null
  );
  const [issueCommentsError, setIssueCommentsError] = useState<string | null>(
    null
  );
  const [commentBoxError, setCommentBoxError] = useState(false);
  const [commentHistoryOpenId, setCommentHistoryOpenId] = useState<
    string | null
  >(null);
  const [commentDraftRecordingId, setCommentDraftRecordingId] = useState<
    string | null
  >(null);
  type CommentBlockText = { kind: "text"; value: string };
  type CommentBlockAttachment = {
    kind: "attachment";
    attType: CommentAttachmentType;
    imageBase64?: string;
    videoBase64?: string;
    name?: string;
  };
  type CommentBlockRecording = { kind: "recording"; recordingId: string };
  type CommentBlockScreenshot = {
    kind: "screenshot";
    screenshotId: string;
    name?: string;
  };
  type CommentBlockFile = { kind: "file"; fileId: string };
  type CommentBlock =
    | CommentBlockText
    | CommentBlockAttachment
    | CommentBlockRecording
    | CommentBlockScreenshot
    | CommentBlockFile;
  const [commentBlocks, setCommentBlocks] = useState<CommentBlock[]>([
    { kind: "text", value: "" },
  ]);
  const activeCommentBlockRef = useRef(0);
  const [viewingBlockIndex, setViewingBlockIndex] = useState<number | null>(
    null
  );
  const [pendingCommentAttachments, setPendingCommentAttachments] = useState<
    Array<{
      type: CommentAttachmentType;
      imageBase64?: string;
      videoBase64?: string;
      name?: string;
    }>
  >([]);
  const [viewingPendingAttachmentIndex, setViewingPendingAttachmentIndex] =
    useState<number | null>(null);
  const [addingAttachmentToCommentId, setAddingAttachmentToCommentId] =
    useState<string | null>(null);
  const [commentAttachmentUploading, setCommentAttachmentUploading] =
    useState(false);
  const recordingDestinationRef = useRef<
    | "issue"
    | "comment-pending"
    | string
    | {
        dest: "comment-pending" | string;
        recordingType:
          | "screen_recording"
          | "camera_recording"
          | "audio_recording";
      }
    | null
  >(null);
  const commentScreenshotFileInputRef = useRef<HTMLInputElement>(null);
  const commentVideoFileInputRef = useRef<HTMLInputElement>(null);
  const issueCommentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingFor, setRecordingFor] = useState<
    null | "issue" | "comment-pending" | string
  >(null);
  const [recordingMode, setRecordingMode] = useState<
    "screen" | "camera" | "audio" | null
  >(null);
  const recordingModeRef = useRef<"screen" | "camera" | "audio" | null>(null);
  const [recordingUploading, setRecordingUploading] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(
    null
  );
  const [editingRecordingId, setEditingRecordingId] = useState<string | null>(
    null
  );
  const [editingRecordingName, setEditingRecordingName] = useState("");
  const [editingScreenshotId, setEditingScreenshotId] = useState<string | null>(
    null
  );
  const [editingScreenshotName, setEditingScreenshotName] = useState("");
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [canScreenRecord, setCanScreenRecord] = useState(false);
  const [canCameraRecord, setCanCameraRecord] = useState(false);
  const [canAudioRecord, setCanAudioRecord] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingsSectionRef = useRef<HTMLDivElement>(null);
  const screenshotsSectionRef = useRef<HTMLDivElement>(null);
  const filesSectionRef = useRef<HTMLDivElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const issueDetailModalScrollRef = useRef<HTMLDivElement>(null);
  const scrollLockRafRef = useRef<number | null>(null);
  const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Anchor-based scroll lock: saves the visual position of the comments section
   * relative to the scroll container viewport, then continuously repositions
   * scroll to maintain that visual offset as content above changes size.
   */
  const lockScrollPosition = () => {
    const scrollEl = issueDetailModalScrollRef.current;
    const anchorEl = commentsSectionRef.current;
    if (!scrollEl || !anchorEl) return;
    if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
    if (scrollLockRafRef.current)
      cancelAnimationFrame(scrollLockRafRef.current);
    const scrollRect = scrollEl.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const visualOffset = anchorRect.top - scrollRect.top;
    let frames = 0;
    const enforce = () => {
      const sEl = issueDetailModalScrollRef.current;
      const aEl = commentsSectionRef.current;
      if (sEl && aEl) {
        const newScrollRect = sEl.getBoundingClientRect();
        const newAnchorRect = aEl.getBoundingClientRect();
        const currentOffset = newAnchorRect.top - newScrollRect.top;
        const diff = currentOffset - visualOffset;
        if (Math.abs(diff) > 1) {
          sEl.scrollTop += diff;
        }
      }
      if (++frames < 25) {
        scrollLockRafRef.current = requestAnimationFrame(enforce);
      }
    };
    scrollLockRafRef.current = requestAnimationFrame(enforce);
    scrollLockTimerRef.current = setTimeout(() => {
      if (scrollLockRafRef.current)
        cancelAnimationFrame(scrollLockRafRef.current);
      scrollLockRafRef.current = null;
      scrollLockTimerRef.current = null;
    }, 800);
  };

  /** Derive screenshot display names from comment bodies when shot.name is missing (e.g. legacy or Take Screenshot). */
  const screenshotNameFromComments = useMemo(() => {
    const map = new Map<string, string>();
    if (!selectedIssue?.id || !selectedIssue.screenshots?.length) return map;
    const screenshots = selectedIssue.screenshots;
    const comments = issueComments.filter(
      (c) => c.issueId === selectedIssue.id
    );
    const looksLikeImageFilename = (name: string) =>
      /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(name.trim());
    for (const c of comments) {
      const re = /\[([^\]]+)\]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.body)) !== null) {
        const label = m[1];
        let shot: (typeof screenshots)[0] | undefined;
        const numMatch = /^Screenshot (\d+)$/.exec(label);
        if (numMatch) {
          const idx = parseInt(numMatch[1], 10);
          if (idx >= 1 && idx <= screenshots.length)
            shot = screenshots[idx - 1];
        } else {
          shot = screenshots.find((s) => (s.name ?? "").trim() === label);
        }
        if (!shot) {
          const firstUnnamed = screenshots.find(
            (s) => !(s.name ?? "").trim() && !map.has(s.id)
          );
          if (firstUnnamed && looksLikeImageFilename(label))
            shot = firstUnnamed;
        }
        if (shot && !map.has(shot.id)) map.set(shot.id, label);
      }
    }
    return map;
  }, [selectedIssue?.id, selectedIssue?.screenshots, issueComments]);
  const recordingUploadForCommentDraftRef = useRef(false);
  const recordingPlayerWrapRef = useRef<HTMLDivElement>(null);
  const [recordingPlaybackError, setRecordingPlaybackError] = useState<
    string | null
  >(null);

  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotTaking, setScreenshotTaking] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [screenshotCaptureMaxWidth, setScreenshotCaptureMaxWidth] = useState<
    number | null
  >(1920);
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);

  const [fileUploading, setFileUploading] = useState(false);
  const [uploadButtonBusy, setUploadButtonBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOverCount, setDragOverCount] = useState(0);

  useEffect(() => {
    setCanScreenRecord(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getDisplayMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    setCanCameraRecord(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    setCanAudioRecord(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    if (playingRecordingId) {
      setRecordingPlaybackError(null);
    }
  }, [playingRecordingId]);

  useEffect(() => {
    return () => {
      if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
      if (scrollLockRafRef.current)
        cancelAnimationFrame(scrollLockRafRef.current);
    };
  }, []);

  /** Convert a Blob to a base64 string using arrayBuffer (more reliable than FileReader.readAsDataURL). */
  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  /** Shared handler: assemble recorded chunks into a blob, validate, convert to base64, and upload or add to comment. */
  const uploadRecordedChunks = async (mimeType: string) => {
    setRecordingFor(null);
    if (recordedChunksRef.current.length === 0) {
      setRecordingError("No recording data captured. Please try again.");
      return;
    }

    const blob = new Blob(recordedChunksRef.current, {
      type: mimeType || "video/webm",
    });

    if (blob.size < 1000) {
      setRecordingError(
        `Recording too short or empty (${blob.size} bytes). Please record for at least a few seconds.`
      );
      return;
    }

    const dest = recordingDestinationRef.current;
    type CommentDest = {
      dest: "comment-pending" | string;
      recordingType:
        | "screen_recording"
        | "camera_recording"
        | "audio_recording";
    };
    const isCommentDest =
      typeof dest === "object" && dest !== null && "dest" in dest;
    const commentRecordingType = isCommentDest
      ? (dest as CommentDest).recordingType
      : null;
    const commentDest = isCommentDest ? (dest as CommentDest).dest : null;

    if (isCommentDest && commentDest === "comment-pending") {
      recordingDestinationRef.current = null;
      recordingModeRef.current = null;
      if (selectedIssue) {
        lockScrollPosition();
        setRecordingUploading(true);
        try {
          const base64 = await blobToBase64(blob);
          const recordingType =
            commentRecordingType === "camera_recording" ? "camera" : "screen";
          const updated = await uploadIssueRecording(
            selectedIssue.id,
            base64,
            "video",
            recordingType
          );
          setIssues((prev) =>
            prev.map((i) => (i.id === updated.id ? updated : i))
          );
          setSelectedIssue(updated);
          setIssueDetailOriginal(updated);
          const newRec = updated.recordings?.find(
            (r) => !selectedIssue.recordings?.some((old) => old.id === r.id)
          );
          if (newRec)
            insertCommentBlock({ kind: "recording", recordingId: newRec.id });
        } catch (err) {
          setRecordingError(
            err instanceof Error ? err.message : "Failed to upload recording"
          );
        } finally {
          setRecordingUploading(false);
        }
      } else {
        const base64 = await blobToBase64(blob);
        insertCommentBlock({
          kind: "attachment",
          attType: commentRecordingType ?? "screen_recording",
          videoBase64: base64,
        });
      }
      return;
    }

    if (
      isCommentDest &&
      typeof commentDest === "string" &&
      commentDest !== "comment-pending" &&
      selectedIssue
    ) {
      const commentId = commentDest;
      recordingModeRef.current = null;
      setRecordingFor(null);
      setRecordingUploading(true);
      try {
        const base64 = await blobToBase64(blob);
        const mediaType =
          commentRecordingType === "audio_recording" ? "audio" : "video";
        const recordingType =
          commentRecordingType === "audio_recording"
            ? "audio"
            : commentRecordingType === "camera_recording"
              ? "camera"
              : "screen";
        const updated = await uploadIssueRecording(
          selectedIssue.id,
          base64,
          mediaType,
          recordingType
        );
        lockScrollPosition();
        setIssues((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i))
        );
        setSelectedIssue(updated);
        setIssueDetailOriginal(updated);
        const prevIds = new Set(
          (selectedIssue.recordings ?? []).map((r) => r.id)
        );
        const newRec = updated.recordings?.find((r) => !prevIds.has(r.id));
        if (commentId === editingCommentId && newRec) {
          if (editingCommentBlocks) {
            const nextBlocks: CommentBlock[] = [
              ...editingCommentBlocks,
              { kind: "recording", recordingId: newRec.id },
            ];
            setEditingCommentBlocks(nextBlocks);
          } else {
            const recordings = updated.recordings ?? [];
            const url = newRec.videoUrl ?? "";
            const kindFromFilename = url.includes("-audio.webm")
              ? "audio"
              : url.includes("-camera.webm")
                ? "camera"
                : url.includes("-screen.webm")
                  ? "screen"
                  : null;
            const isAudio =
              newRec.mediaType === "audio" || kindFromFilename === "audio";
            const kind: "audio" | "screen" | "camera" = isAudio
              ? "audio"
              : ((kindFromFilename as "screen" | "camera" | null) ??
                newRec.recordingType ??
                "screen");
            const rIdx = recordings.indexOf(newRec) + 1;
            const defaultLabel =
              kind === "audio"
                ? `Audio Recording ${rIdx}`
                : kind === "camera"
                  ? `Camera Recording ${rIdx}`
                  : `Screen Recording ${rIdx}`;
            const label = newRec.name ?? defaultLabel;
            setEditingCommentDraft((draft) =>
              (draft.trim() + "\n[" + label + "]").trim()
            );
          }
        }
        setAddingAttachmentToCommentId(null);
      } catch (err) {
        setRecordingError(
          err instanceof Error ? err.message : "Failed to upload recording"
        );
      } finally {
        setRecordingUploading(false);
        recordingDestinationRef.current = null;
        recordingModeRef.current = null;
      }
      return;
    }

    if (!selectedIssue) return;
    const mode = recordingModeRef.current;
    recordingModeRef.current = null;
    lockScrollPosition();
    setRecordingUploading(true);
    const mediaType = mode === "audio" ? "audio" : "video";
    const recordingType = (mode ?? "screen") as "screen" | "camera" | "audio";
    try {
      const base64 = await blobToBase64(blob);
      const updated = await uploadIssueRecording(
        selectedIssue.id,
        base64,
        mediaType,
        recordingType
      );
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
      const wasForCommentDraft = recordingUploadForCommentDraftRef.current;
      if (recordingUploadForCommentDraftRef.current) {
        recordingUploadForCommentDraftRef.current = false;
        const prevIds = new Set(
          (selectedIssue.recordings ?? []).map((r) => r.id)
        );
        const newRec = updated.recordings?.find((r) => !prevIds.has(r.id));
        if (newRec)
          insertCommentBlock({ kind: "recording", recordingId: newRec.id });
      }
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : "Failed to upload recording"
      );
    } finally {
      setRecordingUploading(false);
    }
  };

  /** Wire up a MediaRecorder: collect chunks with timeslice, handle stop → upload. */
  const setupRecorder = (
    stream: MediaStream,
    audioOnly = false
  ): MediaRecorder => {
    recordedChunksRef.current = [];

    const preferredTypes = audioOnly
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
      : [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ];
    const mimeType =
      preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ||
      (audioOnly ? "audio/webm" : "");
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
      setRecordingMode(null);
      await uploadRecordedChunks(recorder.mimeType);
    };

    return recorder;
  };

  const startRecording = async (opts?: {
    forCommentPending?: boolean;
    forCommentId?: string;
  }) => {
    setRecordingError(null);
    if (!opts) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingModeRef.current = "screen";
    } else if (opts.forCommentPending) {
      recordingDestinationRef.current = {
        dest: "comment-pending",
        recordingType: "screen_recording",
      };
      setRecordingFor("comment-pending");
    } else if (opts.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "screen_recording",
      };
      setRecordingFor(opts.forCommentId);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // @ts-ignore – Chrome-specific: prefer current tab so the browser doesn't switch focus away
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      )
        return;
      setRecordingError(
        `Could not start screen capture: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream);

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start(1000);
      setRecordingMode("screen");
      setIsRecording(true);
      window.focus();
      setTimeout(() => window.focus(), 300);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const startCameraRecording = async (opts?: {
    forCommentPending?: boolean;
    forCommentId?: string;
  }) => {
    setRecordingError(null);
    if (!opts) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingModeRef.current = "camera";
    } else if (opts.forCommentPending) {
      recordingDestinationRef.current = {
        dest: "comment-pending",
        recordingType: "camera_recording",
      };
      setRecordingFor("comment-pending");
    } else if (opts.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "camera_recording",
      };
      setRecordingFor(opts.forCommentId);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch (firstErr) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "AbortError")
        )
          return;
        setRecordingError(
          `Could not start camera: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream);

      recorder.start(1000);
      setRecordingMode("camera");
      setIsRecording(true);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Camera recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const startAudioRecording = async (opts?: {
    forCommentPending?: boolean;
    forCommentId?: string;
  }) => {
    setRecordingError(null);
    recordingModeRef.current = "audio";
    if (opts?.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "audio_recording",
      };
      setRecordingFor(opts.forCommentId);
      recordingUploadForCommentDraftRef.current = false;
    } else if (opts?.forCommentPending) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingUploadForCommentDraftRef.current = true;
    } else {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingUploadForCommentDraftRef.current = false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      )
        return;
      setRecordingError(
        `Could not start microphone: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream, true);

      recorder.start(1000);
      setRecordingMode("audio");
      setIsRecording(true);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Audio recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecordingFor(null);
  };

  /** Upload files from the unified upload button; classifies each like drag-and-drop. */
  const handleUnifiedFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList?.length || !selectedIssue) return;
    const filesToUpload = Array.from(fileList);
    e.target.value = "";
    setUploadButtonBusy(true);
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        await uploadClassifiedFile(filesToUpload[i]);
      }
    } finally {
      setUploadButtonBusy(false);
    }
  };

  const handleUpdateRecordingType = async (
    recordingId: string,
    kind: "audio" | "screen" | "camera"
  ) => {
    if (!selectedIssue) return;
    setRecordingError(null);
    const mediaType = kind === "audio" ? "audio" : "video";
    const recordingType = kind;
    try {
      const updated = await updateIssueRecording(
        selectedIssue.id,
        recordingId,
        {
          mediaType,
          recordingType,
        }
      );
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : "Failed to update recording type"
      );
    }
  };

  const handleSaveRecordingName = async (recordingId: string, name: string) => {
    if (!selectedIssue) return;
    setEditingRecordingId(null);
    setRecordingError(null);
    const value = name.trim() || null;
    try {
      const updated = await updateIssueRecording(
        selectedIssue.id,
        recordingId,
        { name: value }
      );
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : "Failed to update recording name"
      );
    }
  };

  const handleDeleteRecording = async (recordingId: string) => {
    if (!selectedIssue) return;
    setRecordingError(null);
    try {
      const updated = await deleteIssueRecording(selectedIssue.id, recordingId);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
      if (playingRecordingId === recordingId) setPlayingRecordingId(null);
      if (editingRecordingId === recordingId) setEditingRecordingId(null);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : "Failed to delete recording"
      );
    }
  };

  const handleScreenshotUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIssue) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) {
      setScreenshotError("Please select an image file (e.g. PNG, JPEG)");
      return;
    }
    setScreenshotError(null);
    setScreenshotUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const updated = await uploadIssueScreenshot(
        selectedIssue.id,
        base64,
        file.name
      );
      const nameToShow = (file.name ?? "").trim() || undefined;
      const patched =
        nameToShow && updated.screenshots
          ? {
              ...updated,
              screenshots: updated.screenshots.map((s) => {
                const isNew = !selectedIssue.screenshots?.some(
                  (old) => old.id === s.id
                );
                if (isNew && !(s.name ?? "").trim())
                  return { ...s, name: nameToShow };
                return s;
              }),
            }
          : updated;
      setIssues((prev) => prev.map((i) => (i.id === patched.id ? patched : i)));
      setSelectedIssue(patched);
      setIssueDetailOriginal(patched);
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Failed to upload screenshot"
      );
    } finally {
      setScreenshotUploading(false);
    }
  };

  const handleSaveScreenshotName = async (
    screenshotId: string,
    name: string
  ) => {
    if (!selectedIssue?.id || !screenshotId?.trim()) return;
    const belongsToIssue = selectedIssue.screenshots?.some(
      (s) => s.id === screenshotId
    );
    if (!belongsToIssue) return;
    setEditingScreenshotId(null);
    setScreenshotError(null);
    const value = name.trim() || null;
    try {
      const updated = await updateIssueScreenshot(
        selectedIssue.id,
        screenshotId,
        { name: value }
      );
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Failed to update screenshot name"
      );
    }
  };

  const handleDeleteScreenshot = async (screenshotId: string) => {
    if (!selectedIssue) return;
    setScreenshotError(null);
    try {
      const updated = await deleteIssueScreenshot(
        selectedIssue.id,
        screenshotId
      );
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
      if (editingScreenshotId === screenshotId) setEditingScreenshotId(null);
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Failed to delete screenshot"
      );
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedIssue) return;
    setFileError(null);
    try {
      const updated = await deleteIssueFile(selectedIssue.id, fileId);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : "Failed to delete file"
      );
    }
  };

  /** Classify file for drag-drop: "screenshot" | "recording" | "file" */
  const classifyFile = (file: File): "screenshot" | "recording" | "file" => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (
      type.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(name)
    )
      return "screenshot";
    if (
      type.startsWith("video/") ||
      type.startsWith("audio/") ||
      /\.(webm|mp4|mov|mp3|m4a|ogg|wav|webm)$/i.test(name)
    )
      return "recording";
    return "file";
  };

  /** Upload a single file, classifying it like drag-and-drop (screenshot / recording / file). */
  const uploadClassifiedFile = async (file: File): Promise<void> => {
    if (!selectedIssue) return;
    const kind = classifyFile(file);
    const base64 = await blobToBase64(file);
    if (kind === "screenshot") {
      setScreenshotError(null);
      setScreenshotUploading(true);
      try {
        const updated = await uploadIssueScreenshot(
          selectedIssue.id,
          base64,
          file.name
        );
        const nameToShow = (file.name ?? "").trim() || undefined;
        const patched =
          nameToShow && updated.screenshots
            ? {
                ...updated,
                screenshots: updated.screenshots.map((s) => {
                  const isNew = !selectedIssue.screenshots?.some(
                    (old) => old.id === s.id
                  );
                  if (isNew && !(s.name ?? "").trim())
                    return { ...s, name: nameToShow };
                  return s;
                }),
              }
            : updated;
        setIssues((prev) =>
          prev.map((j) => (j.id === patched.id ? patched : j))
        );
        setSelectedIssue(patched);
        setIssueDetailOriginal(patched);
      } catch (err) {
        setScreenshotError(
          err instanceof Error ? err.message : "Failed to upload screenshot"
        );
      } finally {
        setScreenshotUploading(false);
      }
    } else if (kind === "recording") {
      setRecordingError(null);
      setRecordingUploading(true);
      const mediaType = file.type.startsWith("audio/") ? "audio" : "video";
      const recordingType = mediaType === "audio" ? "audio" : "screen";
      try {
        const updated = await uploadIssueRecording(
          selectedIssue.id,
          base64,
          mediaType,
          recordingType,
          file.name
        );
        setIssues((prev) =>
          prev.map((j) => (j.id === updated.id ? updated : j))
        );
        setSelectedIssue(updated);
        setIssueDetailOriginal(updated);
      } catch (err) {
        setRecordingError(
          err instanceof Error ? err.message : "Failed to upload recording"
        );
      } finally {
        setRecordingUploading(false);
      }
    } else {
      setFileError(null);
      setFileUploading(true);
      try {
        const updated = await uploadIssueFile(
          selectedIssue.id,
          base64,
          file.name
        );
        setIssues((prev) =>
          prev.map((j) => (j.id === updated.id ? updated : j))
        );
        setSelectedIssue(updated);
        setIssueDetailOriginal(updated);
      } catch (err) {
        setFileError(
          err instanceof Error ? err.message : "Failed to upload file"
        );
      } finally {
        setFileUploading(false);
      }
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCount(0);
    const files = e.dataTransfer?.files;
    if (!files?.length || !selectedIssue) return;
    for (let i = 0; i < files.length; i++) {
      await uploadClassifiedFile(files[i]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types?.includes("Files"))
      setDragOverCount((c) => c + 1);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCount((c) => Math.max(0, c - 1));
  };

  const captureScreenToBase64 = async (): Promise<string> => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
    });
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
        setTimeout(resolve, 500);
      });
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) throw new Error("Could not get video dimensions");
      const canvas = document.createElement("canvas");
      const scale =
        screenshotCaptureMaxWidth == null
          ? 1
          : Math.min(1, screenshotCaptureMaxWidth / w);
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 0.9)
      );
      if (!blob) throw new Error("Could not create image");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw e;
    }
  };

  const handleTakeScreenshot = async () => {
    if (!selectedIssue || !navigator.mediaDevices?.getDisplayMedia) return;
    setScreenshotError(null);
    setScreenshotTaking(true);
    try {
      const base64 = await captureScreenToBase64();
      setScreenshotTaking(false);
      setScreenshotUploading(true);
      const updated = await uploadIssueScreenshot(selectedIssue.id, base64);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      ) {
        setScreenshotError(null);
      } else {
        setScreenshotError(
          err instanceof Error ? err.message : "Failed to take screenshot"
        );
      }
    } finally {
      setScreenshotTaking(false);
      setScreenshotUploading(false);
    }
  };

  /** Take screenshot, upload to issue Screenshots section, and add a reference in the comment (draft or existing). */
  const handleTakeScreenshotAndAddToComment = async () => {
    if (!selectedIssue || !navigator.mediaDevices?.getDisplayMedia) return;
    setScreenshotError(null);
    setIssueCommentsError(null);
    setScreenshotTaking(true);
    try {
      const base64 = await captureScreenToBase64();
      setScreenshotTaking(false);
      setScreenshotUploading(true);
      const updated = await uploadIssueScreenshot(selectedIssue.id, base64);
      lockScrollPosition();
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
      const newShot = updated.screenshots?.find(
        (s) => !selectedIssue.screenshots?.some((old) => old.id === s.id)
      );
      if (newShot) {
        if (addingAttachmentToCommentId) {
          const comment = issueComments.find(
            (c) => c.id === addingAttachmentToCommentId
          );
          const newBody = (
            (comment?.body ?? "").trim() +
            "\n[screenshot:" +
            newShot.id +
            "]"
          ).trim();
          await updateIssueComment(
            selectedIssue.id,
            addingAttachmentToCommentId,
            newBody
          );
          setIssueComments((prev) =>
            prev.map((c) =>
              c.id === addingAttachmentToCommentId ? { ...c, body: newBody } : c
            )
          );
          setAddingAttachmentToCommentId(null);
        } else if (editingCommentId && editingCommentBlocks) {
          const nextBlocks: CommentBlock[] = [
            ...editingCommentBlocks,
            { kind: "screenshot", screenshotId: newShot.id },
          ];
          setEditingCommentBlocks(nextBlocks);
          const newBody = serializeEditingBlocksToBody(nextBlocks);
          const updatedComment = await updateIssueComment(
            selectedIssue.id,
            editingCommentId,
            newBody
          );
          setIssueComments((prev) =>
            prev.map((c) => (c.id === editingCommentId ? updatedComment : c))
          );
        } else if (editingCommentId) {
          const newBody = (
            editingCommentDraft.trim() +
            "\n[screenshot:" +
            newShot.id +
            "]"
          ).trim();
          const updatedComment = await updateIssueComment(
            selectedIssue.id,
            editingCommentId,
            newBody
          );
          setIssueComments((prev) =>
            prev.map((c) => (c.id === editingCommentId ? updatedComment : c))
          );
          setEditingCommentDraft(newBody);
        } else {
          insertCommentBlock({ kind: "screenshot", screenshotId: newShot.id });
        }
      }
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      ) {
        setScreenshotError(null);
        setIssueCommentsError(null);
      } else {
        const msg =
          err instanceof Error ? err.message : "Failed to take screenshot";
        setScreenshotError(msg);
        setIssueCommentsError(msg);
      }
    } finally {
      setScreenshotTaking(false);
      setScreenshotUploading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length && !selectedProjectId) setSelectedProjectId(data[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    }
  };

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIssues(selectedProjectId || undefined);
      setIssues(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load issues");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (editingProjectId) {
      projectNameInputRef.current?.focus();
      projectNameInputRef.current?.select();
    }
  }, [editingProjectId]);

  const saveProjectName = async () => {
    if (!editingProjectId) return;
    const name = editingProjectName.trim();
    if (!name) {
      setEditingProjectId(null);
      return;
    }
    const prev = projects.find((x) => x.id === editingProjectId);
    if (prev?.name === name) {
      setEditingProjectId(null);
      return;
    }
    try {
      const updated = await updateProject(editingProjectId, { name });
      setProjects((p) =>
        p.map((x) => (x.id === editingProjectId ? updated : x))
      );
    } catch {
      // Keep edit mode on error; user can retry or cancel
    } finally {
      setEditingProjectId(null);
    }
  };

  const cancelEditProjectName = () => {
    setEditingProjectId(null);
  };

  useEffect(() => {
    loadIssues();
  }, [selectedProjectId]);

  useEffect(() => {
    const issueId = router.query.issueId;
    if (!router.isReady || typeof issueId !== "string" || !issueId) return;
    fetchIssue(issueId)
      .then((issue) => {
        setSelectedProjectId(issue.projectId);
        setSelectedIssue(issue);
        setIssueDetailOriginal(issue);
        router.replace("/", undefined, { shallow: true });
      })
      .catch(() => {});
  }, [router.isReady, router.query.issueId]);

  useEffect(() => {
    if (createOpen) {
      loadUsers();
      setCreateError(null);
      // Pre-select first project so Create button works when "All projects" is selected in header
      if (projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projects[0].id);
      }
    }
  }, [createOpen]);

  useEffect(() => {
    if (createProjectOpen) {
      setProjectCreateError(null);
      fetchOrganizations()
        .then((data) => {
          setOrganizations(data);
          if (data.length > 0) setNewProjectOrgId(data[0].id);
        })
        .catch(() => setOrganizations([]));
    }
  }, [createProjectOpen]);

  // Keep modal's project selection in sync when projects load (e.g. after opening)
  useEffect(() => {
    if (createOpen && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [createOpen, projects, selectedProjectId]);

  useEffect(() => {
    if (!automatedTestDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        automatedTestDropdownRef.current &&
        !automatedTestDropdownRef.current.contains(e.target as Node)
      ) {
        setAutomatedTestDropdownOpen(false);
      }
    };
    // Use capture so we run before any child that might stopPropagation (e.g. modal overlay)
    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [automatedTestDropdownOpen]);

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [settingsMenuOpen]);

  useEffect(() => {
    if (!selectedIssue?.id) {
      setIssueComments([]);
      setIssueCommentDraft("");
      setDeletingCommentId(null);
      setEditingCommentId(null);
      setEditingCommentIssueId(null);
      setEditingCommentDraft("");
      setUpdatingCommentId(null);
      setCommentHistoryOpenId(null);
      setIssueCommentsError(null);
      setCommentBoxError(false);
      setPendingCommentAttachments([]);
      setAddingAttachmentToCommentId(null);
      setRecordingFor(null);
      recordingDestinationRef.current = null;
      return;
    }
    let cancelled = false;
    setIssueComments([]);
    setIssueCommentsLoading(true);
    setIssueCommentsError(null);
    fetchIssueComments(selectedIssue.id)
      .then((data) => {
        if (!cancelled) setIssueComments(data);
      })
      .catch((e) => {
        if (!cancelled)
          setIssueCommentsError(
            e instanceof Error ? e.message : "Failed to load comments"
          );
      })
      .finally(() => {
        if (!cancelled) setIssueCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIssue?.id]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    const previous = issues.find((i) => i.id === id);
    if (!previous || previous.status === newStatus) return;
    setError(null);
    const optimistic = { ...previous, status: newStatus };
    setIssues((prev) => prev.map((i) => (i.id === id ? optimistic : i)));
    if (selectedIssue?.id === id) {
      setSelectedIssue(optimistic);
      setIssueDetailOriginal(optimistic);
    }
    try {
      const updated = await updateIssueStatus(id, newStatus);
      setIssues((prev) => prev.map((i) => (i.id === id ? updated : i)));
      if (selectedIssue?.id === id) {
        setSelectedIssue(updated);
        setIssueDetailOriginal(updated);
      }
    } catch (e) {
      setIssues((prev) => prev.map((i) => (i.id === id ? previous : i)));
      if (selectedIssue?.id === id) {
        setSelectedIssue(previous);
        setIssueDetailOriginal(previous);
      }
      setError(
        e instanceof Error
          ? e.message
          : "Status change could not be saved. It will not persist after refresh."
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!createTitle.trim()) {
      setCreateError("Please enter a title.");
      return;
    }
    if (!selectedProjectId) {
      setCreateError("Please select a project.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const qualityScore = computeQualityScore({
        title: createTitle,
        description: createDescription,
        acceptanceCriteria: createAcceptanceCriteria,
        database: createDatabase,
        testCases: createTestCases,
      });
      const created = await createIssue({
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        acceptanceCriteria: createAcceptanceCriteria.trim() || undefined,
        database: createDatabase.trim() || undefined,
        api: createApi.trim() || undefined,
        testCases: createTestCases || undefined,
        projectId: selectedProjectId,
        assigneeId: createAssigneeId || undefined,
        qualityScore,
      });
      setIssues((prev) => [created, ...prev]);
      setCreateOpen(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateAcceptanceCriteria("");
      setCreateDatabase("");
      setCreateApi("");
      setCreateTestCases("");
      setCreateAssigneeId("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create issue";
      setCreateError(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    setProjectDeleting(true);
    setError(null);
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      if (selectedProjectId === projectToDelete.id) {
        setSelectedProjectId("");
        setIssues([]);
      }
      await loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setProjectDeleting(false);
    }
  };

  const handleDeleteIssue = async () => {
    if (!issueToDelete) return;
    setIssueDeleting(true);
    setError(null);
    try {
      await deleteIssue(issueToDelete.id);
      setIssues((prev) => prev.filter((i) => i.id !== issueToDelete.id));
      if (selectedIssue?.id === issueToDelete.id) {
        setSelectedIssue(null);
        setIssueDetailOriginal(null);
      }
      setIssueToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete issue");
    } finally {
      setIssueDeleting(false);
    }
  };

  const handleDeleteAllIssues = async () => {
    setDeleteAllDeleting(true);
    setError(null);
    try {
      await deleteAllIssues(selectedProjectId || undefined);
      setIssues([]);
      setSelectedIssue(null);
      setIssueDetailOriginal(null);
      setDeleteAllConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete issues");
    } finally {
      setDeleteAllDeleting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setProjectCreateError(null);
    const projectName = newProjectName.trim();
    if (!projectName) {
      setProjectCreateError("Please enter a project name.");
      return;
    }
    setProjectSubmitting(true);
    try {
      let orgId = newProjectOrgId;
      if (organizations.length === 0) {
        const orgName = newOrgName.trim() || "My Organization";
        const org = await createOrganization({ name: orgName });
        orgId = org.id;
        setOrganizations((prev) => [...prev, org]);
      } else if (!orgId) {
        setProjectCreateError("Please select an organization.");
        setProjectSubmitting(false);
        return;
      }
      const project = await createProject({
        name: projectName,
        organizationId: orgId,
      });
      setProjects((prev) => [...prev, project]);
      setSelectedProjectId(project.id);
      setCreateProjectOpen(false);
      setNewProjectName("");
      setNewProjectOrgId("");
      setNewOrgName("");
    } catch (e) {
      setProjectCreateError(
        e instanceof Error ? e.message : "Failed to create project"
      );
    } finally {
      setProjectSubmitting(false);
    }
  };

  const handleSaveIssue = async () => {
    if (!selectedIssue) return;
    setIssueSaving(true);
    setIssueSaveError(null);
    setIssueSaveSuccess(false);
    try {
      const qualityScore = computeQualityScore(selectedIssue);
      const body: Record<string, unknown> = {
        title: selectedIssue.title,
        description: selectedIssue.description ?? undefined,
        acceptanceCriteria: selectedIssue.acceptanceCriteria ?? undefined,
        database: selectedIssue.database ?? undefined,
        api: selectedIssue.api ?? undefined,
        testCases: selectedIssue.testCases ?? undefined,
        automatedTest: selectedIssue.automatedTest ?? undefined,
        qualityScore,
        status: selectedIssue.status,
        assigneeId: selectedIssue.assigneeId ?? undefined,
      };
      const updated = await updateIssue(selectedIssue.id, body);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelectedIssue(updated);
      setIssueDetailOriginal(updated);
      setIssueSaveSuccess(true);
    } catch (e) {
      setIssueSaveError(
        e instanceof Error ? e.message : "Failed to save issue"
      );
    } finally {
      setIssueSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedIssue?.id) return;
    const textParts: string[] = [];
    const attachments: Array<{
      type: CommentAttachmentType;
      imageBase64?: string;
      videoBase64?: string;
    }> = [];
    for (const block of commentBlocks) {
      if (block.kind === "text") {
        if (block.value.trim()) textParts.push(block.value.trim());
      } else if (block.kind === "attachment") {
        const label =
          block.name ??
          (block.attType === "screenshot"
            ? "Screenshot"
            : block.attType === "screen_recording"
              ? "Screen recording"
              : block.attType === "camera_recording"
                ? "Camera recording"
                : "Video");
        textParts.push(`[${label}]`);
        if (block.attType === "screenshot" && block.imageBase64) {
          attachments.push({
            type: "screenshot",
            imageBase64: block.imageBase64,
          });
        } else if (block.videoBase64) {
          attachments.push({
            type: block.attType,
            videoBase64: block.videoBase64,
          });
        }
      } else if (block.kind === "recording" && selectedIssue.recordings) {
        const rec = selectedIssue.recordings.find(
          (r) => r.id === block.recordingId
        );
        if (rec) {
          const url = rec.videoUrl ?? "";
          const kf = url.includes("-audio.webm")
            ? "audio"
            : url.includes("-camera.webm")
              ? "camera"
              : url.includes("-screen.webm")
                ? "screen"
                : null;
          const isAudio = rec.mediaType === "audio" || kf === "audio";
          const kind: "audio" | "screen" | "camera" = isAudio
            ? "audio"
            : ((kf as "screen" | "camera" | null) ??
              rec.recordingType ??
              "screen");
          const rIdx = selectedIssue.recordings.indexOf(rec) + 1;
          const defaultLabel =
            kind === "audio"
              ? `Audio Recording ${rIdx}`
              : kind === "camera"
                ? `Camera Recording ${rIdx}`
                : `Screen Recording ${rIdx}`;
          textParts.push(`[${rec.name ?? defaultLabel}]`);
        }
      } else if (block.kind === "screenshot" && selectedIssue.screenshots) {
        const shot = selectedIssue.screenshots.find(
          (s) => s.id === block.screenshotId
        );
        if (shot) {
          textParts.push(`[screenshot:${block.screenshotId}]`);
        }
      } else if (block.kind === "file" && selectedIssue.files) {
        const f = selectedIssue.files.find((x) => x.id === block.fileId);
        if (f) textParts.push(`[${f.fileName}]`);
      }
    }
    const commentBody = textParts.join("\n");
    if (!commentBody) {
      setCommentBoxError(true);
      return;
    }
    setCommentBoxError(false);
    setIssueCommentSubmitting(true);
    setIssueCommentsError(null);
    try {
      const comment = await createIssueComment(selectedIssue.id, commentBody);
      let updatedComment = comment;
      for (const att of attachments) {
        if (att.type === "screenshot" && att.imageBase64) {
          updatedComment = await addCommentAttachment(
            selectedIssue.id,
            comment.id,
            { type: "screenshot", imageBase64: att.imageBase64 }
          );
        } else if (att.videoBase64) {
          updatedComment = await addCommentAttachment(
            selectedIssue.id,
            comment.id,
            { type: att.type, videoBase64: att.videoBase64 }
          );
        }
      }
      setIssueComments((prev) => [...prev, updatedComment]);
      setIssueCommentDraft("");
      setCommentDraftRecordingId(null);
      setCommentBlocks([{ kind: "text", value: "" }]);
      activeCommentBlockRef.current = 0;
      setPendingCommentAttachments([]);
      setViewingPendingAttachmentIndex(null);
      setViewingBlockIndex(null);
    } catch (e) {
      setIssueCommentsError(
        e instanceof Error ? e.message : "Failed to add comment"
      );
    } finally {
      setIssueCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedIssue?.id) return;
    setDeletingCommentId(commentId);
    setIssueCommentsError(null);
    try {
      await deleteIssueComment(selectedIssue.id, commentId);
      setIssueComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete comment";
      if (msg.includes("already be deleted") || msg.includes("not found")) {
        setIssueComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        setIssueCommentsError(msg);
      }
    } finally {
      setDeletingCommentId(null);
    }
  };

  /** Parse stored comment body into blocks so refs (screenshot/recording/file) can be shown as non-editable. */
  const parseCommentBodyToBlocks = (
    body: string,
    issue: Issue | null
  ): CommentBlock[] => {
    if (!body.trim() && !issue) return [{ kind: "text", value: "" }];
    if (!issue?.recordings && !issue?.screenshots && !issue?.files)
      return [{ kind: "text", value: body }];
    const filePattern = /(comment-[a-z0-9]+-\d+\.webm|\[[^\]]+\])/gi;
    let lastIndex = 0;
    const blocks: CommentBlock[] = [];
    let m: RegExpExecArray | null;
    while ((m = filePattern.exec(body)) !== null) {
      if (m.index > lastIndex) {
        blocks.push({ kind: "text", value: body.slice(lastIndex, m.index) });
      }
      const raw = m[1];
      const isBracket = raw.startsWith("[") && raw.endsWith("]");
      const label = isBracket ? raw.slice(1, -1) : raw;
      if (isBracket && label.startsWith("screenshot:")) {
        const id = label.slice("screenshot:".length);
        if (issue?.screenshots?.some((s) => s.id === id))
          blocks.push({ kind: "screenshot", screenshotId: id });
        else blocks.push({ kind: "text", value: raw });
      } else if (issue?.recordings) {
        const rec = issue.recordings.find((r) => {
          const url = r.videoUrl ?? "";
          const kf = url.includes("-audio.webm")
            ? "audio"
            : url.includes("-camera.webm")
              ? "camera"
              : url.includes("-screen.webm")
                ? "screen"
                : null;
          const kind: "audio" | "screen" | "camera" =
            r.mediaType === "audio" || kf === "audio"
              ? "audio"
              : ((kf as "screen" | "camera" | null) ??
                r.recordingType ??
                "screen");
          const rIdx = issue.recordings!.indexOf(r) + 1;
          const defaultLabel =
            kind === "audio"
              ? `Audio Recording ${rIdx}`
              : kind === "camera"
                ? `Camera Recording ${rIdx}`
                : `Screen Recording ${rIdx}`;
          return (r.name ?? defaultLabel) === label || defaultLabel === label;
        });
        if (rec) blocks.push({ kind: "recording", recordingId: rec.id });
        else if (issue?.files) {
          const f = issue.files.find((x) => x.fileName === label);
          if (f) blocks.push({ kind: "file", fileId: f.id });
          else blocks.push({ kind: "text", value: raw });
        } else blocks.push({ kind: "text", value: raw });
      } else if (issue?.files) {
        const f = issue.files.find((x) => x.fileName === label);
        if (f) blocks.push({ kind: "file", fileId: f.id });
        else blocks.push({ kind: "text", value: raw });
      } else {
        blocks.push({ kind: "text", value: raw });
      }
      lastIndex = filePattern.lastIndex;
    }
    if (lastIndex < body.length)
      blocks.push({ kind: "text", value: body.slice(lastIndex) });
    if (blocks.length === 0) blocks.push({ kind: "text", value: "" });
    // Ensure there is always a leading and trailing text block so the user can add text above/below attachments (same as new comment).
    if (blocks[0]?.kind !== "text") blocks.unshift({ kind: "text", value: "" });
    if (blocks[blocks.length - 1]?.kind !== "text")
      blocks.push({ kind: "text", value: "" });
    return blocks;
  };

  const serializeEditingBlocksToBody = (blocks: CommentBlock[]): string => {
    const textParts: string[] = [];
    for (const block of blocks) {
      if (block.kind === "text" && block.value.trim())
        textParts.push(block.value.trim());
      else if (block.kind === "recording" && selectedIssue?.recordings) {
        const rec = selectedIssue.recordings.find(
          (r) => r.id === block.recordingId
        );
        if (rec) {
          const url = rec.videoUrl ?? "";
          const kf = url.includes("-audio.webm")
            ? "audio"
            : url.includes("-camera.webm")
              ? "camera"
              : url.includes("-screen.webm")
                ? "screen"
                : null;
          const kind: "audio" | "screen" | "camera" =
            rec.mediaType === "audio" || kf === "audio"
              ? "audio"
              : ((kf as "screen" | "camera" | null) ??
                rec.recordingType ??
                "screen");
          const rIdx = selectedIssue.recordings.indexOf(rec) + 1;
          const defaultLabel =
            kind === "audio"
              ? `Audio Recording ${rIdx}`
              : kind === "camera"
                ? `Camera Recording ${rIdx}`
                : `Screen Recording ${rIdx}`;
          textParts.push(`[${rec.name ?? defaultLabel}]`);
        }
      } else if (block.kind === "screenshot" && selectedIssue?.screenshots) {
        const shot = selectedIssue.screenshots.find(
          (s) => s.id === block.screenshotId
        );
        if (shot) textParts.push(`[screenshot:${block.screenshotId}]`);
      } else if (block.kind === "file" && selectedIssue?.files) {
        const f = selectedIssue.files.find((x) => x.id === block.fileId);
        if (f) textParts.push(`[${f.fileName}]`);
      }
      // skip 'attachment' blocks when editing (they are pending uploads in new comment only)
    }
    return textParts.join("\n");
  };

  const handleStartEditComment = (c: IssueComment) => {
    setEditingCommentId(c.id);
    setEditingCommentIssueId(c.issueId);
    setEditingCommentDraft(c.body);
    setEditingCommentBlocks(
      parseCommentBodyToBlocks(c.body, selectedIssue ?? null)
    );
    setIssueCommentsError(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentIssueId(null);
    setEditingCommentDraft("");
    setEditingCommentBlocks(null);
  };

  const removeEditingCommentBlock = (blockIdx: number) => {
    setEditingCommentBlocks((prev) => {
      if (!prev || blockIdx < 0 || blockIdx >= prev.length) return prev;
      const next = prev.filter((_, i) => i !== blockIdx);
      if (next.length === 0) return [{ kind: "text", value: "" }];
      if (
        blockIdx > 0 &&
        blockIdx < next.length &&
        next[blockIdx - 1]?.kind === "text" &&
        next[blockIdx]?.kind === "text"
      ) {
        const merged =
          (next[blockIdx - 1] as CommentBlockText).value +
          (next[blockIdx] as CommentBlockText).value;
        return [
          ...next.slice(0, blockIdx - 1),
          { kind: "text", value: merged } as CommentBlock,
          ...next.slice(blockIdx + 1),
        ];
      }
      return next;
    });
  };

  const insertEditingCommentBlock = (block: CommentBlock) => {
    setEditingCommentBlocks((prev) => {
      const list = prev ?? [{ kind: "text", value: "" }];
      const idx = list.length - 1;
      const before = list.slice(0, idx + 1);
      const after = list.slice(idx + 1);
      return [
        ...before,
        block,
        { kind: "text", value: "" } as CommentBlock,
        ...after,
      ];
    });
  };

  const handleSaveComment = async () => {
    const issueId = editingCommentIssueId ?? selectedIssue?.id;
    if (!issueId || !editingCommentId) return;
    const body = editingCommentBlocks
      ? serializeEditingBlocksToBody(editingCommentBlocks)
      : editingCommentDraft.trim();
    if (!body) return;
    setUpdatingCommentId(editingCommentId);
    setIssueCommentsError(null);
    try {
      const updated = await updateIssueComment(issueId, editingCommentId, body);
      setIssueComments((prev) =>
        prev.map((c) => (c.id === editingCommentId ? updated : c))
      );
      setEditingCommentId(null);
      setEditingCommentIssueId(null);
      setEditingCommentDraft("");
      setEditingCommentBlocks(null);
    } catch (e) {
      setIssueCommentsError(
        e instanceof Error ? e.message : "Failed to update comment"
      );
    } finally {
      setUpdatingCommentId(null);
    }
  };

  const handleCommentScreenshotFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setIssueCommentsError("Please select an image file");
      return;
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (addingAttachmentToCommentId && selectedIssue) {
      setCommentAttachmentUploading(true);
      setIssueCommentsError(null);
      try {
        const updated = await addCommentAttachment(
          selectedIssue.id,
          addingAttachmentToCommentId,
          { type: "screenshot", imageBase64: base64 }
        );
        setIssueComments((prev) =>
          prev.map((c) => (c.id === addingAttachmentToCommentId ? updated : c))
        );
        setAddingAttachmentToCommentId(null);
      } catch (err) {
        setIssueCommentsError(
          err instanceof Error ? err.message : "Failed to add screenshot"
        );
      } finally {
        setCommentAttachmentUploading(false);
      }
    } else {
      insertCommentBlock({
        kind: "attachment",
        attType: "screenshot",
        imageBase64: base64,
      });
    }
  };

  const handleCommentVideoFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedIssue) return;
    const kind = classifyFile(file);
    const commentIdForAttachment =
      addingAttachmentToCommentId ?? editingCommentId;
    // When not adding to an existing comment: upload to the corresponding issue section and add a block (button that scrolls to that section).
    if (!commentIdForAttachment) {
      if (kind === "recording") {
        setCommentAttachmentUploading(true);
        setRecordingUploading(true);
        setIssueCommentsError(null);
        setRecordingError(null);
        try {
          const base64 = await blobToBase64(file);
          const mediaType = file.type.startsWith("audio/") ? "audio" : "video";
          const recordingType = mediaType === "audio" ? "audio" : "screen";
          const updated = await uploadIssueRecording(
            selectedIssue.id,
            base64,
            mediaType,
            recordingType,
            file.name
          );
          lockScrollPosition();
          setIssues((prev) =>
            prev.map((j) => (j.id === updated.id ? updated : j))
          );
          setSelectedIssue(updated);
          setIssueDetailOriginal(updated);
          const newRec = updated.recordings?.find(
            (r) => !selectedIssue.recordings?.some((old) => old.id === r.id)
          );
          if (newRec)
            insertCommentBlock({ kind: "recording", recordingId: newRec.id });
        } catch (err) {
          setIssueCommentsError(
            err instanceof Error ? err.message : "Failed to upload recording"
          );
        } finally {
          setCommentAttachmentUploading(false);
          setRecordingUploading(false);
        }
        return;
      }
      if (kind === "screenshot") {
        setCommentAttachmentUploading(true);
        setScreenshotUploading(true);
        setIssueCommentsError(null);
        setScreenshotError(null);
        try {
          const base64 = await blobToBase64(file);
          const updated = await uploadIssueScreenshot(
            selectedIssue.id,
            base64,
            file.name
          );
          const nameToShow = (file.name ?? "").trim() || undefined;
          const patched =
            nameToShow && updated.screenshots
              ? {
                  ...updated,
                  screenshots: updated.screenshots.map((s) => {
                    const isNew = !selectedIssue.screenshots?.some(
                      (old) => old.id === s.id
                    );
                    if (isNew && !(s.name ?? "").trim())
                      return { ...s, name: nameToShow };
                    return s;
                  }),
                }
              : updated;
          lockScrollPosition();
          setIssues((prev) =>
            prev.map((j) => (j.id === patched.id ? patched : j))
          );
          setSelectedIssue(patched);
          setIssueDetailOriginal(patched);
          const newShot = patched.screenshots?.find(
            (s) => !selectedIssue.screenshots?.some((old) => old.id === s.id)
          );
          if (newShot)
            insertCommentBlock({
              kind: "screenshot",
              screenshotId: newShot.id,
              name: file.name,
            });
        } catch (err) {
          setIssueCommentsError(
            err instanceof Error ? err.message : "Failed to upload screenshot"
          );
        } finally {
          setCommentAttachmentUploading(false);
          setScreenshotUploading(false);
        }
        return;
      }
      if (kind === "file") {
        setCommentAttachmentUploading(true);
        setFileUploading(true);
        setIssueCommentsError(null);
        setFileError(null);
        try {
          const base64 = await blobToBase64(file);
          const updated = await uploadIssueFile(
            selectedIssue.id,
            base64,
            file.name
          );
          lockScrollPosition();
          setIssues((prev) =>
            prev.map((j) => (j.id === updated.id ? updated : j))
          );
          setSelectedIssue(updated);
          setIssueDetailOriginal(updated);
          const newFile = updated.files?.find(
            (f) => !selectedIssue.files?.some((old) => old.id === f.id)
          );
          if (newFile) insertCommentBlock({ kind: "file", fileId: newFile.id });
        } catch (err) {
          setIssueCommentsError(
            err instanceof Error ? err.message : "Failed to upload file"
          );
        } finally {
          setCommentAttachmentUploading(false);
          setFileUploading(false);
        }
        return;
      }
    }
    const appendNewAttachmentRefsToDraft = (updated: {
      attachments?: { mediaUrl: string }[];
    }) => {
      if (commentIdForAttachment !== editingCommentId || !updated) return;
      const prevComment = issueComments.find((x) => x.id === editingCommentId);
      const prevUrls = new Set(
        (prevComment?.attachments ?? []).map((a) => a.mediaUrl)
      );
      const newAttachments = (updated.attachments ?? []).filter(
        (a) => !prevUrls.has(a.mediaUrl)
      );
      if (newAttachments.length > 0) {
        const refs = newAttachments.map((a) => {
          const filename = a.mediaUrl.replace(/^.*\//, "");
          return filename.endsWith(".webm") ? filename : `[${filename}]`;
        });
        const refText = refs.join("\n");
        if (editingCommentBlocks) {
          setEditingCommentBlocks((prev) => {
            if (!prev?.length) return [{ kind: "text", value: refText }];
            const last = prev[prev.length - 1];
            if (last.kind === "text")
              return [
                ...prev.slice(0, -1),
                {
                  kind: "text",
                  value: (
                    last.value +
                    (last.value ? "\n" : "") +
                    refText
                  ).trim(),
                } as CommentBlock,
              ];
            return [...prev, { kind: "text", value: refText } as CommentBlock];
          });
        } else {
          setEditingCommentDraft((prev) =>
            (prev.trim() + "\n" + refText).trim()
          );
        }
      }
    };

    setCommentAttachmentUploading(true);
    setRecordingUploading(true);
    setIssueCommentsError(null);
    try {
      const base64 = await blobToBase64(file);
      if (commentIdForAttachment) {
        if (kind === "screenshot") {
          setScreenshotUploading(true);
          setScreenshotError(null);
          setIssueCommentsError(null);
          const updated = await uploadIssueScreenshot(
            selectedIssue.id,
            base64,
            file.name
          );
          const nameToShow = (file.name ?? "").trim() || undefined;
          const patched =
            nameToShow && updated.screenshots
              ? {
                  ...updated,
                  screenshots: updated.screenshots.map((s) => {
                    const isNew = !selectedIssue.screenshots?.some(
                      (old) => old.id === s.id
                    );
                    if (isNew && !(s.name ?? "").trim())
                      return { ...s, name: nameToShow };
                    return s;
                  }),
                }
              : updated;
          lockScrollPosition();
          setIssues((prev) =>
            prev.map((j) => (j.id === patched.id ? patched : j))
          );
          setSelectedIssue(patched);
          setIssueDetailOriginal(patched);
          const newShot = patched.screenshots?.find(
            (s) => !selectedIssue.screenshots?.some((old) => old.id === s.id)
          );
          if (newShot) {
            if (
              commentIdForAttachment === editingCommentId &&
              editingCommentBlocks
            ) {
              const nextBlocks: CommentBlock[] = [
                ...editingCommentBlocks,
                { kind: "screenshot", screenshotId: newShot.id },
              ];
              setEditingCommentBlocks(nextBlocks);
              const newBody = serializeEditingBlocksToBody(nextBlocks);
              const updatedComment = await updateIssueComment(
                selectedIssue.id,
                editingCommentId,
                newBody
              );
              setIssueComments((prev) =>
                prev.map((c) =>
                  c.id === editingCommentId ? updatedComment : c
                )
              );
              setAddingAttachmentToCommentId(null);
            } else if (commentIdForAttachment === editingCommentId) {
              setEditingCommentDraft((prev) =>
                (prev.trim() + "\n[screenshot:" + newShot.id + "]").trim()
              );
              setAddingAttachmentToCommentId(null);
            } else {
              const comment = issueComments.find(
                (c) => c.id === commentIdForAttachment
              );
              const newBody = (
                (comment?.body ?? "").trim() +
                "\n[screenshot:" +
                newShot.id +
                "]"
              ).trim();
              const updatedComment = await updateIssueComment(
                selectedIssue.id,
                commentIdForAttachment,
                newBody
              );
              setIssueComments((prev) =>
                prev.map((c) =>
                  c.id === commentIdForAttachment ? updatedComment : c
                )
              );
              setAddingAttachmentToCommentId(null);
            }
          }
          setScreenshotUploading(false);
        } else {
          const updated = await addCommentAttachment(
            selectedIssue.id,
            commentIdForAttachment,
            { type: "video", videoBase64: base64 }
          );
          setIssueComments((prev) =>
            prev.map((c) => (c.id === commentIdForAttachment ? updated : c))
          );
          appendNewAttachmentRefsToDraft(updated);
          setAddingAttachmentToCommentId(null);
        }
      } else {
        insertCommentBlock({
          kind: "attachment",
          attType: "video",
          videoBase64: base64,
          name: file.name,
        });
      }
    } catch (err) {
      setIssueCommentsError(
        err instanceof Error ? err.message : "Failed to add attachment"
      );
    } finally {
      setCommentAttachmentUploading(false);
      setRecordingUploading(false);
    }
  };

  const insertCommentBlock = (block: CommentBlock) => {
    setCommentBlocks((prev) => {
      // Keep one text area: always append attachments after the single text block.
      if (prev[0]?.kind === "text") {
        return [prev[0], block, ...prev.slice(1)];
      }
      return [block, ...prev];
    });
  };

  const removeCommentBlock = (blockIdx: number) => {
    setCommentBlocks((prev) => {
      const next = prev.filter((_, i) => i !== blockIdx);
      if (next.length === 0 || next.every((b) => b.kind !== "text")) {
        next.push({ kind: "text", value: "" });
      }
      const textBefore = blockIdx > 0 && next[blockIdx - 1]?.kind === "text";
      const textAfter = next[blockIdx]?.kind === "text";
      if (textBefore && textAfter) {
        const merged =
          (next[blockIdx - 1] as CommentBlockText).value +
          "\n" +
          (next[blockIdx] as CommentBlockText).value;
        return [
          ...next.slice(0, blockIdx - 1),
          { kind: "text", value: merged } as CommentBlock,
          ...next.slice(blockIdx + 1),
        ];
      }
      return next;
    });
    setViewingBlockIndex(null);
  };

  const handleRemovePendingAttachment = (index: number) => {
    setPendingCommentAttachments((prev) => prev.filter((_, i) => i !== index));
    setViewingPendingAttachmentIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const handleDeleteCommentAttachment = async (
    commentId: string,
    attachmentId: string
  ) => {
    if (!selectedIssue) return;
    setIssueCommentsError(null);
    try {
      const updated = await deleteCommentAttachment(
        selectedIssue.id,
        commentId,
        attachmentId
      );
      setIssueComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
    } catch (e) {
      setIssueCommentsError(
        e instanceof Error ? e.message : "Failed to remove attachment"
      );
    }
  };

  const issuesByStatus = STATUSES.reduce(
    (acc, { id }) => {
      acc[id] = issues.filter((i) => i.status === id);
      return acc;
    },
    {} as Record<string, Issue[]>
  );

  // While dragging, show the ticket in the lane we're over (transition state)
  const issuesByStatusForDisplay = React.useMemo(() => {
    if (!draggingIssueId || !dragOverColumnId) return issuesByStatus;
    const dragged = issues.find((i) => i.id === draggingIssueId);
    if (!dragged) return issuesByStatus;
    const result = { ...issuesByStatus };
    result[dragged.status] = (result[dragged.status] ?? []).filter(
      (i) => i.id !== draggingIssueId
    );
    result[dragOverColumnId] = [...(result[dragOverColumnId] ?? []), dragged];
    return result;
  }, [issuesByStatus, draggingIssueId, dragOverColumnId, issues]);

  return (
    <>
      <div className="app-layout">
        <aside
          className={`drawer ${drawerOpen ? "drawer-open" : "drawer-closed"}`}
        >
          {drawerOpen ? (
            <>
              <div className="drawer-logo" aria-hidden>
                IH
              </div>
              <div className="drawer-header">
                <div className="drawer-title">Idea Home</div>
                <button
                  type="button"
                  className="drawer-toggle"
                  onClick={() => setDrawerOpen((o) => !o)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                >
                  ◀
                </button>
              </div>
              <div className="drawer-content">
                <nav className="drawer-nav">
                  <Link href="/" className="drawer-nav-item is-selected">
                    Dashboard
                  </Link>
                  <Link href="/todo" className="drawer-nav-item">
                    To-Do
                  </Link>
                  <div className="drawer-nav-label">Projects</div>
                  {projects.map((p) => (
                    <div key={p.id} className="drawer-nav-item-row">
                      {editingProjectId === p.id ? (
                        <input
                          ref={projectNameInputRef}
                          type="text"
                          className="drawer-nav-item drawer-nav-item-input"
                          value={editingProjectName}
                          onChange={(e) =>
                            setEditingProjectName(e.target.value)
                          }
                          onBlur={saveProjectName}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveProjectName();
                            if (e.key === "Escape") cancelEditProjectName();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Project name"
                        />
                      ) : (
                        <button
                          type="button"
                          className={`drawer-nav-item ${selectedProjectId === p.id ? "is-selected" : ""}`}
                          onClick={() => setSelectedProjectId(p.id)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingProjectId(p.id);
                            setEditingProjectName(p.name);
                          }}
                          title="Double-click to edit name"
                        >
                          {p.name}
                        </button>
                      )}
                      <button
                        type="button"
                        className="drawer-nav-item-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(p);
                        }}
                        aria-label={`Delete ${p.name}`}
                        title={`Delete project "${p.name}"`}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="drawer-nav-item drawer-nav-item-action"
                    onClick={() => setCreateProjectOpen(true)}
                  >
                    + New project
                  </button>
                </nav>
              </div>
              <div className="drawer-footer">
                <button
                  type="button"
                  className="drawer-footer-btn"
                  aria-label="Feedback"
                >
                  💬
                </button>
                <button
                  type="button"
                  className="drawer-footer-btn"
                  aria-label={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                  onClick={toggleTheme}
                  title={
                    theme === "light"
                      ? "Switch to dark theme"
                      : "Switch to light theme"
                  }
                >
                  {theme === "light" ? "🌙" : "☀️"}
                </button>
                <div
                  ref={settingsMenuRef}
                  className="drawer-footer-settings-wrap"
                >
                  <button
                    type="button"
                    className={`drawer-footer-btn${settingsMenuOpen ? " is-active" : ""}`}
                    aria-label="Settings & admin"
                    aria-expanded={settingsMenuOpen}
                    aria-haspopup="true"
                    title="Settings & admin"
                    onClick={() => setSettingsMenuOpen((v) => !v)}
                  >
                    ⚙
                  </button>
                  {settingsMenuOpen && (
                    <div className="drawer-settings-menu" role="menu">
                      <button
                        type="button"
                        className="drawer-settings-menu-item"
                        role="menuitem"
                        disabled={loading || issues.length === 0}
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          setDeleteAllConfirmOpen(true);
                        }}
                        title={
                          issues.length === 0
                            ? "No issues to delete"
                            : "Delete all issues"
                        }
                        aria-label="Delete all issues"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <DrawerCollapsedNav
              activeTab="board"
              onExpand={() => setDrawerOpen(true)}
            />
          )}
        </aside>

        <main className="main-content">
          <ProjectNavBar
            projectName={
              projects.find((p) => p.id === selectedProjectId)?.name ??
              (selectedProjectId ? "Project" : "Select a project")
            }
            projectId={selectedProjectId || undefined}
            activeTab="board"
            searchPlaceholder="Search project"
            onAddClick={() => setCreateOpen(true)}
          />

          {error && (
            <div
              className="error-banner"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss"
                title="Dismiss"
                style={{
                  background: "none",
                  border: "none",
                  padding: "0 4px",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  opacity: 0.8,
                }}
              >
                ×
              </button>
            </div>
          )}

          <div className="board-container">
            {loading ? (
              <div className="loading">Loading issues…</div>
            ) : (
              <div className="board-columns">
                {STATUSES.map(({ id, label }) => {
                  const handleColumnDragOver = (e: React.DragEvent) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  };
                  const handleColumnDrop = (e: React.DragEvent) => {
                    e.preventDefault();
                    setDragOverColumnId(null);
                    const issueId = e.dataTransfer.getData(DRAG_ISSUE_KEY);
                    if (!issueId) return;
                    const issue = issues.find((i) => i.id === issueId);
                    if (issue && issue.status !== id) {
                      handleStatusChange(issueId, id);
                    }
                  };
                  const handleColumnDragEnter = () => setDragOverColumnId(id);
                  const handleColumnDragLeave = (e: React.DragEvent) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverColumnId(null);
                    }
                  };
                  const columnIssues = issuesByStatusForDisplay[id] ?? [];
                  const isPreviewColumn =
                    dragOverColumnId === id && draggingIssueId;
                  return (
                    <div
                      key={id}
                      className={`column column-${id}${dragOverColumnId === id ? " column-drop-target" : ""}`}
                      onDragOver={handleColumnDragOver}
                      onDrop={handleColumnDrop}
                      onDragEnter={handleColumnDragEnter}
                      onDragLeave={handleColumnDragLeave}
                    >
                      <div className="column-header">
                        <span className="column-title">{label}</span>
                        <span className="column-count">
                          {columnIssues.length}
                        </span>
                      </div>
                      {columnIssues.map((issue) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          columnStatusId={id}
                          onStatusChange={handleStatusChange}
                          onSelect={(issue) => {
                            setSelectedIssue(issue);
                            setIssueDetailOriginal(issue);
                          }}
                          onDragStart={setDraggingIssueId}
                          onDragEnd={() => {
                            setDraggingIssueId(null);
                            setDragOverColumnId(null);
                          }}
                          isPreview={
                            !!(isPreviewColumn && issue.id === draggingIssueId)
                          }
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {createOpen && (
            <div
              className="modal-overlay"
              onClick={() => !submitting && setCreateOpen(false)}
            >
              <div
                className="modal modal--fit-screen"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2>Create Deck</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => !submitting && setCreateOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleCreate}>
                  {createError && (
                    <div
                      className="error-banner"
                      style={{
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>{createError}</span>
                      <button
                        type="button"
                        onClick={() => setCreateError(null)}
                        aria-label="Dismiss"
                        title="Dismiss"
                        style={{
                          background: "none",
                          border: "none",
                          padding: "0 4px",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: 1,
                          opacity: 0.8,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="create-deck-project">Project</label>
                    <select
                      id="create-deck-project"
                      className="form-select"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      required
                    >
                      <option value="">Select a project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {projects.length === 0 && (
                      <span className="form-hint">
                        No projects yet. Create one via the API or add seed
                        data.
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Title</label>
                    <input
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="Summary"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      placeholder="Add more details…"
                    />
                  </div>
                  <div className="form-group">
                    <label>Acceptance Criteria</label>
                    <textarea
                      value={createAcceptanceCriteria}
                      onChange={(e) =>
                        setCreateAcceptanceCriteria(e.target.value)
                      }
                      placeholder="e.g. User can log in, Form validates input…"
                    />
                  </div>
                  <div className="form-group">
                    <label>Database</label>
                    <input
                      value={createDatabase}
                      onChange={(e) => setCreateDatabase(e.target.value)}
                      placeholder="Input Database Information..."
                    />
                  </div>
                  <div className="form-group">
                    <label>API</label>
                    <input
                      value={createApi}
                      onChange={(e) => setCreateApi(e.target.value)}
                      placeholder="API"
                    />
                  </div>
                  <div className="form-group">
                    <label>Test Cases</label>
                    {(() => {
                      const lines = parseTestCases(createTestCases);
                      const updateCases = (nextLines: string[]) => {
                        setCreateTestCases(serializeTestCases(nextLines) ?? "");
                      };
                      return (
                        <div className="test-cases-list">
                          {lines.map((line, idx) => (
                            <div key={idx} className="test-case-row">
                              <div className="test-case-field">
                                <AutoResizeTextarea
                                  value={line}
                                  onChange={(e) => {
                                    const next = [...lines];
                                    next[idx] = e.target.value;
                                    updateCases(next);
                                  }}
                                  placeholder="e.g. Given X when Y then Z"
                                  className={
                                    idx > 0 ? "test-case-input-with-action" : ""
                                  }
                                />
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    className="btn btn-icon test-case-remove"
                                    onClick={() => {
                                      const next = lines.filter(
                                        (_, i) => i !== idx
                                      );
                                      updateCases(next.length ? next : [""]);
                                    }}
                                    aria-label="Remove test case"
                                    title="Remove test case"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => updateCases([...lines, ""])}
                          >
                            + Add test case
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="form-group">
                    <label>Assigned To</label>
                    <select
                      className="form-select"
                      value={createAssigneeId}
                      onChange={(e) => setCreateAssigneeId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => !submitting && setCreateOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? "Creating…" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {projectToDelete && (
            <div
              className="modal-overlay"
              onClick={() => !projectDeleting && setProjectToDelete(null)}
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 400 }}
              >
                <div className="modal-header">
                  <h2>Delete project</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => !projectDeleting && setProjectToDelete(null)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
                  Delete &quot;{projectToDelete.name}&quot;? This will
                  permanently remove the project and all its issues.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => !projectDeleting && setProjectToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: "var(--danger, #c53030)" }}
                    onClick={handleDeleteProject}
                    disabled={projectDeleting}
                  >
                    {projectDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {issueToDelete && (
            <div
              className="modal-overlay modal-overlay--above-detail"
              onClick={() => !issueDeleting && setIssueToDelete(null)}
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 400 }}
              >
                <div className="modal-header">
                  <h2>Delete issue</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() => !issueDeleting && setIssueToDelete(null)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
                  Delete &quot;{issueToDelete.title || "Untitled"}&quot;? This
                  will permanently remove the issue.
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => !issueDeleting && setIssueToDelete(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: "var(--danger, #c53030)" }}
                    onClick={handleDeleteIssue}
                    disabled={issueDeleting}
                  >
                    {issueDeleting ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {deleteAllConfirmOpen && (
            <div
              className="modal-overlay"
              onClick={() =>
                !deleteAllDeleting && setDeleteAllConfirmOpen(false)
              }
            >
              <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 400 }}
              >
                <div className="modal-header">
                  <h2>Delete all issues</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() =>
                      !deleteAllDeleting && setDeleteAllConfirmOpen(false)
                    }
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>
                  {selectedProjectId
                    ? "Permanently delete all issues in this project?"
                    : "Permanently delete all issues? This cannot be undone."}
                </p>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      !deleteAllDeleting && setDeleteAllConfirmOpen(false)
                    }
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: "var(--danger, #c53030)" }}
                    onClick={handleDeleteAllIssues}
                    disabled={deleteAllDeleting}
                  >
                    {deleteAllDeleting ? "Deleting…" : "Delete all"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createProjectOpen && (
            <div
              className="modal-overlay"
              onClick={() => !projectSubmitting && setCreateProjectOpen(false)}
            >
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Create project</h2>
                  <button
                    type="button"
                    className="modal-close"
                    onClick={() =>
                      !projectSubmitting && setCreateProjectOpen(false)
                    }
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <form onSubmit={handleCreateProject}>
                  {projectCreateError && (
                    <div
                      className="error-banner"
                      style={{
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span>{projectCreateError}</span>
                      <button
                        type="button"
                        onClick={() => setProjectCreateError(null)}
                        aria-label="Dismiss"
                        title="Dismiss"
                        style={{
                          background: "none",
                          border: "none",
                          padding: "0 4px",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: 1,
                          opacity: 0.8,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                  {organizations.length === 0 ? (
                    <div className="form-group">
                      <label>Organization name</label>
                      <input
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder="My Organization"
                      />
                      <span className="form-hint">
                        No organizations yet. Enter a name to create one with
                        this project.
                      </span>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label htmlFor="create-project-org">Organization</label>
                      <select
                        id="create-project-org"
                        className="form-select"
                        value={newProjectOrgId}
                        onChange={(e) => setNewProjectOrgId(e.target.value)}
                        required
                      >
                        <option value="">Select an organization</option>
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Project name</label>
                    <input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g. Engineering, Marketing"
                      required
                      autoFocus={organizations.length > 0}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        !projectSubmitting && setCreateProjectOpen(false)
                      }
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={projectSubmitting}
                    >
                      {projectSubmitting ? "Creating…" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedIssue && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (isRecording) return;
            setSelectedIssue(null);
            setIssueDetailOriginal(null);
            setIssueSaveError(null);
            setIssueSaveSuccess(false);
            setAutomatedTestDropdownOpen(false);
            setPlayingRecordingId(null);
            setEditingRecordingId(null);
            setEditingScreenshotId(null);
            setEditingFileId(null);
            setRecordingError(null);
            setRecordingPlaybackError(null);
            setScreenshotError(null);
            setFileError(null);
          }}
        >
          <div
            ref={issueDetailModalScrollRef}
            className={`modal modal--fit-screen modal--issue-detail${dragOverCount > 0 ? " is-drag-over" : ""}`}
            onClick={(e) => e.stopPropagation()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={
              dragOverCount > 0
                ? {
                    outline: "3px dashed var(--primary, #3182ce)",
                    outlineOffset: -2,
                  }
                : undefined
            }
          >
            <div className="modal-header">
              <h2>{issueKey(selectedIssue)}</h2>
              <div className="modal-header-actions">
                <button
                  type="button"
                  className="btn btn-secondary modal-header-btn"
                  onClick={() => setIssueToDelete(selectedIssue)}
                  aria-label={`Delete ${selectedIssue.title || "issue"}`}
                  title="Delete issue"
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    setSelectedIssue(null);
                    setIssueDetailOriginal(null);
                    setIssueSaveError(null);
                    setIssueSaveSuccess(false);
                    setAutomatedTestDropdownOpen(false);
                    setPlayingRecordingId(null);
                    setEditingRecordingId(null);
                    setEditingScreenshotId(null);
                    setEditingFileId(null);
                    setRecordingError(null);
                    setRecordingPlaybackError(null);
                    setScreenshotError(null);
                    setFileError(null);
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div
              className="quality-score-bar-wrap"
              style={{ marginBottom: 12 }}
            >
              <div className="quality-score-bar-label">
                <span>Quality Score</span>
                <span>
                  {Math.round((computeQualityScore(selectedIssue) / 6) * 100)} /
                  100
                </span>
              </div>
              <div
                className="quality-score-bar"
                role="progressbar"
                aria-valuenow={Math.round(
                  (computeQualityScore(selectedIssue) / 6) * 100
                )}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="quality-score-bar-fill"
                  style={{
                    width: `${(computeQualityScore(selectedIssue) / 6) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="modal-body modal-body--scrollable">
            <div className="form-group">
              <label>Project</label>
              <input
                type="text"
                value={selectedIssue.project?.name ?? ""}
                readOnly
                disabled
                style={{ background: "var(--bg-muted)", cursor: "not-allowed" }}
              />
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                value={selectedIssue.title ?? ""}
                onChange={(e) =>
                  setSelectedIssue({ ...selectedIssue, title: e.target.value })
                }
                placeholder="Summary"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={selectedIssue.description ?? ""}
                onChange={(e) =>
                  setSelectedIssue({
                    ...selectedIssue,
                    description: e.target.value || null,
                  })
                }
                placeholder="Add more details…"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Acceptance Criteria</label>
              <textarea
                value={selectedIssue.acceptanceCriteria ?? ""}
                onChange={(e) =>
                  setSelectedIssue({
                    ...selectedIssue,
                    acceptanceCriteria: e.target.value || null,
                  })
                }
                placeholder="e.g. User can log in, Form validates input…"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Database</label>
              <input
                value={selectedIssue.database ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedIssue({
                    ...selectedIssue,
                    database: value || null,
                  });
                }}
                placeholder="Input Database Information..."
              />
            </div>
            <div className="form-group">
              <label>API</label>
              <input
                value={selectedIssue.api ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedIssue({ ...selectedIssue, api: value || null });
                }}
                placeholder="API"
              />
            </div>
            <div className="form-group">
              <label>Test Cases</label>
              {(() => {
                const lines = parseTestCases(selectedIssue.testCases);
                const updateCases = (nextLines: string[]) => {
                  setSelectedIssue({
                    ...selectedIssue,
                    testCases: serializeTestCases(nextLines),
                  });
                };
                return (
                  <div className="test-cases-list">
                    {lines.map((line, idx) => (
                      <div key={idx} className="test-case-row">
                        <div className="test-case-field">
                          <AutoResizeTextarea
                            value={line}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = e.target.value;
                              updateCases(next);
                            }}
                            placeholder="e.g. Given X when Y then Z"
                            className={
                              idx > 0 ? "test-case-input-with-action" : ""
                            }
                          />
                          {idx > 0 && (
                            <button
                              type="button"
                              className="btn btn-icon test-case-remove"
                              onClick={() => {
                                const next = lines.filter((_, i) => i !== idx);
                                updateCases(next);
                              }}
                              aria-label="Remove test case"
                              title="Remove test case"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-icon test-case-add"
                          onClick={() =>
                            updateCases([
                              ...lines.slice(0, idx + 1),
                              "",
                              ...lines.slice(idx + 1),
                            ])
                          }
                          aria-label="Add test case"
                          title="Add test case"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="form-group">
              <label>Assigned To</label>
              <select
                className="form-select"
                value={selectedIssue.assigneeId ?? ""}
                onChange={(e) =>
                  setSelectedIssue({
                    ...selectedIssue,
                    assigneeId: e.target.value || null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Automated Tests</label>
              {(() => {
                const selectedTests = parseAutomatedTests(
                  selectedIssue.automatedTest
                );
                const allTests = uiTests.flatMap((f) =>
                  f.suites.flatMap((s) =>
                    s.tests.map((t) => ({
                      file: f.file,
                      suite: s.name,
                      test: t,
                    }))
                  )
                );
                const toggleTest = (testName: string) => {
                  const next = selectedTests.includes(testName)
                    ? selectedTests.filter((t) => t !== testName)
                    : [...selectedTests, testName];
                  setSelectedIssue({
                    ...selectedIssue,
                    automatedTest: serializeAutomatedTests(next),
                  });
                };
                const removeTest = (testName: string) => {
                  const next = selectedTests.filter((t) => t !== testName);
                  setSelectedIssue({
                    ...selectedIssue,
                    automatedTest: serializeAutomatedTests(next),
                  });
                };
                const runTest = async (testName: string) => {
                  setAutomatedTestRunResults((prev) => ({
                    ...prev,
                    [testName]: "running",
                  }));
                  try {
                    const result = await runUiTest(testName);
                    setAutomatedTestRunResults((prev) => ({
                      ...prev,
                      [testName]: result,
                    }));
                  } catch (err) {
                    setAutomatedTestRunResults((prev) => ({
                      ...prev,
                      [testName]: {
                        success: false,
                        exitCode: null,
                        output: "",
                        errorOutput:
                          err instanceof Error
                            ? err.message
                            : "Failed to run test",
                      },
                    }));
                  }
                };
                return (
                  <div className="automated-tests-select">
                    <div ref={automatedTestDropdownRef}>
                      <button
                        type="button"
                        className="automated-tests-trigger"
                        onClick={() => setAutomatedTestDropdownOpen((o) => !o)}
                      >
                        <span className="automated-tests-trigger-text">
                          {selectedTests.length === 0
                            ? "Select automated tests…"
                            : `${selectedTests.length} test${selectedTests.length === 1 ? "" : "s"} selected`}
                        </span>
                        <span className="automated-tests-trigger-arrow">
                          {automatedTestDropdownOpen ? "▲" : "▼"}
                        </span>
                      </button>
                      {automatedTestDropdownOpen && (
                        <div className="automated-tests-dropdown">
                          {uiTests.map((f) =>
                            f.suites.map((suite) => (
                              <div key={`${f.file}::${suite.name}`}>
                                <div className="automated-tests-suite-header">
                                  {suite.name}
                                </div>
                                {suite.tests.map((test) => {
                                  const isChecked =
                                    selectedTests.includes(test);
                                  return (
                                    <button
                                      key={test}
                                      type="button"
                                      className={`automated-tests-option${isChecked ? " is-selected" : ""}`}
                                      onClick={() => toggleTest(test)}
                                    >
                                      <span className="automated-tests-check">
                                        {isChecked ? "✓" : ""}
                                      </span>
                                      <span>{test}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {selectedTests.length > 0 && (
                      <div className="automated-tests-chips">
                        {selectedTests.map((t) => {
                          const status = automatedTestRunResults[t];
                          const isRunning = status === "running";
                          const result =
                            typeof status === "object" ? status : null;
                          return (
                            <span key={t} className="automated-tests-chip">
                              <div className="test-run-control-wrap">
                                {isRunning ? (
                                  <span
                                    className="test-run-control test-run-control--spinner"
                                    aria-label="Running"
                                  />
                                ) : result ? (
                                  <button
                                    type="button"
                                    className={`test-run-control test-run-control--${result.success ? "pass" : "fail"}`}
                                    title={
                                      result.success
                                        ? "Passed (click to run again)"
                                        : "Failed (click to run again)"
                                    }
                                    aria-label={
                                      result.success ? "Passed" : "Failed"
                                    }
                                    onClick={() => runTest(t)}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="test-run-control test-run-control--play"
                                    onClick={() => runTest(t)}
                                    title="Run this test"
                                    aria-label={`Run ${t}`}
                                  />
                                )}
                              </div>
                              <span className="automated-tests-chip-run">
                                <Link
                                  href={`/tests#test-${testNameToSlug(t)}`}
                                  className="automated-tests-chip-text"
                                  title="Open this test on Tests page"
                                >
                                  {t}
                                </Link>
                                {isRunning && (
                                  <span
                                    className="automated-tests-chip-status"
                                    aria-live="polite"
                                  >
                                    Running…
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                className="automated-tests-chip-remove"
                                onClick={() => removeTest(t)}
                                aria-label={`Remove ${t}`}
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            {!isRecording && (
              <div className="form-group">
                <div className="recording-section">
                  <div className="recording-action-section">
                    <div className="recording-action-section-label">Upload</div>
                    <div className="recording-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={
                          uploadButtonBusy ||
                          recordingUploading ||
                          screenshotUploading ||
                          fileUploading
                        }
                        aria-label={
                          uploadButtonBusy ||
                          fileUploading ||
                          recordingUploading ||
                          screenshotUploading
                            ? "Uploading…"
                            : "Upload file (image, video, audio, PDF, or any file)"
                        }
                        title={
                          uploadButtonBusy ||
                          fileUploading ||
                          recordingUploading ||
                          screenshotUploading
                            ? "Uploading…"
                            : "Upload file (image, video, audio, PDF, or any file)"
                        }
                      >
                        {uploadButtonBusy ||
                        fileUploading ||
                        recordingUploading ||
                        screenshotUploading ? (
                          <span
                            className="upload-spinner upload-spinner--btn"
                            aria-hidden="true"
                          />
                        ) : (
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="form-group" ref={screenshotsSectionRef}>
              <label>
                Screenshots
                {(selectedIssue.screenshots ?? []).length > 0
                  ? ` (${(selectedIssue.screenshots ?? []).length})`
                  : ""}
              </label>
              <div className="recording-section">
                {(selectedIssue.screenshots ?? []).length > 0 && (
                  <div
                    className="screenshots-list"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    {(selectedIssue.screenshots ?? []).map((shot, shotIdx) => {
                      const displayName =
                        shot.name ??
                        screenshotNameFromComments.get(shot.id) ??
                        `Screenshot ${shotIdx + 1}`;
                      const isEditingScreenshotName =
                        editingScreenshotId === shot.id;
                      return (
                        <div
                          key={shot.id}
                          className="screenshot-item"
                          data-screenshot-id={shot.id}
                          style={{ position: "relative" }}
                        >
                          <a
                            href={getScreenshotUrl(shot.imageUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "block" }}
                          >
                            <img
                              src={getScreenshotUrl(shot.imageUrl)}
                              alt={
                                isEditingScreenshotName
                                  ? editingScreenshotName
                                  : displayName
                              }
                              style={{
                                maxWidth: 160,
                                maxHeight: 120,
                                objectFit: "contain",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                              }}
                            />
                          </a>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              marginTop: 4,
                              maxWidth: isEditingScreenshotName ? 400 : 160,
                              minWidth: isEditingScreenshotName
                                ? 160
                                : undefined,
                            }}
                          >
                            {isEditingScreenshotName ? (
                              <input
                                type="text"
                                value={editingScreenshotName}
                                onChange={(e) =>
                                  setEditingScreenshotName(e.target.value)
                                }
                                onFocus={(e) => {
                                  const input = e.currentTarget;
                                  requestAnimationFrame(() => {
                                    requestAnimationFrame(() =>
                                      input.setSelectionRange(0, 0)
                                    );
                                  });
                                }}
                                onBlur={() =>
                                  handleSaveScreenshotName(
                                    shot.id,
                                    editingScreenshotName
                                  )
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  else if (e.key === "Escape") {
                                    setEditingScreenshotId(null);
                                    setEditingScreenshotName("");
                                  }
                                }}
                                autoFocus
                                aria-label="Screenshot name"
                                style={{
                                  width: `${Math.min(400, Math.max(160, editingScreenshotName.length * 8 + 24))}px`,
                                  padding: "2px 6px",
                                  fontSize: 12,
                                  border: "1px solid var(--border)",
                                  borderRadius: 4,
                                  boxSizing: "border-box",
                                }}
                              />
                            ) : (
                              <span
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                }}
                                onClick={() => {
                                  setEditingScreenshotId(shot.id);
                                  setEditingScreenshotName(displayName);
                                }}
                                title="Click to edit name"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setEditingScreenshotId(shot.id);
                                    setEditingScreenshotName(displayName);
                                  }
                                }}
                              >
                                {displayName}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon screenshot-item-delete"
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              minWidth: 28,
                              padding: "4px 6px",
                            }}
                            onClick={() => handleDeleteScreenshot(shot.id)}
                            aria-label="Delete screenshot"
                            title="Delete screenshot"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!screenshotUploading && !screenshotTaking && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleTakeScreenshot}
                      disabled={!canScreenRecord}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>{" "}
                      Take Screenshot
                    </button>
                    <input
                      ref={screenshotFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleScreenshotUpload}
                      aria-label="Choose screenshot image"
                    />
                  </>
                )}
                {(screenshotUploading || screenshotTaking) && (
                  <div className="recording-uploading">
                    {screenshotTaking
                      ? "Capturing screen…"
                      : "Uploading screenshot…"}
                  </div>
                )}
                {screenshotError && (
                  <div
                    className="error-banner"
                    style={{
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span>{screenshotError}</span>
                    <button
                      type="button"
                      onClick={() => setScreenshotError(null)}
                      aria-label="Dismiss"
                      title="Dismiss"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0 4px",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                        opacity: 0.8,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group" ref={recordingsSectionRef}>
              <div className="recording-section">
                {!isRecording && !recordingUploading && (
                  <div
                    className="recording-actions-wrap"
                    style={{
                      marginTop: selectedIssue.recordings?.length > 0 ? 8 : 0,
                    }}
                  >
                    {(canScreenRecord || canCameraRecord || canAudioRecord) && (
                      <div className="recording-action-section">
                        <div className="recording-action-section-label">
                          Recording
                        </div>
                        {selectedIssue.recordings?.length > 0 && (
                          <div
                            className="recordings-list"
                            style={{ marginTop: 8, marginBottom: 8 }}
                          >
                            {selectedIssue.recordings.map((rec, idx) => {
                              // Derive kind: prefer DB recordingType, fall back to filename suffix for legacy recordings
                              const url = rec.videoUrl ?? "";
                              const kindFromFilename = url.includes(
                                "-audio.webm"
                              )
                                ? "audio"
                                : url.includes("-camera.webm")
                                  ? "camera"
                                  : url.includes("-screen.webm")
                                    ? "screen"
                                    : null;
                              const isAudio =
                                rec.mediaType === "audio" ||
                                kindFromFilename === "audio";
                              const kind: "audio" | "screen" | "camera" =
                                isAudio
                                  ? "audio"
                                  : ((kindFromFilename as
                                      | "screen"
                                      | "camera"
                                      | null) ??
                                    rec.recordingType ??
                                    "screen");
                              const label =
                                kind === "audio"
                                  ? `Audio Recording ${idx + 1}`
                                  : kind === "camera"
                                    ? `Camera Recording ${idx + 1}`
                                    : `Screen Recording ${idx + 1}`;
                              const displayLabel = rec.name ?? label;
                              const isEditingName =
                                editingRecordingId === rec.id;
                              return (
                                <div
                                  key={rec.id}
                                  className="recording-item"
                                  data-recording-id={rec.id}
                                >
                                  <div className="recording-item-header">
                                    {isEditingName ? (
                                      <input
                                        type="text"
                                        value={editingRecordingName}
                                        onChange={(e) =>
                                          setEditingRecordingName(
                                            e.target.value
                                          )
                                        }
                                        onFocus={(e) => {
                                          const input = e.currentTarget;
                                          requestAnimationFrame(() => {
                                            requestAnimationFrame(() =>
                                              input.setSelectionRange(0, 0)
                                            );
                                          });
                                        }}
                                        onBlur={() =>
                                          handleSaveRecordingName(
                                            rec.id,
                                            editingRecordingName
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                            e.currentTarget.blur();
                                          else if (e.key === "Escape") {
                                            setEditingRecordingId(null);
                                            setEditingRecordingName("");
                                          }
                                        }}
                                        autoFocus
                                        aria-label="Recording name"
                                        style={{
                                          width: `${Math.min(400, Math.max(160, editingRecordingName.length * 8 + 24))}px`,
                                          padding: "2px 6px",
                                          fontSize: 12,
                                          border: "1px solid var(--border)",
                                          borderRadius: 4,
                                          boxSizing: "border-box",
                                        }}
                                      />
                                    ) : (
                                      <span
                                        className="recording-item-header-name"
                                        style={{
                                          display: "block",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          cursor: "pointer",
                                        }}
                                        onClick={() => {
                                          setEditingRecordingId(rec.id);
                                          setEditingRecordingName(displayLabel);
                                        }}
                                        title="Click to edit name"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (
                                            e.key === "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            setEditingRecordingId(rec.id);
                                            setEditingRecordingName(
                                              displayLabel
                                            );
                                          }
                                        }}
                                      >
                                        {displayLabel}
                                      </span>
                                    )}
                                    <span className="recording-item-date">
                                      {new Date(rec.createdAt).toLocaleString()}
                                    </span>
                                    <div className="recording-item-actions">
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                          setPlayingRecordingId(
                                            playingRecordingId === rec.id
                                              ? null
                                              : rec.id
                                          );
                                          setRecordingPlaybackError(null);
                                        }}
                                      >
                                        {playingRecordingId === rec.id
                                          ? "Hide"
                                          : isAudio
                                            ? "Listen"
                                            : "Watch"}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-danger-outline btn-sm btn-icon"
                                        onClick={() =>
                                          handleDeleteRecording(rec.id)
                                        }
                                        aria-label={
                                          isAudio
                                            ? "Delete audio recording"
                                            : "Delete recording"
                                        }
                                        title={
                                          isAudio
                                            ? "Delete audio recording"
                                            : "Delete recording"
                                        }
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <polyline points="3 6 5 6 21 6" />
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                          <line
                                            x1="10"
                                            y1="11"
                                            x2="10"
                                            y2="17"
                                          />
                                          <line
                                            x1="14"
                                            y1="11"
                                            x2="14"
                                            y2="17"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  {playingRecordingId === rec.id && (
                                    <div
                                      className="recording-player-wrap"
                                      ref={recordingPlayerWrapRef}
                                    >
                                      {isAudio ? (
                                        <audio
                                          key={rec.id}
                                          src={getRecordingUrl(rec.videoUrl)}
                                          controls
                                          className="recording-player"
                                          onError={(e) => {
                                            const code =
                                              e.currentTarget?.error?.code;
                                            setRecordingPlaybackError(
                                              code === 4
                                                ? "Audio could not be loaded."
                                                : "Audio could not be loaded. Try refreshing or re-recording."
                                            );
                                          }}
                                          onLoadedData={() =>
                                            setRecordingPlaybackError(null)
                                          }
                                        />
                                      ) : (
                                        <video
                                          key={rec.id}
                                          src={getRecordingUrl(rec.videoUrl)}
                                          controls
                                          playsInline
                                          className="recording-player"
                                          onError={(e) => {
                                            const code =
                                              e.currentTarget?.error?.code;
                                            const isSafari =
                                              typeof navigator !==
                                                "undefined" &&
                                              /^((?!chrome|android).)*safari/i.test(
                                                navigator.userAgent
                                              );
                                            const msg =
                                              code === 4 || isSafari
                                                ? "Video could not be loaded. WebM may not be supported in this browser (e.g. Safari). Try Chrome/Firefox or upload an MP4."
                                                : "Video could not be loaded. Try refreshing the page or re-recording.";
                                            setRecordingPlaybackError(msg);
                                          }}
                                          onLoadedData={() =>
                                            setRecordingPlaybackError(null)
                                          }
                                        >
                                          Your browser does not support the
                                          video tag.
                                        </video>
                                      )}
                                      {recordingPlaybackError && (
                                        <div
                                          className="error-banner"
                                          style={{
                                            marginTop: 8,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 8,
                                          }}
                                        >
                                          <span>{recordingPlaybackError}</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRecordingPlaybackError(null)
                                            }
                                            aria-label="Dismiss"
                                            title="Dismiss"
                                            style={{
                                              background: "none",
                                              border: "none",
                                              padding: "0 4px",
                                              cursor: "pointer",
                                              fontSize: 18,
                                              lineHeight: 1,
                                              opacity: 0.8,
                                            }}
                                          >
                                            ×
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="recording-actions">
                          {recordingFor === "issue" ? (
                            <button
                              type="button"
                              className="btn btn-danger-outline"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                stopRecording();
                              }}
                              aria-label="Stop"
                              title="Stop"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <rect
                                  x="6"
                                  y="6"
                                  width="12"
                                  height="12"
                                  rx="1"
                                  ry="1"
                                />
                              </svg>
                            </button>
                          ) : (
                            <>
                              {canAudioRecord && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => startAudioRecording()}
                                  aria-label="Record Audio"
                                  title="Record Audio"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="23" />
                                    <line x1="8" y1="23" x2="16" y2="23" />
                                  </svg>{" "}
                                  Record Audio
                                </button>
                              )}
                              {canScreenRecord && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => startRecording()}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <rect
                                      x="2"
                                      y="3"
                                      width="20"
                                      height="14"
                                      rx="2"
                                      ry="2"
                                    />
                                    <line x1="8" y1="21" x2="16" y2="21" />
                                    <line x1="12" y1="17" x2="12" y2="21" />
                                    <circle
                                      cx="12"
                                      cy="9"
                                      r="2.5"
                                      fill="currentColor"
                                    />
                                  </svg>{" "}
                                  Record Screen
                                </button>
                              )}
                              {canCameraRecord && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => startCameraRecording()}
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M23 7l-7 5 7 5V7z" />
                                    <rect
                                      x="1"
                                      y="5"
                                      width="15"
                                      height="14"
                                      rx="2"
                                      ry="2"
                                    />
                                    <circle
                                      cx="8"
                                      cy="12"
                                      r="2.5"
                                      fill="currentColor"
                                    />
                                  </svg>{" "}
                                  Record with Camera
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="*/*"
                      multiple
                      style={{ display: "none" }}
                      onChange={handleUnifiedFileUpload}
                    />
                  </div>
                )}
                {isRecording && (
                  <div className="recording-active">
                    <span className="recording-indicator" />
                    <span className="recording-label">
                      {recordingMode === "audio"
                        ? "Recording audio…"
                        : recordingMode === "camera"
                          ? "Recording camera…"
                          : "Recording screen…"}
                    </span>
                    <button
                      type="button"
                      className="btn btn-danger-outline"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        stopRecording();
                      }}
                      aria-label="Stop"
                      title="Stop"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                          rx="1"
                          ry="1"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                {recordingUploading && (
                  <div className="recording-uploading">
                    Uploading recording…
                  </div>
                )}
                {recordingError && (
                  <div
                    className="error-banner"
                    style={{
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span>{recordingError}</span>
                    <button
                      type="button"
                      onClick={() => setRecordingError(null)}
                      aria-label="Dismiss"
                      title="Dismiss"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0 4px",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                        opacity: 0.8,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group" ref={filesSectionRef}>
              <label>
                Files
                {(selectedIssue.files ?? []).length > 0
                  ? ` (${(selectedIssue.files ?? []).length})`
                  : ""}
              </label>
              <div className="recording-section">
                {(selectedIssue.files ?? []).length > 0 && (
                  <ul
                    style={{ listStyle: "none", margin: 0, padding: 0 }}
                    className="issue-file-list"
                  >
                    {(selectedIssue.files ?? []).map((f) => {
                      const displayName = f.fileName;
                      return (
                        <li
                          key={f.id}
                          className="issue-file-row"
                          data-file-id={f.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={displayName}
                          >
                            {displayName}
                          </span>
                          <a
                            href={getIssueFileUrl(selectedIssue.id, f.id)}
                            download={f.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="issue-file-link"
                            style={{ flexShrink: 0, fontSize: 12 }}
                            aria-label={`Download ${displayName}`}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </a>
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-sm btn-icon"
                            onClick={() => handleDeleteFile(f.id)}
                            aria-label={`Delete ${displayName}`}
                            title={`Delete ${displayName}`}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {(uploadButtonBusy || fileUploading) && (
                  <div
                    className="recording-uploading file-uploading-with-spinner"
                    role="status"
                    aria-live="polite"
                  >
                    <span className="upload-spinner" aria-hidden="true" />
                    <span>Uploading file…</span>
                  </div>
                )}
                {fileError && (
                  <div
                    className="error-banner"
                    style={{
                      marginTop: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span>{fileError}</span>
                    <button
                      type="button"
                      onClick={() => setFileError(null)}
                      aria-label="Dismiss"
                      title="Dismiss"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0 4px",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: 1,
                        opacity: 0.8,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                {dragOverCount > 0 && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "var(--text-muted)",
                    }}
                  >
                    Drop files here — images go to Screenshots, video/audio to
                    Recordings, others (e.g. PDF) to Files.
                  </p>
                )}
              </div>
            </div>
            <div className="form-group" ref={commentsSectionRef}>
              <label>Comments</label>
              {issueCommentsLoading ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Loading comments…
                </div>
              ) : (
                <>
                  <div
                    style={{ display: editingCommentId ? "none" : undefined }}
                  >
                    <div
                      className="form-control"
                      style={{
                        padding: 10,
                        border: commentBoxError
                          ? "2px solid var(--danger, #c53030)"
                          : "1px solid var(--border-input)",
                        borderRadius: 6,
                        background: "var(--input-bg)",
                        cursor: "text",
                        minHeight: 80,
                        maxHeight: 480,
                        resize: "vertical",
                        overflowY: "auto",
                        overflowX: "hidden",
                        display: "block",
                      }}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) {
                          const last = commentBlocks.length - 1;
                          if (commentBlocks[last]?.kind === "text")
                            activeCommentBlockRef.current = last;
                        }
                      }}
                    >
                      {commentBlocks.map((block, bi) => {
                        if (block.kind === "text") {
                          return (
                            <textarea
                              key={`text-${bi}`}
                              ref={
                                bi === 0 ? issueCommentTextareaRef : undefined
                              }
                              value={block.value}
                              onFocus={() => {
                                activeCommentBlockRef.current = bi;
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCommentBlocks((prev) =>
                                  prev.map((b, i) =>
                                    i === bi
                                      ? ({ ...b, value: val } as CommentBlock)
                                      : b
                                  )
                                );
                                setCommentBoxError(false);
                              }}
                              placeholder={bi === 0 ? "Add a comment…" : ""}
                              rows={3}
                              style={{
                                width: "100%",
                                resize: "none",
                                minHeight: 60,
                                border: "none",
                                padding: 0,
                                background: "transparent",
                                outline: "none",
                                display: "block",
                                boxSizing: "border-box",
                              }}
                            />
                          );
                        }
                        if (block.kind === "attachment") {
                          const label =
                            block.name ??
                            (block.attType === "screenshot"
                              ? "Screenshot"
                              : block.attType === "screen_recording"
                                ? "Screen recording"
                                : block.attType === "camera_recording"
                                  ? "Camera recording"
                                  : "Video");
                          return (
                            <div
                              key={`att-${bi}`}
                              data-comment-block-index={bi}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                margin: "4px 0",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12 }}
                                onClick={() => {
                                  setViewingBlockIndex(bi);
                                  setTimeout(
                                    () =>
                                      document
                                        .querySelector(
                                          `[data-comment-block-index="${bi}"]`
                                        )
                                        ?.scrollIntoView({
                                          behavior: "smooth",
                                          block: "nearest",
                                        }),
                                    0
                                  );
                                }}
                                aria-label={`Open ${label}`}
                                title={`Open ${label}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  aria-hidden="true"
                                >
                                  {block.attType === "screenshot" ? (
                                    <>
                                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                      <circle cx="12" cy="13" r="4" />
                                    </>
                                  ) : (
                                    <>
                                      <path d="M23 7l-7 5 7 5V7z" />
                                      <rect
                                        x="1"
                                        y="5"
                                        width="15"
                                        height="14"
                                        rx="2"
                                        ry="2"
                                      />
                                      <circle
                                        cx="8"
                                        cy="12"
                                        r="2.5"
                                        fill="currentColor"
                                      />
                                    </>
                                  )}
                                </svg>{" "}
                                {label}
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon"
                                style={{
                                  padding: "2px 4px",
                                  minWidth: 20,
                                  fontSize: 10,
                                }}
                                onClick={() => removeCommentBlock(bi)}
                                aria-label="Remove"
                                title="Remove"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          );
                        }
                        if (block.kind === "recording") {
                          const rec = selectedIssue?.recordings?.find(
                            (r) => r.id === block.recordingId
                          );
                          if (!rec) return null;
                          const url = rec.videoUrl ?? "";
                          const kindFromFilename = url.includes("-audio.webm")
                            ? "audio"
                            : url.includes("-camera.webm")
                              ? "camera"
                              : url.includes("-screen.webm")
                                ? "screen"
                                : null;
                          const isAudio =
                            rec.mediaType === "audio" ||
                            kindFromFilename === "audio";
                          const kind: "audio" | "screen" | "camera" = isAudio
                            ? "audio"
                            : ((kindFromFilename as
                                | "screen"
                                | "camera"
                                | null) ??
                              rec.recordingType ??
                              "screen");
                          const rIdx =
                            selectedIssue!.recordings!.indexOf(rec) + 1;
                          const defaultLabel =
                            kind === "audio"
                              ? `Audio Recording ${rIdx}`
                              : kind === "camera"
                                ? `Camera Recording ${rIdx}`
                                : `Screen Recording ${rIdx}`;
                          const displayLabel = rec.name ?? defaultLabel;
                          return (
                            <div
                              key={`rec-${bi}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                margin: "4px 0",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12 }}
                                aria-label={`Go to ${displayLabel}`}
                                title={`Go to ${displayLabel}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>{" "}
                                {displayLabel}
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon"
                                style={{
                                  padding: "2px 4px",
                                  minWidth: 20,
                                  fontSize: 10,
                                }}
                                onClick={() => removeCommentBlock(bi)}
                                aria-label="Remove"
                                title="Remove"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          );
                        }
                        if (block.kind === "screenshot") {
                          const shot = selectedIssue?.screenshots?.find(
                            (s) => s.id === block.screenshotId
                          );
                          if (!shot) return null;
                          const sIdx =
                            selectedIssue!.screenshots!.indexOf(shot) + 1;
                          const displayLabel =
                            block.name ?? shot.name ?? `Screenshot ${sIdx}`;
                          return (
                            <div
                              key={`shot-${bi}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                margin: "4px 0",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12 }}
                                aria-label={`Go to ${displayLabel}`}
                                title={`Go to ${displayLabel}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                  <circle cx="12" cy="13" r="4" />
                                </svg>{" "}
                                {displayLabel}
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon"
                                style={{
                                  padding: "2px 4px",
                                  minWidth: 20,
                                  fontSize: 10,
                                }}
                                onClick={() => removeCommentBlock(bi)}
                                aria-label="Remove"
                                title="Remove"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          );
                        }
                        if (block.kind === "file") {
                          const f = selectedIssue?.files?.find(
                            (x) => x.id === block.fileId
                          );
                          if (!f) return null;
                          return (
                            <div
                              key={`file-${bi}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                margin: "4px 0",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ fontSize: 12 }}
                                aria-label={`Go to file ${f.fileName}`}
                                title={`Go to file ${f.fileName}`}
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                  <polyline points="17 8 12 3 7 8" />
                                  <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>{" "}
                                {f.fileName}
                              </button>
                              <button
                                type="button"
                                className="btn btn-icon"
                                style={{
                                  padding: "2px 4px",
                                  minWidth: 20,
                                  fontSize: 10,
                                }}
                                onClick={() => removeCommentBlock(bi)}
                                aria-label="Remove"
                                title="Remove"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    {viewingBlockIndex !== null &&
                      commentBlocks[viewingBlockIndex]?.kind === "attachment" &&
                      (() => {
                        const block = commentBlocks[
                          viewingBlockIndex
                        ] as CommentBlockAttachment;
                        const isImage =
                          block.attType === "screenshot" && block.imageBase64;
                        const isVideo = !!block.videoBase64;
                        return (
                          <div
                            className="modal-overlay"
                            style={{ zIndex: 10001 }}
                            onClick={() => setViewingBlockIndex(null)}
                          >
                            <div
                              className="modal"
                              style={{ maxWidth: "90vw", maxHeight: "90vh" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  marginBottom: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => setViewingBlockIndex(null)}
                                  aria-label="Close"
                                >
                                  Close
                                </button>
                              </div>
                              {isImage && (
                                <img
                                  src={`data:image/png;base64,${block.imageBase64}`}
                                  alt="Attachment"
                                  style={{
                                    maxWidth: "100%",
                                    maxHeight: "80vh",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                              )}
                              {isVideo && block.videoBase64 && (
                                <PendingAttachmentVideoPlayer
                                  base64={block.videoBase64}
                                  onClose={() => setViewingBlockIndex(null)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() =>
                          commentVideoFileInputRef.current?.click()
                        }
                        disabled={
                          issueCommentSubmitting || commentAttachmentUploading
                        }
                        aria-label="Upload file (image, video, audio, PDF, or any file)"
                        title="Upload file (image, video, audio, PDF, or any file)"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </button>
                      {canScreenRecord && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={handleTakeScreenshotAndAddToComment}
                          disabled={
                            issueCommentSubmitting ||
                            commentAttachmentUploading ||
                            screenshotUploading ||
                            screenshotTaking
                          }
                          aria-label="Take Screenshot"
                          title="Take Screenshot"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </button>
                      )}
                      {canAudioRecord &&
                        (isRecording && recordingMode === "audio" ? (
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            style={{ fontSize: 12 }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              stopRecording();
                            }}
                            aria-label="Stop"
                            title="Stop"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <rect
                                x="6"
                                y="6"
                                width="12"
                                height="12"
                                rx="1"
                                ry="1"
                              />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              startAudioRecording({ forCommentPending: true })
                            }
                            disabled={
                              issueCommentSubmitting ||
                              isRecording ||
                              recordingUploading
                            }
                            aria-label="Record Audio"
                            title="Record Audio"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                              <line x1="12" y1="19" x2="12" y2="23" />
                              <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                          </button>
                        ))}
                      {canScreenRecord &&
                        (recordingFor === "comment-pending" &&
                        recordingMode === "screen" ? (
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            style={{ fontSize: 12 }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              stopRecording();
                            }}
                            aria-label="Stop"
                            title="Stop"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <rect
                                x="6"
                                y="6"
                                width="12"
                                height="12"
                                rx="1"
                                ry="1"
                              />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              startRecording({ forCommentPending: true })
                            }
                            disabled={
                              issueCommentSubmitting ||
                              isRecording ||
                              recordingUploading
                            }
                            aria-label="Record Screen"
                            title="Record Screen"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect
                                x="2"
                                y="3"
                                width="20"
                                height="14"
                                rx="2"
                                ry="2"
                              />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                              <circle
                                cx="12"
                                cy="9"
                                r="2.5"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        ))}
                      {canCameraRecord &&
                        (recordingFor === "comment-pending" &&
                        recordingMode === "camera" ? (
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            style={{ fontSize: 12 }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              stopRecording();
                            }}
                            aria-label="Stop"
                            title="Stop"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <rect
                                x="6"
                                y="6"
                                width="12"
                                height="12"
                                rx="1"
                                ry="1"
                              />
                            </svg>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: 12 }}
                            onClick={() =>
                              startCameraRecording({ forCommentPending: true })
                            }
                            disabled={
                              issueCommentSubmitting ||
                              isRecording ||
                              recordingUploading
                            }
                            aria-label="Record with Camera"
                            title="Record with Camera"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M23 7l-7 5 7 5V7z" />
                              <rect
                                x="1"
                                y="5"
                                width="15"
                                height="14"
                                rx="2"
                                ry="2"
                              />
                              <circle
                                cx="8"
                                cy="12"
                                r="2.5"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                        ))}
                    </div>
                    <input
                      ref={commentScreenshotFileInputRef}
                      type="file"
                      accept="image/*"
                      aria-label="Comment screenshot"
                      style={{ display: "none" }}
                      onChange={handleCommentScreenshotFile}
                    />
                    <input
                      ref={commentVideoFileInputRef}
                      type="file"
                      accept="*/*"
                      aria-label="Upload file (image, video, audio, PDF, or any file)"
                      style={{ display: "none" }}
                      onChange={handleCommentVideoFile}
                    />
                    <div
                      style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                      {commentBlocks.some((b) => {
                        if (b.kind === "text")
                          return (b as CommentBlockText).value.trim() !== "";
                        if (b.kind === "attachment") return true;
                        if (b.kind === "recording")
                          return selectedIssue?.recordings?.some(
                            (r) =>
                              r.id === (b as CommentBlockRecording).recordingId
                          );
                        if (b.kind === "screenshot")
                          return selectedIssue?.screenshots?.some(
                            (s) =>
                              s.id ===
                              (b as CommentBlockScreenshot).screenshotId
                          );
                        if (b.kind === "file")
                          return selectedIssue?.files?.some(
                            (f) => f.id === (b as CommentBlockFile).fileId
                          );
                        return false;
                      }) && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleAddComment}
                          disabled={issueCommentSubmitting}
                        >
                          {issueCommentSubmitting ? "Adding…" : "Add"}
                        </button>
                      )}
                    </div>
                  </div>
                  {issueComments.length > 0 && (
                    <ul
                      className="issue-comments-list"
                      style={{
                        listStyle: "none",
                        margin: "0 0 12px 0",
                        padding: 0,
                      }}
                    >
                      {issueComments.map((c) => (
                        <li
                          key={c.id}
                          className="issue-comment"
                          style={{
                            marginBottom: 10,
                            padding:
                              editingCommentId === c.id ? 10 : "8px 10px",
                            background:
                              editingCommentId === c.id
                                ? "var(--input-bg)"
                                : "var(--bg-muted)",
                            border:
                              editingCommentId === c.id
                                ? "1px solid var(--border-input)"
                                : undefined,
                            borderRadius: 6,
                            fontSize: 13,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
                              {editingCommentId === c.id ? (
                                <>
                                  <div
                                    className="form-control"
                                    style={{
                                      padding: 10,
                                      border: "1px solid var(--border-input)",
                                      borderRadius: 6,
                                      background: "var(--input-bg)",
                                      minHeight: 80,
                                      maxHeight: 480,
                                      resize: "vertical",
                                      overflowY: "auto",
                                      overflowX: "hidden",
                                      marginBottom: 8,
                                      display: "block",
                                    }}
                                  >
                                    {(
                                      editingCommentBlocks ?? [
                                        {
                                          kind: "text",
                                          value: editingCommentDraft,
                                        },
                                      ]
                                    ).map((block, bi) => {
                                      if (block.kind === "text") {
                                        return (
                                          <textarea
                                            key={`edit-text-${bi}`}
                                            value={block.value}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setEditingCommentBlocks(
                                                (prev) =>
                                                  prev?.map((b, i) =>
                                                    i === bi
                                                      ? ({
                                                          ...b,
                                                          value: val,
                                                        } as CommentBlock)
                                                      : b
                                                  ) ?? null
                                              );
                                            }}
                                            rows={3}
                                            style={{
                                              width: "100%",
                                              resize: "none",
                                              minHeight: 60,
                                              border: "none",
                                              padding: 0,
                                              background: "transparent",
                                              outline: "none",
                                              display: "block",
                                              marginBottom: 4,
                                              boxSizing: "border-box",
                                            }}
                                            aria-label="Edit comment text"
                                          />
                                        );
                                      }
                                      if (block.kind === "screenshot") {
                                        const shot =
                                          selectedIssue?.screenshots?.find(
                                            (s) => s.id === block.screenshotId
                                          );
                                        if (!shot) return null;
                                        const sIdx =
                                          selectedIssue!.screenshots!.indexOf(
                                            shot
                                          ) + 1;
                                        const displayLabel =
                                          block.name ??
                                          shot.name ??
                                          `Screenshot ${sIdx}`;
                                        return (
                                          <div
                                            key={`edit-shot-${bi}`}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              margin: "4px 0",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <span
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 12,
                                                cursor: "default",
                                                pointerEvents: "none",
                                              }}
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                              </svg>{" "}
                                              {displayLabel}
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-icon"
                                              style={{
                                                padding: "2px 4px",
                                                minWidth: 20,
                                                fontSize: 10,
                                              }}
                                              onClick={() =>
                                                removeEditingCommentBlock(bi)
                                              }
                                              aria-label="Remove"
                                              title="Remove"
                                            >
                                              <svg
                                                width="10"
                                                height="10"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <line
                                                  x1="18"
                                                  y1="6"
                                                  x2="6"
                                                  y2="18"
                                                />
                                                <line
                                                  x1="6"
                                                  y1="6"
                                                  x2="18"
                                                  y2="18"
                                                />
                                              </svg>
                                            </button>
                                          </div>
                                        );
                                      }
                                      if (block.kind === "recording") {
                                        const rec =
                                          selectedIssue?.recordings?.find(
                                            (r) => r.id === block.recordingId
                                          );
                                        if (!rec) return null;
                                        const url = rec.videoUrl ?? "";
                                        const kindFromFilename = url.includes(
                                          "-audio.webm"
                                        )
                                          ? "audio"
                                          : url.includes("-camera.webm")
                                            ? "camera"
                                            : url.includes("-screen.webm")
                                              ? "screen"
                                              : null;
                                        const isAudio =
                                          rec.mediaType === "audio" ||
                                          kindFromFilename === "audio";
                                        const kind:
                                          | "audio"
                                          | "screen"
                                          | "camera" = isAudio
                                          ? "audio"
                                          : ((kindFromFilename as
                                              | "screen"
                                              | "camera"
                                              | null) ??
                                            rec.recordingType ??
                                            "screen");
                                        const rIdx =
                                          selectedIssue!.recordings!.indexOf(
                                            rec
                                          ) + 1;
                                        const defaultLabel =
                                          kind === "audio"
                                            ? `Audio Recording ${rIdx}`
                                            : kind === "camera"
                                              ? `Camera Recording ${rIdx}`
                                              : `Screen Recording ${rIdx}`;
                                        const displayLabel =
                                          rec.name ?? defaultLabel;
                                        return (
                                          <div
                                            key={`edit-rec-${bi}`}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              margin: "4px 0",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <span
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 12,
                                                cursor: "default",
                                                pointerEvents: "none",
                                              }}
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                              >
                                                <polygon points="5 3 19 12 5 21 5 3" />
                                              </svg>{" "}
                                              {displayLabel}
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-icon"
                                              style={{
                                                padding: "2px 4px",
                                                minWidth: 20,
                                                fontSize: 10,
                                              }}
                                              onClick={() =>
                                                removeEditingCommentBlock(bi)
                                              }
                                              aria-label="Remove"
                                              title="Remove"
                                            >
                                              <svg
                                                width="10"
                                                height="10"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <line
                                                  x1="18"
                                                  y1="6"
                                                  x2="6"
                                                  y2="18"
                                                />
                                                <line
                                                  x1="6"
                                                  y1="6"
                                                  x2="18"
                                                  y2="18"
                                                />
                                              </svg>
                                            </button>
                                          </div>
                                        );
                                      }
                                      if (block.kind === "file") {
                                        const f = selectedIssue?.files?.find(
                                          (x) => x.id === block.fileId
                                        );
                                        if (!f) return null;
                                        return (
                                          <div
                                            key={`edit-file-${bi}`}
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              margin: "4px 0",
                                              flexWrap: "wrap",
                                            }}
                                          >
                                            <span
                                              className="btn btn-secondary"
                                              style={{
                                                fontSize: 12,
                                                cursor: "default",
                                                pointerEvents: "none",
                                              }}
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line
                                                  x1="12"
                                                  y1="3"
                                                  x2="12"
                                                  y2="15"
                                                />
                                              </svg>{" "}
                                              {f.fileName}
                                            </span>
                                            <button
                                              type="button"
                                              className="btn btn-icon"
                                              style={{
                                                padding: "2px 4px",
                                                minWidth: 20,
                                                fontSize: 10,
                                              }}
                                              onClick={() =>
                                                removeEditingCommentBlock(bi)
                                              }
                                              aria-label="Remove"
                                              title="Remove"
                                            >
                                              <svg
                                                width="10"
                                                height="10"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <line
                                                  x1="18"
                                                  y1="6"
                                                  x2="6"
                                                  y2="18"
                                                />
                                                <line
                                                  x1="6"
                                                  y1="6"
                                                  x2="18"
                                                  y2="18"
                                                />
                                              </svg>
                                            </button>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: 8,
                                      alignItems: "center",
                                      marginTop: 8,
                                      marginBottom: 8,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ fontSize: 12 }}
                                      onClick={() =>
                                        commentVideoFileInputRef.current?.click()
                                      }
                                      disabled={
                                        commentAttachmentUploading ||
                                        updatingCommentId === c.id
                                      }
                                      aria-label="Upload file (image, video, audio, PDF, or any file)"
                                      title="Upload file (image, video, audio, PDF, or any file)"
                                    >
                                      <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                      </svg>
                                    </button>
                                    {canScreenRecord && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ fontSize: 12 }}
                                        onClick={
                                          handleTakeScreenshotAndAddToComment
                                        }
                                        disabled={
                                          commentAttachmentUploading ||
                                          screenshotUploading ||
                                          screenshotTaking ||
                                          updatingCommentId === c.id
                                        }
                                        aria-label="Take Screenshot"
                                        title="Take Screenshot"
                                      >
                                        <svg
                                          width="14"
                                          height="14"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                        >
                                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                          <circle cx="12" cy="13" r="4" />
                                        </svg>
                                      </button>
                                    )}
                                    {canAudioRecord &&
                                      (recordingFor === c.id &&
                                      recordingMode === "audio" ? (
                                        <button
                                          type="button"
                                          className="btn btn-danger-outline"
                                          style={{ fontSize: 12 }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            stopRecording();
                                          }}
                                          aria-label="Stop"
                                          title="Stop"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                          >
                                            <rect
                                              x="6"
                                              y="6"
                                              width="12"
                                              height="12"
                                              rx="1"
                                              ry="1"
                                            />
                                          </svg>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ fontSize: 12 }}
                                          onClick={() =>
                                            startAudioRecording({
                                              forCommentId: c.id,
                                            })
                                          }
                                          disabled={
                                            isRecording ||
                                            updatingCommentId === c.id
                                          }
                                          aria-label="Record Audio"
                                          title="Record Audio"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                            <line
                                              x1="12"
                                              y1="19"
                                              x2="12"
                                              y2="23"
                                            />
                                            <line
                                              x1="8"
                                              y1="23"
                                              x2="16"
                                              y2="23"
                                            />
                                          </svg>
                                        </button>
                                      ))}
                                    {canScreenRecord &&
                                      (recordingFor === c.id &&
                                      recordingMode === "screen" ? (
                                        <button
                                          type="button"
                                          className="btn btn-danger-outline"
                                          style={{ fontSize: 12 }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            stopRecording();
                                          }}
                                          aria-label="Stop"
                                          title="Stop"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                          >
                                            <rect
                                              x="6"
                                              y="6"
                                              width="12"
                                              height="12"
                                              rx="1"
                                              ry="1"
                                            />
                                          </svg>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ fontSize: 12 }}
                                          onClick={() =>
                                            startRecording({
                                              forCommentId: c.id,
                                            })
                                          }
                                          disabled={
                                            isRecording ||
                                            updatingCommentId === c.id
                                          }
                                          aria-label="Record Screen"
                                          title="Record Screen"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <rect
                                              x="2"
                                              y="3"
                                              width="20"
                                              height="14"
                                              rx="2"
                                              ry="2"
                                            />
                                            <line
                                              x1="8"
                                              y1="21"
                                              x2="16"
                                              y2="21"
                                            />
                                            <line
                                              x1="12"
                                              y1="17"
                                              x2="12"
                                              y2="21"
                                            />
                                            <circle
                                              cx="12"
                                              cy="9"
                                              r="2.5"
                                              fill="currentColor"
                                            />
                                          </svg>
                                        </button>
                                      ))}
                                    {canCameraRecord &&
                                      (recordingFor === c.id &&
                                      recordingMode === "camera" ? (
                                        <button
                                          type="button"
                                          className="btn btn-danger-outline"
                                          style={{ fontSize: 12 }}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            stopRecording();
                                          }}
                                          aria-label="Stop"
                                          title="Stop"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                          >
                                            <rect
                                              x="6"
                                              y="6"
                                              width="12"
                                              height="12"
                                              rx="1"
                                              ry="1"
                                            />
                                          </svg>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ fontSize: 12 }}
                                          onClick={() =>
                                            startCameraRecording({
                                              forCommentId: c.id,
                                            })
                                          }
                                          disabled={
                                            isRecording ||
                                            updatingCommentId === c.id
                                          }
                                          aria-label="Record with Camera"
                                          title="Record with Camera"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <path d="M23 7l-7 5 7 5V7z" />
                                            <rect
                                              x="1"
                                              y="5"
                                              width="15"
                                              height="14"
                                              rx="2"
                                              ry="2"
                                            />
                                            <circle
                                              cx="8"
                                              cy="12"
                                              r="2.5"
                                              fill="currentColor"
                                            />
                                          </svg>
                                        </button>
                                      ))}
                                  </div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      alignItems: "center",
                                      marginBottom: 8,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-primary"
                                      onClick={handleSaveComment}
                                      disabled={
                                        updatingCommentId === c.id ||
                                        !(
                                          editingCommentBlocks
                                            ? serializeEditingBlocksToBody(
                                                editingCommentBlocks
                                              )
                                            : editingCommentDraft
                                        ).trim()
                                      }
                                    >
                                      {updatingCommentId === c.id
                                        ? "Saving…"
                                        : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={handleCancelEditComment}
                                      disabled={updatingCommentId === c.id}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div
                                    style={{
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {commentBodyWithFileButtons(
                                      c.body,
                                      c.attachments,
                                      getRecordingUrl,
                                      getScreenshotUrl,
                                      {
                                        recordings: selectedIssue?.recordings,
                                        screenshots: selectedIssue?.screenshots,
                                        files: selectedIssue?.files,
                                        onScrollToRecording: (id: string) => {
                                          const el =
                                            issueDetailModalScrollRef.current?.querySelector(
                                              `[data-recording-id="${id}"]`
                                            );
                                          if (el)
                                            el.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                        },
                                        onScrollToScreenshot: (id: string) => {
                                          const el =
                                            issueDetailModalScrollRef.current?.querySelector(
                                              `[data-screenshot-id="${id}"]`
                                            );
                                          if (el)
                                            el.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                        },
                                        onScrollToFile: (id: string) => {
                                          const el =
                                            issueDetailModalScrollRef.current?.querySelector(
                                              `[data-file-id="${id}"]`
                                            );
                                          if (el)
                                            el.scrollIntoView({
                                              behavior: "smooth",
                                              block: "center",
                                            });
                                        },
                                      }
                                    )}
                                  </div>
                                  {addingAttachmentToCommentId === c.id && (
                                    <div
                                      style={{
                                        marginTop: 8,
                                        padding: 8,
                                        background: "var(--input-bg)",
                                        borderRadius: 6,
                                        border: "1px solid var(--border-input)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: "var(--text-muted)",
                                          marginBottom: 6,
                                        }}
                                      >
                                        Add attachment
                                        {commentAttachmentUploading
                                          ? " (uploading…)"
                                          : ""}
                                      </div>
                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          gap: 8,
                                          alignItems: "center",
                                          marginBottom: 8,
                                        }}
                                      >
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ fontSize: 12 }}
                                          onClick={() =>
                                            commentVideoFileInputRef.current?.click()
                                          }
                                          disabled={commentAttachmentUploading}
                                          aria-label="Upload file (image, video, audio, PDF, or any file)"
                                          title="Upload file (image, video, audio, PDF, or any file)"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line
                                              x1="12"
                                              y1="3"
                                              x2="12"
                                              y2="15"
                                            />
                                          </svg>
                                        </button>
                                        {canScreenRecord && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ fontSize: 12 }}
                                            onClick={
                                              handleTakeScreenshotAndAddToComment
                                            }
                                            disabled={
                                              commentAttachmentUploading ||
                                              screenshotUploading ||
                                              screenshotTaking
                                            }
                                            aria-label="Take Screenshot"
                                            title="Take Screenshot"
                                          >
                                            <svg
                                              width="14"
                                              height="14"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                            >
                                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                              <circle cx="12" cy="13" r="4" />
                                            </svg>
                                          </button>
                                        )}
                                        {canAudioRecord &&
                                          (recordingFor === c.id &&
                                          recordingMode === "audio" ? (
                                            <button
                                              type="button"
                                              className="btn btn-danger-outline"
                                              style={{ fontSize: 12 }}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                stopRecording();
                                              }}
                                              aria-label="Stop"
                                              title="Stop"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                              >
                                                <rect
                                                  x="6"
                                                  y="6"
                                                  width="12"
                                                  height="12"
                                                  rx="1"
                                                  ry="1"
                                                />
                                              </svg>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              style={{ fontSize: 12 }}
                                              onClick={() =>
                                                startAudioRecording({
                                                  forCommentId: c.id,
                                                })
                                              }
                                              disabled={isRecording}
                                              aria-label="Record Audio"
                                              title="Record Audio"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                                <line
                                                  x1="12"
                                                  y1="19"
                                                  x2="12"
                                                  y2="23"
                                                />
                                                <line
                                                  x1="8"
                                                  y1="23"
                                                  x2="16"
                                                  y2="23"
                                                />
                                              </svg>
                                            </button>
                                          ))}
                                        {canScreenRecord &&
                                          (recordingFor === c.id &&
                                          recordingMode === "screen" ? (
                                            <button
                                              type="button"
                                              className="btn btn-danger-outline"
                                              style={{ fontSize: 12 }}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                stopRecording();
                                              }}
                                              aria-label="Stop"
                                              title="Stop"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                              >
                                                <rect
                                                  x="6"
                                                  y="6"
                                                  width="12"
                                                  height="12"
                                                  rx="1"
                                                  ry="1"
                                                />
                                              </svg>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              style={{ fontSize: 12 }}
                                              onClick={() =>
                                                startRecording({
                                                  forCommentId: c.id,
                                                })
                                              }
                                              disabled={isRecording}
                                              aria-label="Record Screen"
                                              title="Record Screen"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <rect
                                                  x="2"
                                                  y="3"
                                                  width="20"
                                                  height="14"
                                                  rx="2"
                                                  ry="2"
                                                />
                                                <line
                                                  x1="8"
                                                  y1="21"
                                                  x2="16"
                                                  y2="21"
                                                />
                                                <line
                                                  x1="12"
                                                  y1="17"
                                                  x2="12"
                                                  y2="21"
                                                />
                                                <circle
                                                  cx="12"
                                                  cy="9"
                                                  r="2.5"
                                                  fill="currentColor"
                                                />
                                              </svg>
                                            </button>
                                          ))}
                                        {canCameraRecord &&
                                          (recordingFor === c.id &&
                                          recordingMode === "camera" ? (
                                            <button
                                              type="button"
                                              className="btn btn-danger-outline"
                                              style={{ fontSize: 12 }}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                stopRecording();
                                              }}
                                              aria-label="Stop"
                                              title="Stop"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="currentColor"
                                                aria-hidden="true"
                                              >
                                                <rect
                                                  x="6"
                                                  y="6"
                                                  width="12"
                                                  height="12"
                                                  rx="1"
                                                  ry="1"
                                                />
                                              </svg>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              className="btn btn-secondary"
                                              style={{ fontSize: 12 }}
                                              onClick={() =>
                                                startCameraRecording({
                                                  forCommentId: c.id,
                                                })
                                              }
                                              disabled={isRecording}
                                              aria-label="Record with Camera"
                                              title="Record with Camera"
                                            >
                                              <svg
                                                width="14"
                                                height="14"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                              >
                                                <path d="M23 7l-7 5 7 5V7z" />
                                                <rect
                                                  x="1"
                                                  y="5"
                                                  width="15"
                                                  height="14"
                                                  rx="2"
                                                  ry="2"
                                                />
                                                <circle
                                                  cx="8"
                                                  cy="12"
                                                  r="2.5"
                                                  fill="currentColor"
                                                />
                                              </svg>
                                            </button>
                                          ))}
                                        <button
                                          type="button"
                                          className="btn btn-icon"
                                          style={{ fontSize: 12 }}
                                          onClick={() =>
                                            setAddingAttachmentToCommentId(null)
                                          }
                                          aria-label="Cancel"
                                          title="Cancel"
                                        >
                                          <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                          >
                                            <line
                                              x1="18"
                                              y1="6"
                                              x2="6"
                                              y2="18"
                                            />
                                            <line
                                              x1="6"
                                              y1="6"
                                              x2="18"
                                              y2="18"
                                            />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                  <div
                                    style={{
                                      marginTop: 4,
                                      fontSize: 11,
                                      color: "var(--text-muted)",
                                      display: "flex",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: 8,
                                    }}
                                  >
                                    <span>
                                      {new Date(c.createdAt).toLocaleString()}
                                    </span>
                                    {(c.editHistory?.length ?? 0) > 0 && (
                                      <>
                                        <span>· Edited</span>
                                        <button
                                          type="button"
                                          className="btn btn-icon"
                                          style={{
                                            padding: "2px 4px",
                                            minWidth: 20,
                                            fontSize: 11,
                                          }}
                                          onClick={() =>
                                            setCommentHistoryOpenId(
                                              commentHistoryOpenId === c.id
                                                ? null
                                                : c.id
                                            )
                                          }
                                          aria-expanded={
                                            commentHistoryOpenId === c.id
                                          }
                                          aria-label="Toggle edit history"
                                          title="Edit history"
                                        >
                                          {commentHistoryOpenId === c.id
                                            ? "Hide history"
                                            : "History"}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  {commentHistoryOpenId === c.id &&
                                    (c.editHistory?.length ?? 0) > 0 && (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          padding: "8px 10px",
                                          background: "var(--input-bg)",
                                          borderRadius: 4,
                                          border:
                                            "1px solid var(--border-input)",
                                          fontSize: 12,
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 600,
                                            marginBottom: 6,
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          Edit history
                                        </div>
                                        {(c.editHistory ?? []).map(
                                          (entry, i) => (
                                            <div
                                              key={i}
                                              style={{
                                                marginBottom:
                                                  i <
                                                  (c.editHistory?.length ?? 0) -
                                                    1
                                                    ? 8
                                                    : 0,
                                              }}
                                            >
                                              <div
                                                style={{
                                                  whiteSpace: "pre-wrap",
                                                  wordBreak: "break-word",
                                                }}
                                              >
                                                {entry.body}
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: 10,
                                                  color: "var(--text-muted)",
                                                  marginTop: 2,
                                                }}
                                              >
                                                {new Date(
                                                  entry.editedAt
                                                ).toLocaleString()}
                                              </div>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                </>
                              )}
                            </div>
                            {editingCommentId !== c.id && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  flexShrink: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-icon"
                                  style={{ padding: "4px 6px", minWidth: 28 }}
                                  onClick={() => handleStartEditComment(c)}
                                  aria-label="Edit comment"
                                  title="Edit comment"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon"
                                  style={{
                                    padding: "4px 6px",
                                    minWidth: 28,
                                    opacity:
                                      deletingCommentId === c.id ? 0.6 : 1,
                                  }}
                                  onClick={() => handleDeleteComment(c.id)}
                                  disabled={deletingCommentId === c.id}
                                  aria-label={`Delete comment: ${c.body.slice(0, 30)}${c.body.length > 30 ? "…" : ""}`}
                                  title="Delete comment"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {issueCommentsError && (
                <div
                  className="error-banner"
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span>{issueCommentsError}</span>
                  <button
                    type="button"
                    onClick={() => setIssueCommentsError(null)}
                    aria-label="Dismiss"
                    title="Dismiss"
                    style={{
                      background: "none",
                      border: "none",
                      padding: "0 4px",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                      opacity: 0.8,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 16,
                fontSize: 12,
                color: "var(--text-muted)",
              }}
            >
              Status:{" "}
              {STATUSES.find((s) => s.id === selectedIssue.status)?.label ??
                selectedIssue.status}
            </div>
            {issueSaveError && (
              <div
                className="error-banner"
                style={{
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{issueSaveError}</span>
                <button
                  type="button"
                  onClick={() => setIssueSaveError(null)}
                  aria-label="Dismiss"
                  title="Dismiss"
                  style={{
                    background: "none",
                    border: "none",
                    padding: "0 4px",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    opacity: 0.8,
                  }}
                >
                  ×
                </button>
              </div>
            )}
            {issueSaveSuccess &&
              !hasIssueDetailChanges(selectedIssue, issueDetailOriginal) && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 12px",
                    borderRadius: 4,
                    background: "rgba(72,187,120,0.15)",
                    color: "#48bb78",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Saved successfully
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedIssue(null);
                  setIssueDetailOriginal(null);
                  setIssueSaveError(null);
                  setIssueSaveSuccess(false);
                  setAutomatedTestDropdownOpen(false);
                  setAutomatedTestRunResults({});
                  setPlayingRecordingId(null);
                  setEditingRecordingId(null);
                  setEditingScreenshotId(null);
                  setEditingFileId(null);
                  setRecordingError(null);
                  setScreenshotError(null);
                  setFileError(null);
                }}
              >
                Close
              </button>
              {hasIssueDetailChanges(selectedIssue, issueDetailOriginal) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveIssue}
                  disabled={issueSaving}
                >
                  {issueSaving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
