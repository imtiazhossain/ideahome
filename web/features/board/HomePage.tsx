import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  getStoredToken,
  isAuthenticated,
  isSkipLoginDev,
} from "../../lib/api/auth";
import {
  fetchProjects,
  fetchOrganizations,
  ensureOrganization,
  createOrganization,
  createProject,
  updateProject,
  deleteProject,
  type Organization,
  type Project,
} from "../../lib/api/projects";
import {
  fetchIssues,
  fetchIssue,
  createIssue,
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
  STATUSES,
  type Issue,
  type IssueComment,
  type CommentAttachmentType,
} from "../../lib/api/issues";
import {
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
  type IssueRecording,
  type IssueScreenshot,
  type IssueFile,
} from "../../lib/api/media";
import { fetchUsers, type User } from "../../lib/api/users";
import { runUiTest, type RunUiTestResult } from "../../lib/api/tests";
import { uiTests, testNameToSlug } from "../../lib/ui-tests";
import { AppLayout } from "../../components/AppLayout";
import { AutoResizeTextarea } from "../../components/AutoResizeTextarea";
import { ConfirmModal } from "../../components/ConfirmModal";
import { CreateIssueModal } from "../../components/CreateIssueModal";
import { CreateProjectModal } from "../../components/CreateProjectModal";
import { ErrorBanner } from "../../components/ErrorBanner";
import {
  IconDownload,
  IconEdit,
  IconMic,
  IconPlay,
  IconRecordCamera,
  IconRecordScreen,
  IconScreenshot,
  IconStop,
  IconUpload,
  IconVideo,
  IconX,
} from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";
import { SectionLoadingSpinner } from "../../components/SectionLoadingSpinner";
import { useMediaCapabilities } from "../../lib/useMediaCapabilities";
import { useSelectedProject } from "../../lib/SelectedProjectContext";
import {
  getProjectDisplayName,
  getRecordingDisplayLabel,
  getRecordingKind,
  parseAutomatedTests,
  parseTestCases,
  serializeAutomatedTests,
  serializeTestCases,
} from "../../lib/utils";
import { computeQualityScore } from "./scoring";
import { PendingAttachmentVideoPlayer } from "./PendingAttachmentVideoPlayer";
import { commentBodyWithFileButtons } from "./comment-utils";
import {
  insertCommentBlockInDraft,
  insertEditingCommentBlockToState,
  parseCommentBodyToBlocks,
  removeCommentBlockFromDraft,
  removeEditingCommentBlockFromState,
  serializeEditingBlocksToBody,
  type CommentBlock,
  type CommentBlockText,
  type CommentBlockAttachment,
  type CommentBlockRecording,
  type CommentBlockScreenshot,
  type CommentBlockFile,
} from "./comment-blocks";
import { hasIssueDetailChanges } from "./issue-detail-utils";
import { blobToBase64 } from "./media-base64";
import { deriveScreenshotNameFromComments } from "./screenshot-names";
import { createRecordingCrudHandlers } from "./recording-crud";
import { createRecordingSessionHandlers } from "./recording-session";
import { createMediaUploadHandlers } from "./media-upload-handlers";
import { createCommentCrudHandlers } from "./comment-crud-handlers";
import { lockScrollToAnchor } from "./scroll-lock";
import { issueKey } from "./issue-key";
import { IssueDetailModal } from "./IssueDetailModal";
import { BoardColumn, IssueCard } from "./BoardDnd";
import { useTheme } from "../../pages/_app";

