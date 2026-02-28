import type React from "react";
import type { Issue } from "../../lib/api/issues";

function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function createMediaUploadHandlers(deps: {
  selectedIssue: Issue | null;
  screenshotCaptureMaxWidth: number | null;
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  setIssueDetailOriginal: React.Dispatch<React.SetStateAction<Issue | null>>;
  setUploadButtonBusy: (value: boolean) => void;
  setDragOverCount: React.Dispatch<React.SetStateAction<number>>;
  setScreenshotError: (value: string | null) => void;
  setScreenshotUploading: (value: boolean) => void;
  setScreenshotTaking: (value: boolean) => void;
  setRecordingError: (value: string | null) => void;
  setRecordingUploading: (value: boolean) => void;
  setFileError: (value: string | null) => void;
  setFileUploading: (value: boolean) => void;
  uploadIssueScreenshot: (
    issueId: string,
    imageBase64: string,
    fileName?: string
  ) => Promise<Issue>;
  uploadIssueRecording: (
    issueId: string,
    videoBase64: string,
    mediaType?: "video" | "audio",
    recordingType?: "screen" | "camera" | "audio",
    fileName?: string
  ) => Promise<Issue>;
  uploadIssueFile: (
    issueId: string,
    fileBase64: string,
    fileName: string
  ) => Promise<Issue>;
  updateIssueScreenshot: (
    issueId: string,
    screenshotId: string,
    data: { name?: string | null }
  ) => Promise<Issue>;
  deleteIssueScreenshot: (issueId: string, screenshotId: string) => Promise<Issue>;
  deleteIssueFile: (issueId: string, fileId: string) => Promise<Issue>;
  setEditingScreenshotId: (value: string | null) => void;
  editingScreenshotId: string | null;
}) {
  const {
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
  } = deps;

  const applyUpdatedIssue = (updated: Issue) => {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setSelectedIssue(updated);
    setIssueDetailOriginal(updated);
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
      const base64 = await fileToBase64(file);
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
      applyUpdatedIssue(patched);
    } catch (err) {
      setScreenshotError(
        err instanceof Error ? err.message : "Failed to upload screenshot"
      );
    } finally {
      setScreenshotUploading(false);
    }
  };

  const handleSaveScreenshotName = async (screenshotId: string, name: string) => {
    if (!selectedIssue?.id || !screenshotId?.trim()) return;
    const belongsToIssue = selectedIssue.screenshots?.some(
      (s) => s.id === screenshotId
    );
    if (!belongsToIssue) return;
    setEditingScreenshotId(null);
    setScreenshotError(null);
    const value = name.trim() || null;
    try {
      const updated = await updateIssueScreenshot(selectedIssue.id, screenshotId, {
        name: value,
      });
      applyUpdatedIssue(updated);
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
      const updated = await deleteIssueScreenshot(selectedIssue.id, screenshotId);
      applyUpdatedIssue(updated);
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
      applyUpdatedIssue(updated);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

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

  const uploadClassifiedFile = async (file: File): Promise<void> => {
    if (!selectedIssue) return;
    const kind = classifyFile(file);
    const base64 = await fileToBase64(file);
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
        applyUpdatedIssue(patched);
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
        applyUpdatedIssue(updated);
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
        const updated = await uploadIssueFile(selectedIssue.id, base64, file.name);
        applyUpdatedIssue(updated);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : "Failed to upload file");
      } finally {
        setFileUploading(false);
      }
    }
  };

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
    if (e.dataTransfer?.types?.includes("Files")) setDragOverCount((c) => c + 1);
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
      return await fileToBase64(new File([blob], "screenshot.png"));
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
      applyUpdatedIssue(updated);
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

  return {
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
  };
}
