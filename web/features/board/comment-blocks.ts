import type { Issue } from "../../lib/api/issues";
import type { CommentAttachmentType } from "../../lib/api/issues";
import { getRecordingDisplayLabel, getRecordingKind } from "../../lib/utils";

export type CommentBlockText = { kind: "text"; value: string };
export type CommentBlockAttachment = {
  kind: "attachment";
  attType: CommentAttachmentType;
  imageBase64?: string;
  videoBase64?: string;
  name?: string;
};
export type CommentBlockRecording = { kind: "recording"; recordingId: string };
export type CommentBlockScreenshot = {
  kind: "screenshot";
  screenshotId: string;
  name?: string;
};
export type CommentBlockFile = { kind: "file"; fileId: string };
export type CommentBlock =
  | CommentBlockText
  | CommentBlockAttachment
  | CommentBlockRecording
  | CommentBlockScreenshot
  | CommentBlockFile;

/** Parse stored comment body into blocks so refs (screenshot/recording/file) can be shown as non-editable. */
export function parseCommentBodyToBlocks(
  body: string,
  issue: Issue | null
): CommentBlock[] {
  if (!body.trim() && !issue) return [{ kind: "text", value: "" }];
  if (!issue?.recordings && !issue?.screenshots && !issue?.files)
    return [{ kind: "text", value: body }];
  const filePattern = /(comment-[a-z0-9]+-\d+\.webm|\[[^\]]+\])/gi;
  let lastIndex = 0;
  const blocks: CommentBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = filePattern.exec(body)) !== null) {
    if (m.index > lastIndex) {
      blocks.push({ kind: "text", value: body.slice(lastIndex, m.index) });
    }
    const raw = m[1];
    const isBracket = raw.startsWith("[") && raw.endsWith("]");
    const label = isBracket ? raw.slice(1, -1) : raw;
    if (isBracket && label.startsWith("screenshot:")) {
      const id = label.slice("screenshot:".length);
      if (issue?.screenshots?.some((s) => s.id === id))
        blocks.push({ kind: "screenshot", screenshotId: id });
      else blocks.push({ kind: "text", value: raw });
    } else if (issue?.recordings) {
      const rec = issue.recordings.find((r) => {
        const kind = getRecordingKind(r);
        const rIdx = issue.recordings!.indexOf(r) + 1;
        const defaultLabel = getRecordingDisplayLabel(kind, rIdx);
        return (r.name ?? defaultLabel) === label || defaultLabel === label;
      });
      if (rec) blocks.push({ kind: "recording", recordingId: rec.id });
      else if (issue?.files) {
        const f = issue.files.find((x) => x.fileName === label);
        if (f) blocks.push({ kind: "file", fileId: f.id });
        else blocks.push({ kind: "text", value: raw });
      } else blocks.push({ kind: "text", value: raw });
    } else if (issue?.files) {
      const f = issue.files.find((x) => x.fileName === label);
      if (f) blocks.push({ kind: "file", fileId: f.id });
      else blocks.push({ kind: "text", value: raw });
    } else {
      blocks.push({ kind: "text", value: raw });
    }
    lastIndex = filePattern.lastIndex;
  }
  if (lastIndex < body.length) blocks.push({ kind: "text", value: body.slice(lastIndex) });
  if (blocks.length === 0) blocks.push({ kind: "text", value: "" });
  if (blocks[0]?.kind !== "text") blocks.unshift({ kind: "text", value: "" });
  if (blocks[blocks.length - 1]?.kind !== "text")
    blocks.push({ kind: "text", value: "" });
  return blocks;
}

export function serializeEditingBlocksToBody(
  blocks: CommentBlock[],
  selectedIssue: Issue | null
): string {
  const textParts: string[] = [];
  for (const block of blocks) {
    if (block.kind === "text" && block.value.trim()) textParts.push(block.value.trim());
    else if (block.kind === "recording" && selectedIssue?.recordings) {
      const rec = selectedIssue.recordings.find((r) => r.id === block.recordingId);
      if (rec) {
        const kind = getRecordingKind(rec);
        const rIdx = selectedIssue.recordings.indexOf(rec) + 1;
        const defaultLabel = getRecordingDisplayLabel(kind, rIdx);
        textParts.push(`[${rec.name ?? defaultLabel}]`);
      }
    } else if (block.kind === "screenshot" && selectedIssue?.screenshots) {
      const shot = selectedIssue.screenshots.find((s) => s.id === block.screenshotId);
      if (shot) textParts.push(`[screenshot:${block.screenshotId}]`);
    } else if (block.kind === "file" && selectedIssue?.files) {
      const f = selectedIssue.files.find((x) => x.id === block.fileId);
      if (f) textParts.push(`[${f.fileName}]`);
    }
  }
  return textParts.join("\n");
}

export function removeEditingCommentBlockFromState(
  prev: CommentBlock[] | null,
  blockIdx: number
): CommentBlock[] | null {
  if (!prev || blockIdx < 0 || blockIdx >= prev.length) return prev;
  const next = prev.filter((_, i) => i !== blockIdx);
  if (next.length === 0) return [{ kind: "text", value: "" }];
  if (
    blockIdx > 0 &&
    blockIdx < next.length &&
    next[blockIdx - 1]?.kind === "text" &&
    next[blockIdx]?.kind === "text"
  ) {
    const before = next[blockIdx - 1];
    const after = next[blockIdx];
    if (before.kind === "text" && after.kind === "text") {
      return [
        ...next.slice(0, blockIdx - 1),
        { kind: "text", value: before.value + after.value },
        ...next.slice(blockIdx + 1),
      ];
    }
  }
  return next;
}

export function insertEditingCommentBlockToState(
  prev: CommentBlock[] | null,
  block: CommentBlock
): CommentBlock[] {
  const list = prev ?? [{ kind: "text", value: "" }];
  const idx = list.length - 1;
  const before = list.slice(0, idx + 1);
  const after = list.slice(idx + 1);
  return [...before, block, { kind: "text", value: "" }, ...after];
}

export function insertCommentBlockInDraft(
  prev: CommentBlock[],
  block: CommentBlock
): CommentBlock[] {
  if (prev[0]?.kind === "text") {
    return [prev[0], block, ...prev.slice(1)];
  }
  return [block, ...prev];
}

export function removeCommentBlockFromDraft(
  prev: CommentBlock[],
  blockIdx: number
): CommentBlock[] {
  const next = prev.filter((_, i) => i !== blockIdx);
  if (next.length === 0 || next.every((b) => b.kind !== "text")) {
    next.push({ kind: "text", value: "" });
  }
  const textBefore = blockIdx > 0 && next[blockIdx - 1]?.kind === "text";
  const textAfter = next[blockIdx]?.kind === "text";
  if (textBefore && textAfter) {
    const before = next[blockIdx - 1];
    const after = next[blockIdx];
    if (before.kind === "text" && after.kind === "text") {
      return [
        ...next.slice(0, blockIdx - 1),
        { kind: "text", value: before.value + "\n" + after.value },
        ...next.slice(blockIdx + 1),
      ];
    }
  }
  return next;
}
