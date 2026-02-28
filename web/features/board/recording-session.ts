import type React from "react";

type RecordingMode = "screen" | "camera" | "audio";
type RecordingDestination =
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
  | null;

type StartOptions = {
  forCommentPending?: boolean;
  forCommentId?: string;
};

export function createRecordingSessionHandlers(deps: {
  setRecordingError: (value: string | null) => void;
  recordingDestinationRef: React.MutableRefObject<RecordingDestination>;
  setRecordingFor: (value: null | "issue" | "comment-pending" | string) => void;
  recordingModeRef: React.MutableRefObject<RecordingMode | null>;
  recordingUploadForCommentDraftRef: React.MutableRefObject<boolean>;
  mediaStreamRef: React.MutableRefObject<MediaStream | null>;
  mediaRecorderRef: React.MutableRefObject<MediaRecorder | null>;
  recordedChunksRef: React.MutableRefObject<Blob[]>;
  setRecordingMode: (value: RecordingMode | null) => void;
  setIsRecording: (value: boolean) => void;
  onRecorderStopUpload: (mimeType: string) => Promise<void>;
}) {
  const {
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
    onRecorderStopUpload,
  } = deps;

  const setupRecorder = (
    stream: MediaStream,
    audioOnly = false
  ): MediaRecorder => {
    recordedChunksRef.current = [];

    const preferredTypes = audioOnly
      ? ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
      : [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ];
    const mimeType =
      preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ||
      (audioOnly ? "audio/webm" : "");
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setIsRecording(false);
      setRecordingMode(null);
      await onRecorderStopUpload(recorder.mimeType);
    };

    return recorder;
  };

  const startRecording = async (opts?: StartOptions) => {
    setRecordingError(null);
    if (!opts) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingModeRef.current = "screen";
    } else if (opts.forCommentPending) {
      recordingDestinationRef.current = {
        dest: "comment-pending",
        recordingType: "screen_recording",
      };
      setRecordingFor("comment-pending");
    } else if (opts.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "screen_recording",
      };
      setRecordingFor(opts.forCommentId);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        // @ts-ignore – Chrome-specific: prefer current tab so the browser doesn't switch focus away
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      )
        return;
      setRecordingError(
        `Could not start screen capture: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream);

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };

      recorder.start(1000);
      setRecordingMode("screen");
      setIsRecording(true);
      window.focus();
      setTimeout(() => window.focus(), 300);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const startCameraRecording = async (opts?: StartOptions) => {
    setRecordingError(null);
    if (!opts) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingModeRef.current = "camera";
    } else if (opts.forCommentPending) {
      recordingDestinationRef.current = {
        dest: "comment-pending",
        recordingType: "camera_recording",
      };
      setRecordingFor("comment-pending");
    } else if (opts.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "camera_recording",
      };
      setRecordingFor(opts.forCommentId);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "AbortError")
        )
          return;
        setRecordingError(
          `Could not start camera: ${err instanceof Error ? err.message : String(err)}`
        );
        return;
      }
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream);

      recorder.start(1000);
      setRecordingMode("camera");
      setIsRecording(true);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Camera recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const startAudioRecording = async (opts?: StartOptions) => {
    setRecordingError(null);
    recordingModeRef.current = "audio";
    if (opts?.forCommentId) {
      recordingDestinationRef.current = {
        dest: opts.forCommentId,
        recordingType: "audio_recording",
      };
      setRecordingFor(opts.forCommentId);
      recordingUploadForCommentDraftRef.current = false;
    } else if (opts?.forCommentPending) {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingUploadForCommentDraftRef.current = true;
    } else {
      recordingDestinationRef.current = "issue";
      setRecordingFor("issue");
      recordingUploadForCommentDraftRef.current = false;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
      )
        return;
      setRecordingError(
        `Could not start microphone: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    try {
      mediaStreamRef.current = stream;
      const recorder = setupRecorder(stream, true);

      recorder.start(1000);
      setRecordingMode("audio");
      setIsRecording(true);
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      setRecordingError(
        `Audio recording failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setRecordingFor(null);
  };

  return {
    setupRecorder,
    startRecording,
    startCameraRecording,
    startAudioRecording,
    stopRecording,
  };
}
