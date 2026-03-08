import React, { type RefObject } from "react";
import { getRecordingUrl, getScreenshotUrl } from "../../lib/api/media";
import type { Issue, IssueComment } from "../../lib/api/issues";
import { ErrorBanner } from "../../components/ErrorBanner";
import { CloseButton } from "../../components/CloseButton";
import {
  IconEdit,
  IconMic,
  IconPlay,
  IconRecordCamera,
  IconRecordScreen,
  IconScreenshot,
  IconStop,
  IconUpload,
} from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";
import { SectionLoadingSpinner } from "../../components/SectionLoadingSpinner";
import { getRecordingDisplayLabel, getRecordingKind } from "../../lib/utils";
import { PendingAttachmentVideoPlayer } from "./PendingAttachmentVideoPlayer";
import { CommentBlockRow } from "./CommentBlockRow";
import { commentBodyWithFileButtons } from "./comment-utils";
import { serializeEditingBlocksToBody } from "./comment-blocks";
import type {
  CommentBlock,
  CommentBlockAttachment,
  CommentBlockText,
  CommentBlockRecording,
  CommentBlockScreenshot,
  CommentBlockFile,
} from "./comment-blocks";

export type IssueDetailModalCommentsProps = {
  commentsSectionRef: RefObject<HTMLDivElement>;
  issueDetailModalScrollRef: RefObject<HTMLDivElement>;
  issueComments: IssueComment[];
  issueCommentsLoading: boolean;
  issueCommentsError: string | null;
  setIssueCommentsError: (v: string | null) => void;
  editingCommentId: string | null;
  commentBoxError: boolean;
  commentBlocks: CommentBlock[];
  setCommentBlocks: React.Dispatch<React.SetStateAction<CommentBlock[]>>;
  activeCommentBlockRef: React.MutableRefObject<number>;
  issueCommentTextareaRef: RefObject<HTMLTextAreaElement>;
  setCommentBoxError: (v: boolean) => void;
  viewingBlockIndex: number | null;
  setViewingBlockIndex: (v: number | null) => void;
  removeCommentBlock: (blockIdx: number) => void;
  commentVideoFileInputRef: RefObject<HTMLInputElement>;
  commentScreenshotFileInputRef: RefObject<HTMLInputElement>;
  handleCommentVideoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCommentScreenshotFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTakeScreenshotAndAddToComment: () => void;
  issueCommentSubmitting: boolean;
  commentAttachmentUploading: boolean;
  handleAddComment: () => void;
  editingCommentDraft: string;
  editingCommentBlocks: CommentBlock[] | null;
  setEditingCommentBlocks: React.Dispatch<React.SetStateAction<CommentBlock[] | null>>;
  removeEditingCommentBlock: (blockIdx: number) => void;
  handleSaveComment: () => void;
  handleCancelEditComment: () => void;
  updatingCommentId: string | null;
  addingAttachmentToCommentId: string | null;
  setAddingAttachmentToCommentId: (v: string | null) => void;
  commentHistoryOpenId: string | null;
  setCommentHistoryOpenId: (v: string | null) => void;
  handleStartEditComment: (c: IssueComment) => void;
  handleDeleteComment: (commentId: string) => void;
  deletingCommentId: string | null;
  selectedIssue: Issue;
  isRecording: boolean;
  recordingError: string | null;
  setRecordingError: (v: string | null) => void;
  recordingFor: "issue" | "comment-pending" | string | null;
  recordingMode: "screen" | "camera" | "audio" | null;
  stopRecording: () => void;
  startRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  startAudioRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  startCameraRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  canScreenRecord: boolean;
  canCameraRecord: boolean;
  canAudioRecord: boolean;
  recordingUploading: boolean;
  screenshotUploading: boolean;
  screenshotTaking: boolean;
};

