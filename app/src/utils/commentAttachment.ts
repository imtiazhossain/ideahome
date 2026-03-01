import type { CommentAttachment } from "../api/client";
import { getRecordingStreamUrl, getScreenshotStreamUrl } from "../api/client";
import type { PendingCommentAttachment } from "../types";

export function getCommentAttachmentStreamUrl(attachment: CommentAttachment): string {
  if (attachment.type === "screenshot") {
    return getScreenshotStreamUrl(attachment.mediaUrl);
  }
  return getRecordingStreamUrl(attachment.mediaUrl);
}

export function commentAttachmentLabel(attachment: CommentAttachment): string {
  const fileName = attachment.mediaUrl.replace(/^.*\//, "").split("?")[0] ?? "";
  return fileName || attachment.type;
}

export function pendingCommentAttachmentDataUri(attachment: PendingCommentAttachment): string {
  if (attachment.type === "screenshot") return `data:image/jpeg;base64,${attachment.base64}`;
  return `data:video/mp4;base64,${attachment.base64}`;
}
