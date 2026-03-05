import React, { type RefObject } from "react";
import {
  getRecordingUrl,
  getScreenshotUrl,
  type IssueScreenshot,
} from "../../lib/api/media";
import { STATUSES, type Issue, type IssueComment } from "../../lib/api/issues";
import { type RunUiTestResult } from "../../lib/api/tests";
import { type User } from "../../lib/api/users";
import {
  type ProjectQualityScoreConfig,
  type QualityScoreItemId,
} from "../../lib/api";
import { ErrorBanner } from "../../components/ErrorBanner";
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
import {
  getRecordingDisplayLabel,
  getRecordingKind,
} from "../../lib/utils";
import { computeQualityScore } from "./scoring";
import { PendingAttachmentVideoPlayer } from "./PendingAttachmentVideoPlayer";
import { commentBodyWithFileButtons } from "./comment-utils";
import {
  serializeEditingBlocksToBody,
  type CommentBlock,
  type CommentBlockAttachment,
  type CommentBlockText,
  type CommentBlockRecording,
  type CommentBlockScreenshot,
  type CommentBlockFile,
} from "./comment-blocks";
import { IssueDetailModalHeader } from "./IssueDetailModalHeader";
import { IssueDetailModalActions } from "./IssueDetailModalActions";
import { IssueDetailModalScreenshots } from "./IssueDetailModalScreenshots";
import { IssueDetailModalRecordings } from "./IssueDetailModalRecordings";
import { IssueDetailModalFiles } from "./IssueDetailModalFiles";
import { IssueDetailModalComments } from "./IssueDetailModalComments";
import { IssueDetailModalFormFields } from "./IssueDetailModalFormFields";
import { IssueDetailModalAutomatedTests } from "./IssueDetailModalAutomatedTests";
import { IssueQualityScoreConfigModal } from "./IssueQualityScoreConfigModal";

export type IssueDetailModalProps = {
  selectedIssue: Issue;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  onClose: () => void;
  issueDetailModalScrollRef: RefObject<HTMLDivElement>;
  dragOverCount: number;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  issueKeyFn: (issue: Issue) => string;
  computeQualityScoreFn: (issue: Issue) => number;
  issueDetailOriginal: Issue | null;
  issueSaving: boolean;
  issueSaveError: string | null;
  issueSaveSuccess: boolean;
  setIssueSaveError: (v: string | null) => void;
  setIssueSaveSuccess: (v: boolean) => void;
  hasIssueDetailChangesFn: (issue: Issue, original: Issue | null) => boolean;
  handleSaveIssue: () => Promise<void>;
  qualityConfigOpen: boolean;
  setQualityConfigOpen: React.Dispatch<React.SetStateAction<boolean>>;
  qualityConfigSaving: boolean;
  qualityConfigError: string | null;
  qualityConfigDraft: ProjectQualityScoreConfig;
  setQualityConfigDraft: React.Dispatch<
    React.SetStateAction<ProjectQualityScoreConfig>
  >;
  qualityConfigTotal: number;
  qualityScoreItems: Array<{ id: QualityScoreItemId; label: string }>;
  openQualityConfig: () => void;
  saveQualityConfig: () => Promise<void>;
  setIssueToDelete: (issue: Issue | null) => void;
  users: User[];
  parseTestCasesFn: (s: string | null | undefined) => string[];
  serializeTestCasesFn: (lines: string[]) => string | null;
  parseAutomatedTestsFn: (s: string | null | undefined) => string[];
  serializeAutomatedTestsFn: (tests: string[]) => string | null;
  automatedTestDropdownRef: RefObject<HTMLDivElement>;
  automatedTestDropdownOpen: boolean;
  setAutomatedTestDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  automatedTestRunResults: Record<string, RunUiTestResult | "running">;
  setAutomatedTestRunResults: React.Dispatch<
    React.SetStateAction<Record<string, RunUiTestResult | "running">>
  >;
  runUiTestFn: (testName: string) => Promise<RunUiTestResult>;
  fileInputRef: RefObject<HTMLInputElement>;
  uploadButtonBusy: boolean;
  recordingUploading: boolean;
  screenshotUploading: boolean;
  fileUploading: boolean;
  screenshotsSectionRef: RefObject<HTMLDivElement>;
  screenshotNameFromComments: Map<string, string>;
  editingScreenshotId: string | null;
  editingScreenshotName: string;
  setEditingScreenshotId: (v: string | null) => void;
  setEditingScreenshotName: (v: string) => void;
  handleSaveScreenshotName: (id: string, name: string) => void;
  handleDeleteScreenshot: (id: string) => void;
  handleTakeScreenshot: () => void;
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  screenshotFileInputRef: RefObject<HTMLInputElement>;
  canScreenRecord: boolean;
  screenshotTaking: boolean;
  screenshotError: string | null;
  setScreenshotError: (v: string | null) => void;
  recordingsSectionRef: RefObject<HTMLDivElement>;
  editingRecordingId: string | null;
  editingRecordingName: string;
  setEditingRecordingId: (v: string | null) => void;
  setEditingRecordingName: (v: string) => void;
  handleSaveRecordingName: (id: string, name: string) => void;
  handleDeleteRecording: (id: string) => void;
  playingRecordingId: string | null;
  setPlayingRecordingId: (v: string | null) => void;
  recordingPlayerWrapRef: RefObject<HTMLDivElement>;
  recordingPlaybackError: string | null;
  setRecordingPlaybackError: (v: string | null) => void;
  recordingFor: "issue" | "comment-pending" | string | null;
  recordingMode: "screen" | "camera" | "audio" | null;
  stopRecording: () => void;
  startRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  startAudioRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  startCameraRecording: (opts?: { forCommentPending?: boolean; forCommentId?: string }) => void;
  canCameraRecord: boolean;
  canAudioRecord: boolean;
  handleUnifiedFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  filesSectionRef: RefObject<HTMLDivElement>;
  handleDeleteFile: (id: string) => void;
  fileError: string | null;
  setFileError: (v: string | null) => void;
  commentsSectionRef: RefObject<HTMLDivElement>;
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
  isRecording: boolean;
  recordingError: string | null;
  setRecordingError: (v: string | null) => void;
};

