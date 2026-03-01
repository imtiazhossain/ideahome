import React, { type RefObject } from "react";
import Link from "next/link";
import {
  getRecordingUrl,
  getScreenshotUrl,
  type IssueScreenshot,
} from "../../lib/api/media";
import { STATUSES, type Issue, type IssueComment } from "../../lib/api/issues";
import { runUiTest, type RunUiTestResult } from "../../lib/api/tests";
import { uiTests, testNameToSlug } from "../../lib/ui-tests";
import { type User } from "../../lib/api/users";
import { AutoResizeTextarea } from "../../components/AutoResizeTextarea";
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
  IconX,
} from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";
import { SectionLoadingSpinner } from "../../components/SectionLoadingSpinner";
import {
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
        <IssueDetailModalHeader
          selectedIssue={selectedIssue}
          issueKeyFn={issueKeyFn}
          computeQualityScoreFn={computeQualityScoreFn}
          onClose={onClose}
        />
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
              const lines = parseTestCasesFn(selectedIssue.testCases);
              const updateCases = (nextLines: string[]) => {
                setSelectedIssue({
                  ...selectedIssue,
                  testCases: serializeTestCasesFn(nextLines) ?? "",
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
              const selectedTests = parseAutomatedTestsFn(
                selectedIssue.automatedTest
              );
              const toggleTest = (testName: string) => {
                const next = selectedTests.includes(testName)
                  ? selectedTests.filter((t) => t !== testName)
                  : [...selectedTests, testName];
                setSelectedIssue({
                  ...selectedIssue,
                  automatedTest: serializeAutomatedTestsFn(next) ?? "",
                });
              };
              const removeTest = (testName: string) => {
                const next = selectedTests.filter((t) => t !== testName);
                setSelectedIssue({
                  ...selectedIssue,
                  automatedTest: serializeAutomatedTestsFn(next) ?? "",
                });
              };
              const runTest = async (testName: string) => {
                setAutomatedTestRunResults((prev) => ({
                  ...prev,
                  [testName]: "running",
                }));
                try {
                  const result = await runUiTestFn(testName);
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
        </div>
        <IssueDetailModalActions
          selectedIssue={selectedIssue}
          issueDetailOriginal={issueDetailOriginal}
          hasIssueDetailChangesFn={hasIssueDetailChangesFn}
          handleSaveIssue={handleSaveIssue}
          issueSaving={issueSaving}
          setIssueToDelete={setIssueToDelete}
        />
      </div>
    </div>
  );
}
