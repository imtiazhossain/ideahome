import React, { type RefObject } from "react";
import { getRecordingUrl } from "../../lib/api/media";
import { ErrorBanner } from "../../components/ErrorBanner";
import {
  IconMic,
  IconRecordCamera,
  IconRecordScreen,
  IconStop,
} from "../../components/icons";
import { IconTrash } from "../../components/IconTrash";
import {
  getRecordingDisplayLabel,
  getRecordingKind,
} from "../../lib/utils";

export type IssueDetailModalRecordingsProps = {
  recordings: Array<{
    id: string;
    videoUrl: string;
    name?: string | null;
    createdAt: string;
    mediaType?: "video" | "audio";
    recordingType?: "screen" | "camera" | "audio";
  }>;
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
  startRecording: () => void;
  startAudioRecording: () => void;
  startCameraRecording: () => void;
  canScreenRecord: boolean;
  canCameraRecord: boolean;
  canAudioRecord: boolean;
  isRecording: boolean;
  recordingUploading: boolean;
  recordingError: string | null;
  setRecordingError: (v: string | null) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  handleUnifiedFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export function IssueDetailModalRecordings({
  recordings,
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
  canScreenRecord,
  canCameraRecord,
  canAudioRecord,
  isRecording,
  recordingUploading,
  recordingError,
  setRecordingError,
  fileInputRef,
  handleUnifiedFileUpload,
}: IssueDetailModalRecordingsProps) {
  return (
    <div className="form-group" ref={recordingsSectionRef}>
      <div className="recording-section">
        {!isRecording && !recordingUploading && (
          <div
            className="recording-actions-wrap"
            style={{
              marginTop: recordings.length > 0 ? 8 : 0,
            }}
          >
            {(canScreenRecord || canCameraRecord || canAudioRecord) && (
              <div className="recording-action-section">
                <div className="recording-action-section-label">
                  Recording
                </div>
                {recordings.length > 0 && (
                  <div
                    className="recordings-list"
                    style={{ marginTop: 8, marginBottom: 8 }}
                  >
                    {recordings.map((rec, idx) => {
                      const kind = getRecordingKind(rec);
                      const isAudio = kind === "audio";
                      const label = getRecordingDisplayLabel(kind, idx + 1);
                      const displayLabel = rec.name ?? label;
                      const isEditingName = editingRecordingId === rec.id;
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
                                  setEditingRecordingName(e.target.value)
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
                                    setEditingRecordingName(displayLabel);
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
                                onClick={() => handleDeleteRecording(rec.id)}
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
                                      typeof navigator !== "undefined" &&
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
                                  Your browser does not support the video
                                  tag.
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
                          <IconRecordCamera size={14} /> Record with Camera
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
  );
}