export function IssueDetailModalComments(props: IssueDetailModalCommentsProps) {
  const {
    commentsSectionRef,
    issueDetailModalScrollRef,
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
    selectedIssue,
    isRecording,
    setRecordingError,
    recordingFor,
    recordingMode,
    stopRecording,
    startRecording,
    startAudioRecording,
    startCameraRecording,
    canScreenRecord,
    canCameraRecord,
    canAudioRecord,
    recordingUploading,
    screenshotUploading,
    screenshotTaking,
  } = props;

  const activeEditingComment = React.useMemo(
    () =>
      editingCommentId
        ? issueComments.find((comment) => comment.id === editingCommentId) ?? null
        : null,
    [editingCommentId, issueComments]
  );
  const editedCommentBody = React.useMemo(
    () =>
      (
        editingCommentBlocks
          ? serializeEditingBlocksToBody(editingCommentBlocks, selectedIssue)
          : editingCommentDraft
      ).trim(),
    [editingCommentBlocks, editingCommentDraft, selectedIssue]
  );
  const hasEditedCommentChanges = React.useMemo(
    () =>
      activeEditingComment
        ? editedCommentBody !== (activeEditingComment.body ?? "").trim()
        : false,
    [activeEditingComment, editedCommentBody]
  );

  return (
    <div className="form-group issue-modal-field expenses-field" ref={commentsSectionRef}>
      <label>Comments</label>
      {issueCommentsLoading ? (
        <SectionLoadingSpinner />
      ) : (
        <>
          <div
            className="issue-comment-composer-wrap"
            style={{ display: editingCommentId ? "none" : undefined }}
          >
            <div
              className={`form-control issue-comment-composer${commentBoxError ? " is-error" : ""}`}
              style={{
                padding: 10,
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
                      spellCheck
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
                  const attLabel =
                    block.name ??
                    (block.attType === "screenshot"
                      ? "Screenshot"
                      : block.attType === "screen_recording"
                        ? "Screen recording"
                        : block.attType === "camera_recording"
                          ? "Camera recording"
                          : "Video");
                  return (
                    <CommentBlockRow
                      key={`att-${bi}`}
                      dataCommentBlockIndex={bi}
                      label={attLabel}
                      openAriaLabel={`Open ${attLabel}`}
                      icon={
                        block.attType === "screenshot" ? (
                          <IconScreenshot size={14} />
                        ) : (
                          <IconRecordCamera size={14} />
                        )
                      }
                      onOpen={() => {
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
                      onRemove={() => removeCommentBlock(bi)}
                    />
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
                    <CommentBlockRow
                      key={`rec-${bi}`}
                      label={displayLabel}
                      openAriaLabel={`Go to ${displayLabel}`}
                      icon={<IconPlay size={14} />}
                      onRemove={() => removeCommentBlock(bi)}
                    />
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
                    <CommentBlockRow
                      key={`shot-${bi}`}
                      label={displayLabel}
                      openAriaLabel={`Go to ${displayLabel}`}
                      icon={<IconScreenshot size={14} />}
                      onRemove={() => removeCommentBlock(bi)}
                    />
                  );
                }
                if (block.kind === "file") {
                  const f = selectedIssue?.files?.find(
                    (x) => x.id === block.fileId
                  );
                  if (!f) return null;
                  return (
                    <CommentBlockRow
                      key={`file-${bi}`}
                      label={f.fileName}
                      openAriaLabel={`Go to file ${f.fileName}`}
                      icon={<IconUpload size={14} />}
                      onRemove={() => removeCommentBlock(bi)}
                    />
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
              className="issue-comment-toolbar"
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
                title="Upload File (Image, Video, Audio, PDF, or Any File)"
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
                    title="Record With Camera"
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
              className="issue-comment-composer-actions"
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
                  className="expenses-add-btn issue-comment-add-btn"
                  onClick={handleAddComment}
                  disabled={issueCommentSubmitting}
                >
                  {issueCommentSubmitting ? "Adding…" : "Add"}
                </button>
              )}
            </div>
          </div>
          {issueComments.length > 0 && (
            <ul className="issue-comments-list">
              {issueComments.map((c) => (
                <li
                  key={c.id}
                  className={`issue-comment${editingCommentId === c.id ? " is-editing" : ""}`}
                >
                  <div className="issue-comment-row">
                    <div className="issue-comment-body">
                      {editingCommentId === c.id ? (
                        <>
                          <div
                            className="form-control issue-comment-editor"
                            style={{
                              padding: 10,
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
                                    spellCheck
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
                                    <CloseButton
                                      className="btn btn-icon btn-icon-sm"
                                      size="sm"
                                      onClick={() =>
                                        removeEditingCommentBlock(bi)
                                      }
                                      aria-label="Remove"
                                      title="Remove"
                                    />
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
                                    <CloseButton
                                      className="btn btn-icon btn-icon-sm"
                                      size="sm"
                                      onClick={() =>
                                        removeEditingCommentBlock(bi)
                                      }
                                      aria-label="Remove"
                                      title="Remove"
                                    />
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
                                    <CloseButton
                                      className="btn btn-icon btn-icon-sm"
                                      size="sm"
                                      onClick={() =>
                                        removeEditingCommentBlock(bi)
                                      }
                                      aria-label="Remove"
                                      title="Remove"
                                    />
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                          <div
                            className="issue-comment-toolbar"
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
                              title="Upload File (Image, Video, Audio, PDF, or Any File)"
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
                                  title="Record With Camera"
                                >
                                  <IconRecordCamera size={14} />
                                </button>
                              ))}
                          </div>
                          <div
                            className="issue-comment-editor-actions"
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              marginBottom: 8,
                            }}
                          >
                            {updatingCommentId === c.id || hasEditedCommentChanges ? (
                              <button
                                type="button"
                                className="expenses-add-btn issue-comment-save-btn"
                                onClick={handleSaveComment}
                                disabled={updatingCommentId === c.id || !editedCommentBody}
                              >
                                {updatingCommentId === c.id
                                  ? "Saving…"
                                  : "Save"}
                              </button>
                            ) : null}
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
                              className="issue-comment-attach-panel"
                              style={{
                                marginTop: 8,
                                padding: 8,
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
                                className="issue-comment-toolbar"
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
                                  title="Upload File (Image, Video, Audio, PDF, or Any File)"
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
                                      title="Record With Camera"
                                    >
                                      <IconRecordCamera size={14} />
                                    </button>
                                  ))}
                                <CloseButton
                                  className="btn btn-icon btn-sm"
                                  size="sm"
                                  onClick={() =>
                                    setAddingAttachmentToCommentId(
                                      null
                                    )
                                  }
                                  aria-label="Cancel"
                                  title="Cancel"
                                />
                              </div>
                            </div>
                          )}
                          <div
                            className="issue-comment-meta"
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
                                  title="Edit History"
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
                                className="issue-comment-history"
                                style={{
                                  marginTop: 8,
                                  padding: "8px 10px",
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
                        className="issue-comment-actions"
                        style={{
                          display: "flex",
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <button
                          type="button"
                          className="btn btn-icon"
                          onClick={() => handleStartEditComment(c)}
                          aria-label="Edit comment"
                          title="Edit Comment"
                        >
                          <IconEdit size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon"
                          style={{ opacity: deletingCommentId === c.id ? 0.6 : 1 }}
                          onClick={() => handleDeleteComment(c.id)}
                          disabled={deletingCommentId === c.id}
                          aria-label={`Delete comment: ${c.body.slice(0, 30)}${c.body.length > 30 ? "…" : ""}`}
                          title="Delete Comment"
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
  );
}
