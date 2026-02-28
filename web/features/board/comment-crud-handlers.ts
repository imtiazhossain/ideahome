import type React from "react";
import type {
  CommentAttachmentType,
  Issue,
  IssueComment,
} from "../../lib/api/issues";
import type { CommentBlock } from "./comment-blocks";
import { getRecordingDisplayLabel, getRecordingKind } from "../../lib/utils";
import {
  parseCommentBodyToBlocks,
  serializeEditingBlocksToBody,
} from "./comment-blocks";

function buildCommentBodyAndAttachments(
  commentBlocks: CommentBlock[],
  selectedIssue: Issue
): {
  commentBody: string;
  attachments: Array<{
    type: CommentAttachmentType;
    imageBase64?: string;
    videoBase64?: string;
  }>;
} {
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
      const rec = selectedIssue.recordings.find((r) => r.id === block.recordingId);
      if (rec) {
        const kind = getRecordingKind(rec);
        const rIdx = selectedIssue.recordings.indexOf(rec) + 1;
        const defaultLabel = getRecordingDisplayLabel(kind, rIdx);
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
  return { commentBody: textParts.join("\n"), attachments };
}

export function createCommentCrudHandlers(deps: {
  selectedIssue: Issue | null;
  commentBlocks: CommentBlock[];
  editingCommentBlocks: CommentBlock[] | null;
  editingCommentDraft: string;
  editingCommentId: string | null;
  editingCommentIssueId: string | null;
  createIssueComment: (issueId: string, body: string) => Promise<IssueComment>;
  addCommentAttachment: (
    issueId: string,
    commentId: string,
    body: {
      type: CommentAttachmentType;
      imageBase64?: string;
      videoBase64?: string;
    }
  ) => Promise<IssueComment>;
  deleteIssueComment: (issueId: string, commentId: string) => Promise<void>;
  updateIssueComment: (
    issueId: string,
    commentId: string,
    body: string
  ) => Promise<IssueComment>;
  deleteCommentAttachment: (
    issueId: string,
    commentId: string,
    attachmentId: string
  ) => Promise<IssueComment>;
  setIssueComments: React.Dispatch<React.SetStateAction<IssueComment[]>>;
  setIssueCommentDraft: (value: string) => void;
  setCommentDraftRecordingId: (value: string | null) => void;
  setCommentBlocks: React.Dispatch<React.SetStateAction<CommentBlock[]>>;
  activeCommentBlockRef: React.MutableRefObject<number>;
  setPendingCommentAttachments: React.Dispatch<
    React.SetStateAction<
      Array<{
        type: CommentAttachmentType;
        imageBase64?: string;
        videoBase64?: string;
        name?: string;
      }>
    >
  >;
  setViewingPendingAttachmentIndex: (value: number | null) => void;
  setViewingBlockIndex: (value: number | null) => void;
  setIssueCommentSubmitting: (value: boolean) => void;
  setIssueCommentsError: (value: string | null) => void;
  setCommentBoxError: (value: boolean) => void;
  setDeletingCommentId: (value: string | null) => void;
  setEditingCommentId: (value: string | null) => void;
  setEditingCommentIssueId: (value: string | null) => void;
  setEditingCommentDraft: (value: string) => void;
  setEditingCommentBlocks: (value: CommentBlock[] | null) => void;
  setUpdatingCommentId: (value: string | null) => void;
}) {
  const {
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
  } = deps;

  const handleAddComment = async () => {
    if (!selectedIssue?.id) return;
    const { commentBody, attachments } = buildCommentBodyAndAttachments(
      commentBlocks,
      selectedIssue
    );
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
          updatedComment = await addCommentAttachment(selectedIssue.id, comment.id, {
            type: "screenshot",
            imageBase64: att.imageBase64,
          });
        } else if (att.videoBase64) {
          updatedComment = await addCommentAttachment(selectedIssue.id, comment.id, {
            type: att.type,
            videoBase64: att.videoBase64,
          });
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
      setIssueCommentsError(e instanceof Error ? e.message : "Failed to add comment");
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

  const handleStartEditComment = (c: IssueComment) => {
    setEditingCommentId(c.id);
    setEditingCommentIssueId(c.issueId);
    setEditingCommentDraft(c.body);
    setEditingCommentBlocks(parseCommentBodyToBlocks(c.body, selectedIssue ?? null));
    setIssueCommentsError(null);
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentIssueId(null);
    setEditingCommentDraft("");
    setEditingCommentBlocks(null);
  };

  const handleSaveComment = async () => {
    const issueId = editingCommentIssueId ?? selectedIssue?.id;
    if (!issueId || !editingCommentId) return;
    const body = editingCommentBlocks
      ? serializeEditingBlocksToBody(editingCommentBlocks, selectedIssue)
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

  return {
    handleAddComment,
    handleDeleteComment,
    handleStartEditComment,
    handleCancelEditComment,
    handleSaveComment,
    handleDeleteCommentAttachment,
  };
}
