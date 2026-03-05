import {
  pathCommentAttachmentById,
  pathCommentAttachments,
  pathIssueCommentById,
  pathIssueComments,
  pathIssueFileById,
  pathIssueFiles,
  pathIssueFileStream,
  pathIssueRecordingById,
  pathIssueRecordings,
  pathIssueScreenshotById,
  pathIssueScreenshots,
  pathRecordingStream,
  pathScreenshotStream,
} from "@ideahome/shared";
import type {
  AddCommentAttachmentInput,
  Issue as SharedIssue,
  IssueComment as SharedIssueComment,
} from "@ideahome/shared";
import { getApiBase, requestJson, requestVoid } from "./http";

export type Issue = SharedIssue;
export type IssueComment = SharedIssueComment;

export async function fetchIssueComments(
  issueId: string
): Promise<IssueComment[]> {
  try {
    const r = await fetch(`${getApiBase()}${pathIssueComments(issueId)}`);
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      const trimmed = detail.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      throw new Error(
        `Failed to fetch comments (${r.status}${
          trimmed ? `: ${trimmed.slice(0, 180)}` : ""
        }). Is the backend running on port 3001?`
      );
    }
    return r.json();
  } catch (e) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    if (
      /Failed to fetch|NetworkError|Load failed|TypeError: Failed to fetch/.test(
        message
      )
    ) {
      throw new Error(
        "Failed to fetch comments. Is the backend running? Start it with: pnpm dev:backend"
      );
    }
    throw e;
  }
}

export async function createIssueComment(
  issueId: string,
  body: string
): Promise<IssueComment> {
  const payload: { body: string } = { body };
  return requestJson<IssueComment>(pathIssueComments(issueId), {
    method: "POST",
    body: payload,
    errorMessage: "Failed to add comment",
  });
}

export async function updateIssueComment(
  issueId: string,
  commentId: string,
  body: string
): Promise<IssueComment> {
  const payload: { body: string } = { body };
  return requestJson<IssueComment>(pathIssueCommentById(issueId, commentId), {
    method: "PATCH",
    body: payload,
    errorMessage: "Failed to update comment",
  });
}

export async function deleteIssueComment(
  issueId: string,
  commentId: string
): Promise<void> {
  return requestVoid(pathIssueCommentById(issueId, commentId), {
    method: "DELETE",
    errorMessage: "Failed to delete comment",
  });
}

export async function addCommentAttachment(
  issueId: string,
  commentId: string,
  body: AddCommentAttachmentInput
): Promise<IssueComment> {
  return requestJson<IssueComment>(pathCommentAttachments(issueId, commentId), {
    method: "POST",
    body,
    errorMessage: "Failed to add attachment to comment",
  });
}

export async function deleteCommentAttachment(
  issueId: string,
  commentId: string,
  attachmentId: string
): Promise<IssueComment> {
  return requestJson<IssueComment>(
    pathCommentAttachmentById(issueId, commentId, attachmentId),
    { method: "DELETE", errorMessage: "Failed to remove attachment" }
  );
}

export async function uploadIssueRecording(
  issueId: string,
  videoBase64: string,
  mediaType: "video" | "audio" = "video",
  recordingType: "screen" | "camera" | "audio" = "screen",
  fileName?: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueRecordings(issueId), {
    method: "POST",
    body: { videoBase64, mediaType, recordingType, fileName },
    errorMessage: "Failed to upload recording",
  });
}

export async function updateIssueRecording(
  issueId: string,
  recordingId: string,
  data: {
    mediaType?: "video" | "audio";
    recordingType?: "screen" | "camera" | "audio";
    name?: string | null;
  }
): Promise<Issue> {
  return requestJson<Issue>(pathIssueRecordingById(issueId, recordingId), {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update recording",
  });
}

export async function deleteIssueRecording(
  issueId: string,
  recordingId: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueRecordingById(issueId, recordingId), {
    method: "DELETE",
    errorMessage: "Failed to delete recording",
  });
}

export function getRecordingUrl(videoUrl: string): string {
  const filename = videoUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${getApiBase()}${pathRecordingStream(filename)}`;
}

export async function uploadIssueScreenshot(
  issueId: string,
  imageBase64: string,
  fileName?: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueScreenshots(issueId), {
    method: "POST",
    body: { imageBase64, fileName: fileName ?? undefined },
    errorMessage: "Failed to upload screenshot",
  });
}

export async function updateIssueScreenshot(
  issueId: string,
  screenshotId: string,
  data: { name?: string | null }
): Promise<Issue> {
  return requestJson<Issue>(pathIssueScreenshotById(issueId, screenshotId), {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update screenshot",
  });
}

export async function deleteIssueScreenshot(
  issueId: string,
  screenshotId: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueScreenshotById(issueId, screenshotId), {
    method: "DELETE",
    errorMessage: "Failed to delete screenshot",
  });
}

export function getScreenshotUrl(imageUrl: string): string {
  const filename = imageUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return `${getApiBase()}${pathScreenshotStream(filename)}`;
}

export async function uploadIssueFile(
  issueId: string,
  fileBase64: string,
  fileName: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueFiles(issueId), {
    method: "POST",
    body: { fileBase64, fileName },
    errorMessage: "Failed to upload file",
  });
}

export async function updateIssueFile(
  issueId: string,
  fileId: string,
  data: { fileName?: string }
): Promise<Issue> {
  return requestJson<Issue>(pathIssueFileById(issueId, fileId), {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update file",
  });
}

export async function deleteIssueFile(
  issueId: string,
  fileId: string
): Promise<Issue> {
  return requestJson<Issue>(pathIssueFileById(issueId, fileId), {
    method: "DELETE",
    errorMessage: "Failed to delete file",
  });
}

export function getIssueFileUrl(issueId: string, fileId: string): string {
  return `${getApiBase()}${pathIssueFileStream(issueId, fileId)}`;
}

