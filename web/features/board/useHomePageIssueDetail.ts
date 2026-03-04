import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchIssueComments,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  addCommentAttachment,
  deleteCommentAttachment,
  updateIssue,
  type Issue,
  type IssueComment,
  type CommentAttachmentType,
} from "../../lib/api/issues";
import { updateProject, type Project } from "../../lib/api/projects";
import {
  uploadIssueRecording,
  updateIssueRecording,
  deleteIssueRecording,
  uploadIssueScreenshot,
  updateIssueScreenshot,
  deleteIssueScreenshot,
  uploadIssueFile,
  deleteIssueFile,
} from "../../lib/api/media";
import { type User } from "../../lib/api/users";
import { runUiTest, type RunUiTestResult } from "../../lib/api/tests";
import { useMediaCapabilities } from "../../lib/useMediaCapabilities";
import {
  getRecordingDisplayLabel,
  getRecordingKind,
  parseAutomatedTests,
  parseTestCases,
  serializeAutomatedTests,
  serializeTestCases,
} from "../../lib/utils";
import {
  insertCommentBlockInDraft,
  insertEditingCommentBlockToState,
  removeEditingCommentBlockFromState,
  serializeEditingBlocksToBody,
  type CommentBlock,
  type CommentBlockText,
} from "./comment-blocks";
import { createCommentCrudHandlers } from "./comment-crud-handlers";
import { createMediaUploadHandlers } from "./media-upload-handlers";
import { createRecordingCrudHandlers } from "./recording-crud";
import { createRecordingSessionHandlers } from "./recording-session";
import { lockScrollToAnchor } from "./scroll-lock";
import { blobToBase64 } from "./media-base64";
import { deriveScreenshotNameFromComments } from "./screenshot-names";
import { hasIssueDetailChanges } from "./issue-detail-utils";
import {
  SCORE_ITEM_DEFINITIONS,
  computeQualityScore,
  getQualityScoreConfig,
} from "./scoring";
import { issueKey } from "./issue-key";
import type { IssueDetailModalProps } from "./IssueDetailModal";

export type UseHomePageIssueDetailOptions = {
  selectedIssue: Issue | null;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  issues: Issue[];
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setError: (v: string | null) => void;
  users: User[];
  setIssueToDelete: (issue: Issue | null) => void;
};

