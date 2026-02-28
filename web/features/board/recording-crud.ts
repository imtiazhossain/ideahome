import type React from "react";
import type { Issue } from "../../lib/api/issues";

export function createRecordingCrudHandlers(deps: {
  selectedIssue: Issue | null;
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  setIssueDetailOriginal: React.Dispatch<React.SetStateAction<Issue | null>>;
  setRecordingError: (value: string | null) => void;
  setEditingRecordingId: (value: string | null) => void;
  editingRecordingId: string | null;
  setPlayingRecordingId: (value: string | null) => void;
  playingRecordingId: string | null;
  updateIssueRecording: (
    issueId: string,
    recordingId: string,
    data: {
      mediaType?: "video" | "audio";
      recordingType?: "screen" | "camera" | "audio";
      name?: string | null;
    }
  ) => Promise<Issue>;
  deleteIssueRecording: (issueId: string, recordingId: string) => Promise<Issue>;
}) {
  const {
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
  } = deps;

  const handleUpdateRecordingType = async (
    recordingId: string,
    kind: "audio" | "screen" | "camera"
  ) => {
    if (!selectedIssue) return;
    setRecordingError(null);
    const mediaType = kind === "audio" ? "audio" : "video";
    const recordingType = kind;
    try {
      const updated = await updateIssueRecording(selectedIssue.id, recordingId, {
        mediaType,
        recordingType,
      });
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
      const updated = await updateIssueRecording(selectedIssue.id, recordingId, {
        name: value,
      });
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

  return {
    handleUpdateRecordingType,
    handleSaveRecordingName,
    handleDeleteRecording,
  };
}
