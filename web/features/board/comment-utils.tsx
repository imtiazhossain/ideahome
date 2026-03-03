import React from "react";
import type {
  IssueFile,
  IssueRecording,
  IssueScreenshot,
} from "../../lib/api/media";
import { IconScreenshot, IconUpload, IconVideo } from "../../components/icons";
import { getRecordingDisplayLabel, getRecordingKind } from "../../lib/utils";
import { IconLabelButton } from "./IconLabelButton";

/** Splits comment body into text and file-name segments for rendering (file names as buttons). */
export function commentBodyWithFileButtons(
  body: string,
  attachments: { mediaUrl: string; type: string }[] | undefined,
  getRecordingUrlFn: (url: string) => string,
  getScreenshotUrlFn: (url: string) => string,
  options?: {
    recordings?: IssueRecording[];
    screenshots?: IssueScreenshot[];
    files?: IssueFile[];
    onScrollToRecording?: (recordingId: string) => void;
    onScrollToScreenshot?: (screenshotId: string) => void;
    onScrollToFile?: (fileId: string) => void;
  }
): React.ReactNode[] {
  const segments: Array<
    { type: "text"; value: string } | { type: "file"; value: string }
  > = [];
  const filePattern = /(comment-[a-z0-9]+-\d+\.webm|\[[^\]]+\])/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(filePattern.source, "gi");
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, m.index) });
    }
    segments.push({ type: "file", value: m[1] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  const nodes: React.ReactNode[] = [];
  const recordings = options?.recordings ?? [];
  const screenshots = options?.screenshots ?? [];
  const files = options?.files ?? [];
  const onScrollToRecording = options?.onScrollToRecording;
  const onScrollToScreenshot = options?.onScrollToScreenshot;
  const onScrollToFile = options?.onScrollToFile;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type === "text") {
      nodes.push(seg.value);
      continue;
    }
    const raw = seg.value;
    const isBracket = raw.startsWith("[") && raw.endsWith("]");
    const label = isBracket ? raw.slice(1, -1) : raw;
    let href: string | undefined;
    let recordingId: string | undefined;
    let screenshotId: string | undefined;
    let fileId: string | undefined;
    if (!isBracket && /^comment-[a-z0-9]+-\d+\.webm$/i.test(raw)) {
      href = getRecordingUrlFn(raw);
    } else if (attachments?.length) {
      const filename = label.replace(/^.*[/\\]/, "");
      const att = attachments.find((a) => {
        const attName = a.mediaUrl.replace(/^.*\//, "");
        return (
          attName === filename ||
          attName === label ||
          a.mediaUrl.endsWith(label)
        );
      });
      if (att) {
        href =
          att.type === "screenshot"
            ? getScreenshotUrlFn(att.mediaUrl)
            : getRecordingUrlFn(att.mediaUrl);
      }
    }
    if (!href && isBracket && /^comment-[a-z0-9]+-\d+\.webm$/i.test(label)) {
      href = getRecordingUrlFn(label);
    }
    if (!href && recordings.length > 0 && onScrollToRecording) {
      const rec = recordings.find((r) => {
        const kind = getRecordingKind(r);
        const rIdx = recordings.indexOf(r) + 1;
        const defaultLabel = getRecordingDisplayLabel(kind, rIdx);
        return (
          (r.name ?? defaultLabel) === label ||
          r.name === label ||
          defaultLabel === label
        );
      });
      if (rec) recordingId = rec.id;
    }
    if (
      !href &&
      !recordingId &&
      screenshots.length > 0 &&
      onScrollToScreenshot
    ) {
      const screenshotIdPrefix = "screenshot:";
      if (label.startsWith(screenshotIdPrefix)) {
        const id = label.slice(screenshotIdPrefix.length);
        const byId = screenshots.find((s) => s.id === id);
        if (byId) screenshotId = byId.id;
      }
      if (!screenshotId) {
        const screenshotMatch = /^Screenshot (\d+)$/.exec(label);
        if (screenshotMatch) {
          const idx = parseInt(screenshotMatch[1], 10);
          if (idx >= 1 && idx <= screenshots.length)
            screenshotId = screenshots[idx - 1].id;
        }
      }
      if (!screenshotId) {
        const byName = screenshots.find((s) => (s.name ?? "").trim() === label);
        if (byName) screenshotId = byName.id;
      }
      if (!screenshotId) {
        const unnamed = screenshots.filter((s) => !(s.name ?? "").trim());
        const looksLikeImageFilename = /\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(
          label.trim()
        );
        if (unnamed.length === 1 && looksLikeImageFilename)
          screenshotId = unnamed[0].id;
      }
    }
    if (
      !href &&
      !recordingId &&
      !screenshotId &&
      files.length > 0 &&
      onScrollToFile
    ) {
      const f = files.find((x) => x.fileName === label);
      if (f) fileId = f.id;
    }
    const buttonStyle = {
      display: "inline-flex" as const,
      alignItems: "center",
      gap: 4,
      padding: "4px 8px",
      borderRadius: 6,
      textDecoration: "none",
      fontSize: 12,
      marginRight: 4,
      marginBottom: 4,
    };
    if (recordingId && onScrollToRecording) {
      const rec = recordings.find((r) => r.id === recordingId);
      const recIdx = rec ? recordings.indexOf(rec) + 1 : 0;
      const kind = rec ? getRecordingKind(rec) : "screen";
      const defaultLabel = getRecordingDisplayLabel(kind, recIdx);
      const displayLabel = rec ? (rec.name ?? defaultLabel) : label;
      nodes.push(
        <IconLabelButton
          key={`file-${i}-${raw}`}
          size="sm"
          style={buttonStyle}
          onClick={() => onScrollToRecording(recordingId!)}
          aria-label={`Go to recording: ${displayLabel}`}
          title={`Go to recording: ${displayLabel}`}
          icon={<IconVideo size={12} />}
        >
          {displayLabel}
        </IconLabelButton>
      );
    } else if (screenshotId && onScrollToScreenshot) {
      const shot = screenshots.find((s) => s.id === screenshotId);
      const displayLabel = shot ? (shot.name ?? label) : label;
      nodes.push(
        <IconLabelButton
          key={`file-${i}-${raw}`}
          size="sm"
          style={buttonStyle}
          onClick={() => onScrollToScreenshot(screenshotId!)}
          aria-label={`Go to ${displayLabel}`}
          title={`Go to ${displayLabel}`}
          icon={<IconScreenshot size={12} />}
        >
          {displayLabel}
        </IconLabelButton>
      );
    } else if (fileId && onScrollToFile) {
      nodes.push(
        <IconLabelButton
          key={`file-${i}-${raw}`}
          size="sm"
          style={buttonStyle}
          onClick={() => onScrollToFile(fileId!)}
          aria-label={`Go to file: ${label}`}
          title={`Go to file: ${label}`}
          icon={<IconUpload size={12} />}
        >
          {label}
        </IconLabelButton>
      );
    } else {
      nodes.push(
        <a
          key={`file-${i}-${raw}`}
          href={href ?? "#"}
          target={href ? "_blank" : undefined}
          rel={href ? "noopener noreferrer" : undefined}
          className="btn btn-secondary"
          style={buttonStyle}
        >
          <IconVideo size={12} />
          {label}
        </a>
      );
    }
  }
  return nodes;
}