export function useHomePageIssueDetail(
  opts: UseHomePageIssueDetailOptions
): IssueDetailModalProps | null {
  const {
    selectedIssue,
    setSelectedIssue,
    issues,
    setIssues,
    projects,
    setProjects,
    setError,
    users,
    setIssueToDelete,
  } = opts;

  const [issueDetailOriginal, setIssueDetailOriginal] =
    useState<Issue | null>(null);
  const [issueSaving, setIssueSaving] = useState(false);
  const [issueSaveError, setIssueSaveError] = useState<string | null>(null);
  const [issueSaveSuccess, setIssueSaveSuccess] = useState(false);
  const [qualityConfigOpen, setQualityConfigOpen] = useState(false);
  const [qualityConfigSaving, setQualityConfigSaving] = useState(false);
  const [qualityConfigError, setQualityConfigError] = useState<string | null>(
    null
  );
  const [qualityConfigDraft, setQualityConfigDraft] = useState(
    () => getQualityScoreConfig(null)
  );
  const [automatedTestDropdownOpen, setAutomatedTestDropdownOpen] =
    useState(false);
  const [automatedTestRunResults, setAutomatedTestRunResults] = useState<
    Record<string, RunUiTestResult | "running">
  >({});
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
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
  const [issueCommentDraft, setIssueCommentDraft] = useState("");
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
  const automatedTestDropdownRef = useRef<HTMLDivElement>(null);

  const lockScrollPosition = () => {
    lockScrollToAnchor({
      scrollEl: issueDetailModalScrollRef.current,
      anchorEl: commentsSectionRef.current,
      rafRef: scrollLockRafRef,
      timerRef: scrollLockTimerRef,
    });
  };

  const screenshotNameFromComments = useMemo(() => {
    if (!selectedIssue?.id || !selectedIssue.screenshots?.length) {
      return new Map<string, string>();
    }
    const comments = issueComments.filter(
      (c) => c.issueId === selectedIssue.id
    );
    return deriveScreenshotNameFromComments(selectedIssue.screenshots, comments);
  }, [selectedIssue?.id, selectedIssue?.screenshots, issueComments]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedIssue?.projectId) ?? null,
    [projects, selectedIssue?.projectId]
  );

  // Sync issueDetailOriginal when selectedIssue changes
  useEffect(() => {
    if (selectedIssue) {
      setIssueDetailOriginal(selectedIssue);
    } else {
      setIssueDetailOriginal(null);
    }
  }, [selectedIssue?.id]);

  useEffect(() => {
    setQualityConfigDraft(
      getQualityScoreConfig(selectedProject?.qualityScoreConfig ?? null)
    );
    setQualityConfigError(null);
  }, [selectedProject?.id, selectedProject?.qualityScoreConfig]);

  // Reset comment/modal state when no issue selected
  useEffect(() => {
    if (!selectedIssue?.id) {
      setIssueComments([]);
      setIssueCommentSubmitting(false);
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
    document.addEventListener("mousedown", handleClickOutside, true);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside, true);
  }, [automatedTestDropdownOpen]);

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
          const updatedComment = await updateIssueComment(
            selectedIssue.id,
            addingAttachmentToCommentId,
            newBody
          );
          setIssueComments((prev) =>
            prev.map((c) =>
              c.id === addingAttachmentToCommentId ? updatedComment : c
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

  const {
    handleAddComment,
    handleDeleteComment,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveComment,
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
    setEditingCommentBlocks((prev) =>
      insertEditingCommentBlockToState(prev, block)
    );
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

  const handleSaveIssue = async () => {
    if (!selectedIssue) return;
    setIssueSaving(true);
    setIssueSaveError(null);
    setIssueSaveSuccess(false);
    try {
      const qualityScore = computeQualityScore(
        {
          ...selectedIssue,
          commentsCount: issueComments.length,
        },
        selectedProject?.qualityScoreConfig ?? null
      );
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

  const qualityConfigTotal = useMemo(
    () =>
      SCORE_ITEM_DEFINITIONS.reduce(
        (acc, item) => acc + (qualityConfigDraft.weights[item.id] ?? 0),
        0
      ),
    [qualityConfigDraft]
  );

  const openQualityConfig = () => {
    setQualityConfigDraft(
      getQualityScoreConfig(selectedProject?.qualityScoreConfig ?? null)
    );
    setQualityConfigError(null);
    setQualityConfigOpen(true);
  };

  const saveQualityConfig = async () => {
    if (!selectedProject?.id || !selectedIssue) return;
    if (qualityConfigTotal !== 100) {
      setQualityConfigError("Total percentage must equal 100.");
      return;
    }
    setQualityConfigSaving(true);
    setQualityConfigError(null);
    try {
      const updatedProject = await updateProject(selectedProject.id, {
        qualityScoreConfig: qualityConfigDraft,
      });
      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
      );
      setIssues((prev) =>
        prev.map((issue) =>
          issue.projectId === updatedProject.id
            ? {
                ...issue,
                project: updatedProject,
                qualityScore: computeQualityScore(
                  issue,
                  updatedProject.qualityScoreConfig ?? null
                ),
              }
            : issue
        )
      );
      setSelectedIssue((prev) => {
        if (!prev || prev.projectId !== updatedProject.id) return prev;
        return {
          ...prev,
          project: updatedProject,
          qualityScore: computeQualityScore(
            { ...prev, commentsCount: issueComments.length },
            updatedProject.qualityScoreConfig ?? null
          ),
        };
      });
      setIssueDetailOriginal((prev) => {
        if (!prev || prev.projectId !== updatedProject.id) return prev;
        return {
          ...prev,
          project: updatedProject,
          qualityScore: computeQualityScore(
            { ...prev, commentsCount: issueComments.length },
            updatedProject.qualityScoreConfig ?? null
          ),
        };
      });
      setQualityConfigOpen(false);
    } catch (e) {
      setQualityConfigError(
        e instanceof Error ? e.message : "Failed to save quality score config"
      );
    } finally {
      setQualityConfigSaving(false);
    }
  };

  const onClose = () => {
    if (isRecording) return;
    setQualityConfigOpen(false);
    setQualityConfigError(null);
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
  };

  if (!selectedIssue) return null;

  return {
    selectedIssue,
    setSelectedIssue,
    onClose,
    issueDetailModalScrollRef,
    dragOverCount,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    issueKeyFn: issueKey,
    computeQualityScoreFn: (issue) =>
      computeQualityScore(
        {
          ...issue,
          commentsCount:
            issue.id === selectedIssue.id ? issueComments.length : undefined,
        },
        selectedProject?.qualityScoreConfig ?? null
      ),
    issueDetailOriginal,
    issueSaving,
    issueSaveError,
    issueSaveSuccess,
    setIssueSaveError,
    setIssueSaveSuccess,
    hasIssueDetailChangesFn: hasIssueDetailChanges,
    handleSaveIssue,
    qualityConfigOpen,
    setQualityConfigOpen,
    qualityConfigSaving,
    qualityConfigError,
    qualityConfigDraft,
    setQualityConfigDraft,
    qualityConfigTotal,
    qualityScoreItems: SCORE_ITEM_DEFINITIONS,
    openQualityConfig,
    saveQualityConfig,
    setIssueToDelete,
    users,
    parseTestCasesFn: parseTestCases,
    serializeTestCasesFn: serializeTestCases,
    parseAutomatedTestsFn: parseAutomatedTests,
    serializeAutomatedTestsFn: serializeAutomatedTests,
    automatedTestDropdownRef,
    automatedTestDropdownOpen,
    setAutomatedTestDropdownOpen,
    automatedTestRunResults,
    setAutomatedTestRunResults,
    runUiTestFn: runUiTest,
    fileInputRef,
    uploadButtonBusy,
    recordingUploading,
    screenshotUploading,
    fileUploading,
    screenshotsSectionRef,
    screenshotNameFromComments,
    editingScreenshotId,
    editingScreenshotName,
    setEditingScreenshotId,
    setEditingScreenshotName,
    handleSaveScreenshotName,
    handleDeleteScreenshot,
    handleTakeScreenshot,
    handleScreenshotUpload,
    screenshotFileInputRef,
    canScreenRecord,
    screenshotTaking,
    screenshotError,
    setScreenshotError,
    recordingsSectionRef,
    editingRecordingId,
    editingRecordingName,
    setEditingRecordingId,
    setEditingRecordingName,
    handleSaveRecordingName,
    handleDeleteRecording,
    playingRecordingId,
    setPlayingRecordingId,
    recordingPlayerWrapRef,
    recordingPlaybackError,
    setRecordingPlaybackError,
    recordingFor,
    recordingMode,
    stopRecording,
    startRecording,
    startAudioRecording,
    startCameraRecording,
    canCameraRecord,
    canAudioRecord,
    handleUnifiedFileUpload,
    filesSectionRef,
    handleDeleteFile,
    fileError,
    setFileError,
    commentsSectionRef,
    issueComments,
    issueCommentsLoading,
    issueCommentsError,
    setIssueCommentsError,
    editingCommentId,
    commentBoxError,
    commentBlocks,
    setCommentBlocks,
    activeCommentBlockRef,
    issueCommentTextareaRef,
    setCommentBoxError,
    viewingBlockIndex,
    setViewingBlockIndex,
    removeCommentBlock,
    commentVideoFileInputRef,
    commentScreenshotFileInputRef,
    handleCommentVideoFile,
    handleCommentScreenshotFile,
    handleTakeScreenshotAndAddToComment,
    issueCommentSubmitting,
    commentAttachmentUploading,
    handleAddComment,
    editingCommentDraft,
    editingCommentBlocks,
    setEditingCommentBlocks,
    removeEditingCommentBlock,
    handleSaveComment,
    handleCancelEditComment,
    updatingCommentId,
    addingAttachmentToCommentId,
    setAddingAttachmentToCommentId,
    commentHistoryOpenId,
    setCommentHistoryOpenId,
    handleStartEditComment,
    handleDeleteComment,
    deletingCommentId,
    isRecording,
    recordingError,
    setRecordingError,
  };
}