export default function Home() {
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const {
    selectedProjectId,
    setSelectedProjectId,
    lastKnownProjectName,
    setLastKnownProjectName,
  } = useSelectedProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
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
  const { canScreenRecord, canCameraRecord, canAudioRecord } =
    useMediaCapabilities();
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

  const lockScrollPosition = () => {
    lockScrollToAnchor({
      scrollEl: issueDetailModalScrollRef.current,
      anchorEl: commentsSectionRef.current,
      rafRef: scrollLockRafRef,
      timerRef: scrollLockTimerRef,
    });
  };

  /** Derive screenshot display names from comment bodies when shot.name is missing (e.g. legacy or Take Screenshot). */
  const screenshotNameFromComments = useMemo(() => {
    if (!selectedIssue?.id || !selectedIssue.screenshots?.length) {
      return new Map<string, string>();
    }
    const comments = issueComments.filter(
      (c) => c.issueId === selectedIssue.id
    );
    return deriveScreenshotNameFromComments(selectedIssue.screenshots, comments);
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
            const kind = getRecordingKind(newRec);
            const rIdx = recordings.indexOf(newRec) + 1;
            const defaultLabel = getRecordingDisplayLabel(kind, rIdx);
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

  const {
    startRecording,
    startCameraRecording,
    startAudioRecording,
    stopRecording,
  } = createRecordingSessionHandlers({
    setRecordingError,
    recordingDestinationRef,
    setRecordingFor,
    recordingModeRef,
    recordingUploadForCommentDraftRef,
    mediaStreamRef,
    mediaRecorderRef,
    recordedChunksRef,
    setRecordingMode,
    setIsRecording,
    onRecorderStopUpload: uploadRecordedChunks,
  });

  const {
    handleUpdateRecordingType,
    handleSaveRecordingName,
    handleDeleteRecording,
  } = createRecordingCrudHandlers({
    selectedIssue,
    setIssues,
    setSelectedIssue,
    setIssueDetailOriginal,
    setRecordingError,
    setEditingRecordingId,
    editingRecordingId,
    setPlayingRecordingId,
    playingRecordingId,
    updateIssueRecording,
    deleteIssueRecording,
  });

  const {
    classifyFile,
    handleScreenshotUpload,
    handleSaveScreenshotName,
    handleDeleteScreenshot,
    handleDeleteFile,
    uploadClassifiedFile,
    handleUnifiedFileUpload,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    captureScreenToBase64,
    handleTakeScreenshot,
  } = createMediaUploadHandlers({
    selectedIssue,
    screenshotCaptureMaxWidth,
    setIssues,
    setSelectedIssue,
    setIssueDetailOriginal,
    setUploadButtonBusy,
    setDragOverCount,
    setScreenshotError,
    setScreenshotUploading,
    setScreenshotTaking,
    setRecordingError,
    setRecordingUploading,
    setFileError,
    setFileUploading,
    uploadIssueScreenshot,
    uploadIssueRecording,
    uploadIssueFile,
    updateIssueScreenshot,
    deleteIssueScreenshot,
    deleteIssueFile,
    setEditingScreenshotId,
    editingScreenshotId,
  });

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
          const newBody = serializeEditingBlocksToBody(nextBlocks, selectedIssue);
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

  const selectedProjectIdRef = useRef(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;
  const handledCreateProjectQueryRef = useRef<string | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (data.length) {
        const current = selectedProjectIdRef.current;
        const exists = data.some((p) => p.id === current);
        if (!exists) setSelectedProjectId(data[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setProjectsLoaded(true);
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
    if (isSkipLoginDev()) {
      setAuthResolved(true);
      loadProjects();
      return;
    }
    if (!getStoredToken()) {
      router.replace("/login");
      return;
    }
    setAuthResolved(true);
    loadProjects();
  }, [router]);

  // When token is cleared (e.g. logout in another tab), redirect to login
  useEffect(() => {
    if (!authResolved) return;
    const check = () => {
      if (!isAuthenticated()) router.replace("/login");
    };
    window.addEventListener("storage", check);
    const interval = setInterval(check, 1000);
    return () => {
      window.removeEventListener("storage", check);
      clearInterval(interval);
    };
  }, [authResolved, router]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const name = projects.find((p) => p.id === selectedProjectId)?.name;
    if (name) setLastKnownProjectName(name);
  }, [projects, selectedProjectId, setLastKnownProjectName]);

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

  const handleCreateProjectWithName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const previousSelectedProjectId = selectedProjectId;
      const tempId = `temp-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticProject: Project = { id: tempId, name: trimmed };
      setProjectCreateError(null);
      setProjectSubmitting(true);
      setProjects((prev) => [...prev, optimisticProject]);
      setSelectedProjectId(tempId);
      setLastKnownProjectName(trimmed);
      try {
        if (organizations.length === 0) {
          await ensureOrganization();
          const list = await fetchOrganizations();
          setOrganizations(list);
        }
        const project = await createProject({ name: trimmed });
        setProjects((prev) => prev.map((p) => (p.id === tempId ? project : p)));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(project.id);
        }
        setLastKnownProjectName(project.name);
        if (router.pathname !== "/") {
          await router.push("/");
        }
      } catch (e) {
        setProjects((prev) => prev.filter((p) => p.id !== tempId));
        if (selectedProjectIdRef.current === tempId) {
          setSelectedProjectId(previousSelectedProjectId);
        }
        setProjectCreateError(
          e instanceof Error ? e.message : "Failed to create project"
        );
      } finally {
        setProjectSubmitting(false);
      }
    },
    [
      organizations.length,
      selectedProjectId,
      setLastKnownProjectName,
      setSelectedProjectId,
    ]
  );

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

  // When user has no projects, prompt them to add one at the beginning
  const hasPromptedNoProjectsRef = useRef(false);
  useEffect(() => {
    if (
      projectsLoaded &&
      projects.length === 0 &&
      !hasPromptedNoProjectsRef.current
    ) {
      hasPromptedNoProjectsRef.current = true;
      setCreateProjectOpen(true);
    }
  }, [projectsLoaded, projects.length]);

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

  // Open create project modal when navigating with ?createProject=1 (e.g. from project switcher)
  // When projectName is provided, create directly without opening modal
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.createProject;
    const nameParam = router.query.projectName;
    const name =
      typeof nameParam === "string" && nameParam.trim()
        ? nameParam.trim()
        : null;
    if (q !== "1") {
      handledCreateProjectQueryRef.current = null;
      return;
    }
    const queryKey = name ?? "__open_modal__";
    if (handledCreateProjectQueryRef.current === queryKey) return;
    handledCreateProjectQueryRef.current = queryKey;
    if (q === "1") {
      router.replace("/", undefined, { shallow: true });
      if (name) {
        void handleCreateProjectWithName(name);
      } else {
        setCreateProjectOpen(true);
      }
    }
  }, [
    router.isReady,
    router.query.createProject,
    router.query.projectName,
    handleCreateProjectWithName,
  ]);

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

  const handleDeleteProject = async (project?: Project | null) => {
    const target = project ?? projectToDelete;
    if (!target) return;
    const previousProjects = projects;
    const previousIssues = issues;
    const previousSelectedProjectId = selectedProjectId;
    setProjectDeleting(true);
    setError(null);
    setProjectToDelete(null);
    setProjects((prev) => prev.filter((p) => p.id !== target.id));
    setIssues((prev) => prev.filter((i) => i.projectId !== target.id));
    if (selectedProjectId === target.id) {
      setSelectedProjectId("");
      setIssues([]);
    }
    try {
      await deleteProject(target.id);
      await loadProjects();
    } catch (e) {
      setProjects(previousProjects);
      setIssues(previousIssues);
      if (previousSelectedProjectId === target.id) {
        setSelectedProjectId(previousSelectedProjectId);
      }
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
    const previousSelectedProjectId = selectedProjectId;
    const tempId = `temp-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticProject: Project = { id: tempId, name: projectName };
    setProjectSubmitting(true);
    setProjects((prev) => [...prev, optimisticProject]);
    setSelectedProjectId(tempId);
    setLastKnownProjectName(projectName);
    try {
      if (organizations.length === 0) {
        if (newOrgName.trim()) {
          await createOrganization({ name: newOrgName.trim() });
        } else {
          await ensureOrganization();
        }
        const list = await fetchOrganizations();
        setOrganizations(list);
        if (list.length > 0) setNewProjectOrgId(list[0].id);
      }
      const project = await createProject({ name: projectName });
      setProjects((prev) => prev.map((p) => (p.id === tempId ? project : p)));
      if (selectedProjectIdRef.current === tempId) {
        setSelectedProjectId(project.id);
      }
      setLastKnownProjectName(project.name);
      if (router.pathname !== "/") {
        await router.push("/");
      }
      setCreateProjectOpen(false);
      setNewProjectName("");
      setNewProjectOrgId("");
      setNewOrgName("");
    } catch (e) {
      setProjects((prev) => prev.filter((p) => p.id !== tempId));
      if (selectedProjectIdRef.current === tempId) {
        setSelectedProjectId(previousSelectedProjectId);
      }
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

  const {
    handleAddComment,
    handleDeleteComment,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveComment,
    handleDeleteCommentAttachment,
  } = createCommentCrudHandlers({
    selectedIssue,
    commentBlocks,
    editingCommentBlocks,
    editingCommentDraft,
    editingCommentId,
    editingCommentIssueId,
    createIssueComment,
    addCommentAttachment,
    deleteIssueComment,
    updateIssueComment,
    deleteCommentAttachment,
    setIssueComments,
    setIssueCommentDraft,
    setCommentDraftRecordingId,
    setCommentBlocks,
    activeCommentBlockRef,
    setPendingCommentAttachments,
    setViewingPendingAttachmentIndex,
    setViewingBlockIndex,
    setIssueCommentSubmitting,
    setIssueCommentsError,
    setCommentBoxError,
    setDeletingCommentId,
    setEditingCommentId,
    setEditingCommentIssueId,
    setEditingCommentDraft,
    setEditingCommentBlocks,
    setUpdatingCommentId,
  });

  const removeEditingCommentBlock = (blockIdx: number) => {
    setEditingCommentBlocks((prev) =>
      removeEditingCommentBlockFromState(prev, blockIdx)
    );
  };

  const insertEditingCommentBlock = (block: CommentBlock) => {
    setEditingCommentBlocks((prev) => insertEditingCommentBlockToState(prev, block));
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
              const newBody = serializeEditingBlocksToBody(nextBlocks, selectedIssue);
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
    setCommentBlocks((prev) => insertCommentBlockInDraft(prev, block));
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

  const boardSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleBoardDragStart = React.useCallback((event: DragStartEvent) => {
    const issueId = (event.active.data.current as { issueId?: string } | undefined)
      ?.issueId;
    setDraggingIssueId(issueId ?? null);
  }, []);

  const handleBoardDragOver = React.useCallback((event: DragOverEvent) => {
    const status = (event.over?.data.current as { status?: string } | undefined)
      ?.status;
    setDragOverColumnId(status ?? null);
  }, []);

  const handleBoardDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const issueId = (event.active.data.current as { issueId?: string } | undefined)
        ?.issueId;
      const targetStatus = (event.over?.data.current as { status?: string } | undefined)
        ?.status;
      setDraggingIssueId(null);
      setDragOverColumnId(null);
      if (!issueId || !targetStatus) return;
      const issue = issues.find((item) => item.id === issueId);
      if (!issue || issue.status === targetStatus) return;
      handleStatusChange(issueId, targetStatus);
    },
    [issues, handleStatusChange]
  );

  const handleBoardDragCancel = React.useCallback(() => {
    setDraggingIssueId(null);
    setDragOverColumnId(null);
  }, []);

  if (!authResolved || !isAuthenticated()) {
    return null;
  }

  const projectDisplayName = getProjectDisplayName(
    projects,
    selectedProjectId,
    lastKnownProjectName,
    projectsLoaded
  );

  return (
    <AppLayout
      title="Idea Home"
      activeTab="board"
      projectName={projectDisplayName}
      projectId={selectedProjectId || undefined}
      searchPlaceholder="Search project"
      drawerOpen={drawerOpen}
      setDrawerOpen={setDrawerOpen}
      projects={projects}
      selectedProjectId={selectedProjectId ?? ""}
      setSelectedProjectId={setSelectedProjectId}
      editingProjectId={editingProjectId}
      setEditingProjectId={setEditingProjectId}
      editingProjectName={editingProjectName}
      setEditingProjectName={setEditingProjectName}
      saveProjectName={saveProjectName}
      cancelEditProjectName={cancelEditProjectName}
      projectNameInputRef={projectNameInputRef}
      theme={theme}
      toggleTheme={toggleTheme}
      projectToDelete={projectToDelete}
      setProjectToDelete={setProjectToDelete}
      projectDeleting={projectDeleting}
      handleDeleteProject={handleDeleteProject}
      onNewProjectClick={() => setCreateProjectOpen(true)}
      onAddClick={() => setCreateOpen(true)}
      onCreateProject={handleCreateProjectWithName}
      onDeleteAllIssuesClick={() => setDeleteAllConfirmOpen(true)}
      deleteAllIssuesDisabled={loading || issues.length === 0}
    >
      {error && (
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
      )}

      <div className="board-container">
        {loading ? (
          <div className="tests-page-single-loading">
            <SectionLoadingSpinner />
          </div>
        ) : (
          <DndContext
            sensors={boardSensors}
            collisionDetection={closestCenter}
            onDragStart={handleBoardDragStart}
            onDragOver={handleBoardDragOver}
            onDragEnd={handleBoardDragEnd}
            onDragCancel={handleBoardDragCancel}
          >
            <div className="board-columns">
              {STATUSES.map(({ id, label }) => {
                const columnIssues = issuesByStatusForDisplay[id] ?? [];
                const isPreviewColumn =
                  dragOverColumnId === id && draggingIssueId;
                return (
                  <BoardColumn
                    key={id}
                    id={id}
                    label={label}
                    count={columnIssues.length}
                    isDropTarget={dragOverColumnId === id}
                  >
                    {columnIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        onSelect={(nextIssue) => {
                          setSelectedIssue(nextIssue);
                          setIssueDetailOriginal(nextIssue);
                        }}
                        draggingIssueId={draggingIssueId}
                        isPreview={
                          !!(isPreviewColumn && issue.id === draggingIssueId)
                        }
                      />
                    ))}
                  </BoardColumn>
                );
              })}
            </div>
          </DndContext>
        )}
      </div>

      <CreateIssueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        setSelectedProjectId={setSelectedProjectId}
        title={createTitle}
        setTitle={setCreateTitle}
        description={createDescription}
        setDescription={setCreateDescription}
        acceptanceCriteria={createAcceptanceCriteria}
        setAcceptanceCriteria={setCreateAcceptanceCriteria}
        database={createDatabase}
        setDatabase={setCreateDatabase}
        api={createApi}
        setApi={setCreateApi}
        testCases={createTestCases}
        setTestCases={setCreateTestCases}
        assigneeId={createAssigneeId}
        setAssigneeId={setCreateAssigneeId}
        users={users}
        error={createError}
        onDismissError={() => setCreateError(null)}
        submitting={submitting}
        onSubmit={handleCreate}
      />

      {issueToDelete && (
        <ConfirmModal
          title="Delete issue"
          message={
            <>
              Delete &quot;{issueToDelete.title || "Untitled"}&quot;? This will
              permanently remove the issue.
            </>
          }
          confirmLabel="Delete"
          confirmBusyLabel="Deleting…"
          busy={issueDeleting}
          onClose={() => setIssueToDelete(null)}
          onConfirm={handleDeleteIssue}
          modalStyle={{ maxWidth: 400 }}
          overlayClassName="modal-overlay--above-detail"
        />
      )}

      {deleteAllConfirmOpen && (
        <ConfirmModal
          title="Delete all issues"
          message={
            selectedProjectId
              ? "Permanently delete all issues in this project?"
              : "Permanently delete all issues? This cannot be undone."
          }
          confirmLabel="Delete all"
          confirmBusyLabel="Deleting…"
          busy={deleteAllDeleting}
          onClose={() => setDeleteAllConfirmOpen(false)}
          onConfirm={handleDeleteAllIssues}
          modalStyle={{ maxWidth: 400 }}
        />
      )}

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        organizations={organizations}
        newOrgName={newOrgName}
        setNewOrgName={setNewOrgName}
        newProjectOrgId={newProjectOrgId}
        setNewProjectOrgId={setNewProjectOrgId}
        newProjectName={newProjectName}
        setNewProjectName={setNewProjectName}
        error={projectCreateError}
        onDismissError={() => setProjectCreateError(null)}
        submitting={projectSubmitting}
        onSubmit={handleCreateProject}
      />

      {selectedIssue && (
        <IssueDetailModal
          selectedIssue={selectedIssue}
          setSelectedIssue={setSelectedIssue}
          onClose={() => {
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
          issueDetailModalScrollRef={issueDetailModalScrollRef}
          dragOverCount={dragOverCount}
          handleDragOver={handleDragOver}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          issueKeyFn={issueKey}
          computeQualityScoreFn={computeQualityScore}
          issueDetailOriginal={issueDetailOriginal}
          issueSaving={issueSaving}
          issueSaveError={issueSaveError}
          issueSaveSuccess={issueSaveSuccess}
          setIssueSaveError={setIssueSaveError}
          setIssueSaveSuccess={setIssueSaveSuccess}
          hasIssueDetailChangesFn={hasIssueDetailChanges}
          handleSaveIssue={handleSaveIssue}
          setIssueToDelete={setIssueToDelete}
          users={users}
          parseTestCasesFn={parseTestCases}
          serializeTestCasesFn={serializeTestCases}
          parseAutomatedTestsFn={parseAutomatedTests}
          serializeAutomatedTestsFn={serializeAutomatedTests}
          automatedTestDropdownRef={automatedTestDropdownRef}
          automatedTestDropdownOpen={automatedTestDropdownOpen}
          setAutomatedTestDropdownOpen={setAutomatedTestDropdownOpen}
          automatedTestRunResults={automatedTestRunResults}
          setAutomatedTestRunResults={setAutomatedTestRunResults}
          runUiTestFn={runUiTest}
          fileInputRef={fileInputRef}
          uploadButtonBusy={uploadButtonBusy}
          recordingUploading={recordingUploading}
          screenshotUploading={screenshotUploading}
          fileUploading={fileUploading}
          screenshotsSectionRef={screenshotsSectionRef}
          screenshotNameFromComments={screenshotNameFromComments}
          editingScreenshotId={editingScreenshotId}
          editingScreenshotName={editingScreenshotName}
          setEditingScreenshotId={setEditingScreenshotId}
          setEditingScreenshotName={setEditingScreenshotName}
          handleSaveScreenshotName={handleSaveScreenshotName}
          handleDeleteScreenshot={handleDeleteScreenshot}
          handleTakeScreenshot={handleTakeScreenshot}
          handleScreenshotUpload={handleScreenshotUpload}
          screenshotFileInputRef={screenshotFileInputRef}
          canScreenRecord={canScreenRecord}
          screenshotTaking={screenshotTaking}
          screenshotError={screenshotError}
          setScreenshotError={setScreenshotError}
          recordingsSectionRef={recordingsSectionRef}
          editingRecordingId={editingRecordingId}
          editingRecordingName={editingRecordingName}
          setEditingRecordingId={setEditingRecordingId}
          setEditingRecordingName={setEditingRecordingName}
          handleSaveRecordingName={handleSaveRecordingName}
          handleDeleteRecording={handleDeleteRecording}
          playingRecordingId={playingRecordingId}
          setPlayingRecordingId={setPlayingRecordingId}
          recordingPlayerWrapRef={recordingPlayerWrapRef}
          recordingPlaybackError={recordingPlaybackError}
          setRecordingPlaybackError={setRecordingPlaybackError}
          recordingFor={recordingFor}
          recordingMode={recordingMode}
          stopRecording={stopRecording}
          startRecording={startRecording}
          startAudioRecording={startAudioRecording}
          startCameraRecording={startCameraRecording}
          canCameraRecord={canCameraRecord}
          canAudioRecord={canAudioRecord}
          handleUnifiedFileUpload={handleUnifiedFileUpload}
          filesSectionRef={filesSectionRef}
          handleDeleteFile={handleDeleteFile}
          fileError={fileError}
          setFileError={setFileError}
          commentsSectionRef={commentsSectionRef}
          issueComments={issueComments}
          issueCommentsLoading={issueCommentsLoading}
          issueCommentsError={issueCommentsError}
          setIssueCommentsError={setIssueCommentsError}
          editingCommentId={editingCommentId}
          commentBoxError={commentBoxError}
          commentBlocks={commentBlocks}
          setCommentBlocks={setCommentBlocks}
          activeCommentBlockRef={activeCommentBlockRef}
          issueCommentTextareaRef={issueCommentTextareaRef}
          setCommentBoxError={setCommentBoxError}
          viewingBlockIndex={viewingBlockIndex}
          setViewingBlockIndex={setViewingBlockIndex}
          removeCommentBlock={removeCommentBlock}
          commentVideoFileInputRef={commentVideoFileInputRef}
          commentScreenshotFileInputRef={commentScreenshotFileInputRef}
          handleCommentVideoFile={handleCommentVideoFile}
          handleCommentScreenshotFile={handleCommentScreenshotFile}
          handleTakeScreenshotAndAddToComment={handleTakeScreenshotAndAddToComment}
          issueCommentSubmitting={issueCommentSubmitting}
          commentAttachmentUploading={commentAttachmentUploading}
          handleAddComment={handleAddComment}
          editingCommentDraft={editingCommentDraft}
          editingCommentBlocks={editingCommentBlocks}
          setEditingCommentBlocks={setEditingCommentBlocks}
          removeEditingCommentBlock={removeEditingCommentBlock}
          handleSaveComment={handleSaveComment}
          handleCancelEditComment={handleCancelEditComment}
          updatingCommentId={updatingCommentId}
          addingAttachmentToCommentId={addingAttachmentToCommentId}
          setAddingAttachmentToCommentId={setAddingAttachmentToCommentId}
          commentHistoryOpenId={commentHistoryOpenId}
          setCommentHistoryOpenId={setCommentHistoryOpenId}
          handleStartEditComment={handleStartEditComment}
          handleDeleteComment={handleDeleteComment}
          deletingCommentId={deletingCommentId}
          isRecording={isRecording}
          recordingError={recordingError}
          setRecordingError={setRecordingError}
        />
      )}
    </AppLayout>
  );
}