export function IssueDetailModal(props: IssueDetailModalProps) {
  const {
    selectedIssue,
    setSelectedIssue,
    onClose,
    issueDetailModalScrollRef,
    dragOverCount,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    issueKeyFn,
    computeQualityScoreFn,
    issueDetailOriginal,
    issueSaving,
    issueSaveError,
    issueSaveSuccess,
    setIssueSaveError,
    setIssueSaveSuccess,
    hasIssueDetailChangesFn,
    handleSaveIssue,
    qualityConfigOpen,
    setQualityConfigOpen,
    qualityConfigSaving,
    qualityConfigError,
    qualityConfigDraft,
    setQualityConfigDraft,
    qualityConfigTotal,
    qualityScoreItems,
    openQualityConfig,
    saveQualityConfig,
    setIssueToDelete,
    users,
    parseTestCasesFn,
    serializeTestCasesFn,
    parseAutomatedTestsFn,
    serializeAutomatedTestsFn,
    automatedTestDropdownRef,
    automatedTestDropdownOpen,
    setAutomatedTestDropdownOpen,
    automatedTestRunResults,
    setAutomatedTestRunResults,
    runUiTestFn,
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
  } = props;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        ref={issueDetailModalScrollRef}
        className={`modal modal--fit-screen modal--issue-detail issue-detail-modal-finance${dragOverCount > 0 ? " is-drag-over" : ""}`}
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
        <IssueDetailModalHeader
          selectedIssue={selectedIssue}
          issueKeyFn={issueKeyFn}
          computeQualityScoreFn={computeQualityScoreFn}
          openQualityConfig={openQualityConfig}
          qualityConfigSaving={qualityConfigSaving}
          onClose={onClose}
        />
        <div className="modal-body modal-body--scrollable issue-detail-modal-body">
          <section className="tests-page-section expenses-add-section issue-detail-modal-main-section">
            <IssueDetailModalFormFields
              selectedIssue={selectedIssue}
              setSelectedIssue={setSelectedIssue}
              users={users}
              parseTestCasesFn={parseTestCasesFn}
              serializeTestCasesFn={serializeTestCasesFn}
            />
            <IssueDetailModalAutomatedTests
              selectedIssue={selectedIssue}
              setSelectedIssue={setSelectedIssue}
              parseAutomatedTestsFn={parseAutomatedTestsFn}
              serializeAutomatedTestsFn={serializeAutomatedTestsFn}
              automatedTestDropdownRef={automatedTestDropdownRef}
              automatedTestDropdownOpen={automatedTestDropdownOpen}
              setAutomatedTestDropdownOpen={setAutomatedTestDropdownOpen}
              automatedTestRunResults={automatedTestRunResults}
              setAutomatedTestRunResults={setAutomatedTestRunResults}
              runUiTestFn={runUiTestFn}
            />
            {!isRecording && (
              <div className="form-group issue-modal-field expenses-field">
                <div className="recording-section">
                  <div className="recording-action-section">
                    <div className="recording-action-section-label">
                      Upload
                    </div>
                    <div className="recording-actions">
                      <button
                        type="button"
                        className="expenses-add-btn issue-modal-upload-btn"
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
            <IssueDetailModalScreenshots
              screenshots={selectedIssue.screenshots ?? []}
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
              screenshotUploading={screenshotUploading}
              screenshotError={screenshotError}
              setScreenshotError={setScreenshotError}
              screenshotsSectionRef={screenshotsSectionRef}
            />
            <IssueDetailModalRecordings
              recordings={selectedIssue.recordings ?? []}
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
              canScreenRecord={canScreenRecord}
              canCameraRecord={canCameraRecord}
              canAudioRecord={canAudioRecord}
              isRecording={isRecording}
              recordingUploading={recordingUploading}
              recordingError={recordingError}
              setRecordingError={setRecordingError}
              fileInputRef={fileInputRef}
              handleUnifiedFileUpload={handleUnifiedFileUpload}
            />
            <IssueDetailModalFiles
              issueId={selectedIssue.id}
              files={selectedIssue.files ?? []}
              filesSectionRef={filesSectionRef}
              handleDeleteFile={handleDeleteFile}
              uploadButtonBusy={uploadButtonBusy}
              fileUploading={fileUploading}
              fileError={fileError}
              setFileError={setFileError}
              dragOverCount={dragOverCount}
            />
            <IssueDetailModalComments
              commentsSectionRef={commentsSectionRef}
              issueDetailModalScrollRef={issueDetailModalScrollRef}
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
              selectedIssue={selectedIssue}
              isRecording={isRecording}
              recordingError={recordingError}
              setRecordingError={setRecordingError}
              recordingFor={recordingFor}
              recordingMode={recordingMode}
              stopRecording={stopRecording}
              startRecording={startRecording}
              startAudioRecording={startAudioRecording}
              startCameraRecording={startCameraRecording}
              canScreenRecord={canScreenRecord}
              canCameraRecord={canCameraRecord}
              canAudioRecord={canAudioRecord}
              recordingUploading={recordingUploading}
              screenshotUploading={screenshotUploading}
              screenshotTaking={screenshotTaking}
            />

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
              !hasIssueDetailChangesFn(selectedIssue, issueDetailOriginal) && (
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
          </section>
        </div>
        <IssueDetailModalActions
          selectedIssue={selectedIssue}
          issueDetailOriginal={issueDetailOriginal}
          hasIssueDetailChangesFn={hasIssueDetailChangesFn}
          handleSaveIssue={handleSaveIssue}
          issueSaving={issueSaving}
          setIssueToDelete={setIssueToDelete}
        />
        <IssueQualityScoreConfigModal
          open={qualityConfigOpen}
          onClose={() => setQualityConfigOpen(false)}
          saving={qualityConfigSaving}
          error={qualityConfigError}
          config={qualityConfigDraft}
          setConfig={setQualityConfigDraft}
          total={qualityConfigTotal}
          items={qualityScoreItems}
          onSave={saveQualityConfig}
        />
      </div>
    </div>
  );
}
