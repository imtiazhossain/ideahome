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
                  style={{
                    background: "var(--bg-muted)",
                    cursor: "not-allowed",
                  }}
                />
              </div>
              <div className="form-group">
                <label>Title</label>
                <input
                  value={selectedIssue.title ?? ""}
                  onChange={(e) =>
                    setSelectedIssue({
                      ...selectedIssue,
                      title: e.target.value,
                    })
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
                                  const next = lines.filter(
                                    (_, i) => i !== idx
                                  );
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
                          onClick={() =>
                            setAutomatedTestDropdownOpen((o) => !o)
                          }
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
                      <div className="recording-action-section-label">
                        Upload
                      </div>
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
                            <IconUpload size={14} />
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
                      {(selectedIssue.screenshots ?? []).map(
                        (shot, shotIdx) => {
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
                                      if (e.key === "Enter")
                                        e.currentTarget.blur();
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
                                <IconTrash />
                              </button>
                            </div>
                          );
                        }
                      )}
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
                        <IconScreenshot size={14} /> Take Screenshot
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
                    <ErrorBanner
                      message={screenshotError}
                      onDismiss={() => setScreenshotError(null)}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              </div>
              <div className="form-group" ref={recordingsSectionRef}>
                <div className="recording-section">
                  {!isRecording && !recordingUploading && (
                    <div
                      className="recording-actions-wrap"
                      style={{
                        marginTop: (selectedIssue.recordings?.length ?? 0) > 0 ? 8 : 0,
                      }}
                    >
                      {(canScreenRecord ||
                        canCameraRecord ||
                        canAudioRecord) && (
                        <div className="recording-action-section">
                          <div className="recording-action-section-label">
                            Recording
                          </div>
                          {(selectedIssue.recordings?.length ?? 0) > 0 && (
                            <div
                              className="recordings-list"
                              style={{ marginTop: 8, marginBottom: 8 }}
                            >
                              {(selectedIssue.recordings ?? []).map((rec, idx) => {
                                const kind = getRecordingKind(rec);
                                const isAudio = kind === "audio";
                                const label = getRecordingDisplayLabel(
                                  kind,
                                  idx + 1
                                );
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
                                            setEditingRecordingName(
                                              displayLabel
                                            );
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
                                        {new Date(
                                          rec.createdAt
                                        ).toLocaleString()}
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
                                          <IconTrash />
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
                                          <ErrorBanner
                                            message={recordingPlaybackError}
                                            onDismiss={() =>
                                              setRecordingPlaybackError(null)
                                            }
                                            style={{ marginTop: 8 }}
                                          />
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
                                <IconStop size={14} />
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
                                    <IconMic size={14} /> Record Audio
                                  </button>
                                )}
                                {canScreenRecord && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => startRecording()}
                                  >
                                    <IconRecordScreen size={14} /> Record Screen
                                  </button>
                                )}
                                {canCameraRecord && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => startCameraRecording()}
                                  >
                                    <IconRecordCamera size={14} /> Record with
                                    Camera
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
                        <IconStop size={14} />
                      </button>
                    </div>
                  )}
                  {recordingUploading && (
                    <div className="recording-uploading">
                      Uploading recording…
                    </div>
                  )}
                  {recordingError && (
                    <ErrorBanner
                      message={recordingError}
                      onDismiss={() => setRecordingError(null)}
                      style={{ marginTop: 8 }}
                    />
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
                              className="issue-file-link text-sm"
                              style={{ flexShrink: 0 }}
                              aria-label={`Download ${displayName}`}
                            >
                              <IconDownload size={14} />
                            </a>
                            <button
                              type="button"
                              className="btn btn-danger-outline btn-sm btn-icon"
                              onClick={() => handleDeleteFile(f.id)}
                              aria-label={`Delete ${displayName}`}
                              title={`Delete ${displayName}`}
                            >
                              <IconTrash />
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
                    <ErrorBanner
                      message={fileError}
                      onDismiss={() => setFileError(null)}
                      style={{ marginTop: 8 }}
                    />
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
                  <SectionLoadingSpinner />
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
                                className="comment-block-row"
                                style={{ gap: 4 }}
                              >
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
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
                                  {block.attType === "screenshot" ? (
                                    <IconScreenshot size={14} />
                                  ) : (
                                    <IconRecordCamera size={14} />
                                  )}{" "}
                                  {label}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-icon-sm"
                                  onClick={() => removeCommentBlock(bi)}
                                  aria-label="Remove"
                                  title="Remove"
                                >
                                  <IconX size={10} />
                                </button>
                              </div>
                            );
                          }
                          if (block.kind === "recording") {
                            const rec = selectedIssue?.recordings?.find(
                              (r) => r.id === block.recordingId
                            );
                            if (!rec) return null;
                            const kind = getRecordingKind(rec);
                            const rIdx =
                              selectedIssue!.recordings!.indexOf(rec) + 1;
                            const defaultLabel = getRecordingDisplayLabel(
                              kind,
                              rIdx
                            );
                            const displayLabel = rec.name ?? defaultLabel;
                            return (
                              <div
                                key={`rec-${bi}`}
                                className="comment-block-row"
                              >
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  aria-label={`Go to ${displayLabel}`}
                                  title={`Go to ${displayLabel}`}
                                >
                                  <IconPlay size={14} /> {displayLabel}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-icon-sm"
                                  onClick={() => removeCommentBlock(bi)}
                                  aria-label="Remove"
                                  title="Remove"
                                >
                                  <IconX size={10} />
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
                                className="comment-block-row"
                              >
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  aria-label={`Go to ${displayLabel}`}
                                  title={`Go to ${displayLabel}`}
                                >
                                  <IconScreenshot size={14} /> {displayLabel}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-icon-sm"
                                  onClick={() => removeCommentBlock(bi)}
                                  aria-label="Remove"
                                  title="Remove"
                                >
                                  <IconX size={10} />
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
                                className="comment-block-row"
                              >
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  aria-label={`Go to file ${f.fileName}`}
                                  title={`Go to file ${f.fileName}`}
                                >
                                  <IconUpload size={14} /> {f.fileName}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-icon btn-icon-sm"
                                  onClick={() => removeCommentBlock(bi)}
                                  aria-label="Remove"
                                  title="Remove"
                                >
                                  <IconX size={10} />
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                      {viewingBlockIndex !== null &&
                        commentBlocks[viewingBlockIndex]?.kind ===
                          "attachment" &&
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
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            commentVideoFileInputRef.current?.click()
                          }
                          disabled={
                            issueCommentSubmitting || commentAttachmentUploading
                          }
                          aria-label="Upload file (image, video, audio, PDF, or any file)"
                          title="Upload file (image, video, audio, PDF, or any file)"
                        >
                          <IconUpload size={14} />
                        </button>
                        {canScreenRecord && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
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
                            <IconScreenshot size={14} />
                          </button>
                        )}
                        {canAudioRecord &&
                          (isRecording && recordingMode === "audio" ? (
                            <button
                              type="button"
                              className="btn btn-danger-outline btn-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                stopRecording();
                              }}
                              aria-label="Stop"
                              title="Stop"
                            >
                              <IconStop size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
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
                              <IconMic size={14} />
                            </button>
                          ))}
                        {canScreenRecord &&
                          (recordingFor === "comment-pending" &&
                          recordingMode === "screen" ? (
                            <button
                              type="button"
                              className="btn btn-danger-outline btn-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                stopRecording();
                              }}
                              aria-label="Stop"
                              title="Stop"
                            >
                              <IconStop size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
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
                              <IconRecordScreen size={14} />
                            </button>
                          ))}
                        {canCameraRecord &&
                          (recordingFor === "comment-pending" &&
                          recordingMode === "camera" ? (
                            <button
                              type="button"
                              className="btn btn-danger-outline btn-sm"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                stopRecording();
                              }}
                              aria-label="Stop"
                              title="Stop"
                            >
                              <IconStop size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() =>
                                startCameraRecording({
                                  forCommentPending: true,
                                })
                              }
                              disabled={
                                issueCommentSubmitting ||
                                isRecording ||
                                recordingUploading
                              }
                              aria-label="Record with Camera"
                              title="Record with Camera"
                            >
                              <IconRecordCamera size={14} />
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
                                r.id ===
                                (b as CommentBlockRecording).recordingId
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
                              <div
                                style={{ flex: 1, minWidth: 0, minHeight: 0 }}
                              >
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
                                              className="comment-block-row"
                                            >
                                              <span
                                                className="btn btn-secondary btn-sm"
                                                style={{
                                                  cursor: "default",
                                                  pointerEvents: "none",
                                                }}
                                              >
                                                <IconScreenshot size={14} />{" "}
                                                {displayLabel}
                                              </span>
                                              <button
                                                type="button"
                                                className="btn btn-icon btn-icon-sm"
                                                onClick={() =>
                                                  removeEditingCommentBlock(bi)
                                                }
                                                aria-label="Remove"
                                                title="Remove"
                                              >
                                                <IconX size={10} />
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
                                          const kind = getRecordingKind(rec);
                                          const rIdx =
                                            selectedIssue!.recordings!.indexOf(
                                              rec
                                            ) + 1;
                                          const defaultLabel =
                                            getRecordingDisplayLabel(
                                              kind,
                                              rIdx
                                            );
                                          const displayLabel =
                                            rec.name ?? defaultLabel;
                                          return (
                                            <div
                                              key={`edit-rec-${bi}`}
                                              className="comment-block-row"
                                            >
                                              <span
                                                className="btn btn-secondary btn-sm"
                                                style={{
                                                  cursor: "default",
                                                  pointerEvents: "none",
                                                }}
                                              >
                                                <IconPlay size={14} />{" "}
                                                {displayLabel}
                                              </span>
                                              <button
                                                type="button"
                                                className="btn btn-icon btn-icon-sm"
                                                onClick={() =>
                                                  removeEditingCommentBlock(bi)
                                                }
                                                aria-label="Remove"
                                                title="Remove"
                                              >
                                                <IconX size={10} />
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
                                              className="comment-block-row"
                                            >
                                              <span
                                                className="btn btn-secondary btn-sm"
                                                style={{
                                                  cursor: "default",
                                                  pointerEvents: "none",
                                                }}
                                              >
                                                <IconUpload size={14} />{" "}
                                                {f.fileName}
                                              </span>
                                              <button
                                                type="button"
                                                className="btn btn-icon btn-icon-sm"
                                                onClick={() =>
                                                  removeEditingCommentBlock(bi)
                                                }
                                                aria-label="Remove"
                                                title="Remove"
                                              >
                                                <IconX size={10} />
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
                                        className="btn btn-secondary btn-sm"
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
                                        <IconUpload size={14} />
                                      </button>
                                      {canScreenRecord && (
                                        <button
                                          type="button"
                                          className="btn btn-secondary btn-sm"
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
                                          <IconScreenshot size={14} />
                                        </button>
                                      )}
                                      {canAudioRecord &&
                                        (recordingFor === c.id &&
                                        recordingMode === "audio" ? (
                                          <button
                                            type="button"
                                            className="btn btn-danger-outline btn-sm"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              stopRecording();
                                            }}
                                            aria-label="Stop"
                                            title="Stop"
                                          >
                                            <IconStop size={14} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
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
                                            <IconMic size={14} />
                                          </button>
                                        ))}
                                      {canScreenRecord &&
                                        (recordingFor === c.id &&
                                        recordingMode === "screen" ? (
                                          <button
                                            type="button"
                                            className="btn btn-danger-outline btn-sm"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              stopRecording();
                                            }}
                                            aria-label="Stop"
                                            title="Stop"
                                          >
                                            <IconStop size={14} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
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
                                            <IconRecordScreen size={14} />
                                          </button>
                                        ))}
                                      {canCameraRecord &&
                                        (recordingFor === c.id &&
                                        recordingMode === "camera" ? (
                                          <button
                                            type="button"
                                            className="btn btn-danger-outline btn-sm"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              stopRecording();
                                            }}
                                            aria-label="Stop"
                                            title="Stop"
                                          >
                                            <IconStop size={14} />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
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
                                            <IconRecordCamera size={14} />
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
                                                  editingCommentBlocks,
                                                  selectedIssue
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
                                          screenshots:
                                            selectedIssue?.screenshots,
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
                                          onScrollToScreenshot: (
                                            id: string
                                          ) => {
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
                                          border:
                                            "1px solid var(--border-input)",
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
                                            className="btn btn-secondary btn-sm"
                                            onClick={() =>
                                              commentVideoFileInputRef.current?.click()
                                            }
                                            disabled={
                                              commentAttachmentUploading
                                            }
                                            aria-label="Upload file (image, video, audio, PDF, or any file)"
                                            title="Upload file (image, video, audio, PDF, or any file)"
                                          >
                                            <IconUpload size={14} />
                                          </button>
                                          {canScreenRecord && (
                                            <button
                                              type="button"
                                              className="btn btn-secondary btn-sm"
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
                                              <IconScreenshot size={14} />
                                            </button>
                                          )}
                                          {canAudioRecord &&
                                            (recordingFor === c.id &&
                                            recordingMode === "audio" ? (
                                              <button
                                                type="button"
                                                className="btn btn-danger-outline btn-sm"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  stopRecording();
                                                }}
                                                aria-label="Stop"
                                                title="Stop"
                                              >
                                                <IconStop size={14} />
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  startAudioRecording({
                                                    forCommentId: c.id,
                                                  })
                                                }
                                                disabled={isRecording}
                                                aria-label="Record Audio"
                                                title="Record Audio"
                                              >
                                                <IconMic size={14} />
                                              </button>
                                            ))}
                                          {canScreenRecord &&
                                            (recordingFor === c.id &&
                                            recordingMode === "screen" ? (
                                              <button
                                                type="button"
                                                className="btn btn-danger-outline btn-sm"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  stopRecording();
                                                }}
                                                aria-label="Stop"
                                                title="Stop"
                                              >
                                                <IconStop size={14} />
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  startRecording({
                                                    forCommentId: c.id,
                                                  })
                                                }
                                                disabled={isRecording}
                                                aria-label="Record Screen"
                                                title="Record Screen"
                                              >
                                                <IconRecordScreen size={14} />
                                              </button>
                                            ))}
                                          {canCameraRecord &&
                                            (recordingFor === c.id &&
                                            recordingMode === "camera" ? (
                                              <button
                                                type="button"
                                                className="btn btn-danger-outline btn-sm"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  stopRecording();
                                                }}
                                                aria-label="Stop"
                                                title="Stop"
                                              >
                                                <IconStop size={14} />
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() =>
                                                  startCameraRecording({
                                                    forCommentId: c.id,
                                                  })
                                                }
                                                disabled={isRecording}
                                                aria-label="Record with Camera"
                                                title="Record with Camera"
                                              >
                                                <IconRecordCamera size={14} />
                                              </button>
                                            ))}
                                          <button
                                            type="button"
                                            className="btn btn-icon btn-sm"
                                            onClick={() =>
                                              setAddingAttachmentToCommentId(
                                                null
                                              )
                                            }
                                            aria-label="Cancel"
                                            title="Cancel"
                                          >
                                            <IconX size={14} />
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
                                            className="btn btn-icon btn-icon-sm-hint"
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
                                                    (c.editHistory?.length ??
                                                      0) -
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
                                    <IconEdit size={14} />
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
                                    <IconTrash />
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
                  <ErrorBanner
                    message={issueCommentsError}
                    onDismiss={() => setIssueCommentsError(null)}
                    style={{ marginTop: 8 }}
                  />
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
                <ErrorBanner
                  message={issueSaveError}
                  onDismiss={() => setIssueSaveError(null)}
                  style={{ marginTop: 12 }}
                />
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
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => setIssueToDelete(selectedIssue)}
                aria-label={`Delete ${selectedIssue.title || "issue"}`}
                title="Delete issue"
              >
                <IconTrash />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
