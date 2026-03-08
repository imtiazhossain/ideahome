import React from "react";
import { buildShareablePromptCoachTemplate } from "@ideahome/shared";
import type {
  PromptEfficiencyBreakdown,
  PromptUsageDetailEntry,
  PromptUsageSource,
  PromptUsageTrendPoint,
} from "@ideahome/shared";

export type SourceFilter = "all" | PromptUsageSource;
export type ViewMode = "project" | "mine";
export type OptimizerAttachment = {
  id: string;
  file: File;
  kind: "image" | "video";
  previewUrl: string;
};
export type ChartPoint = PromptUsageTrendPoint & {
  id?: string;
  source?: PromptUsageSource;
  entry?: PromptUsageDetailEntry | null;
};

export const MIN_CHART_HEIGHT = 220;
export const MAX_CHART_HEIGHT = 760;
export const DEFAULT_CHART_HEIGHT = 260;
export const MAX_VISIBLE_POINTS = 10;
export const SHAREABLE_TEMPLATE = buildShareablePromptCoachTemplate();

export const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "All sources",
  "bulby-openrouter": "Bulby / OpenRouter",
  "gpt-openai": "GPT / OpenAI",
  "codex-estimated": "Codex (estimated)",
};

export const SERIES = [
  {
    key: "totalTokens",
    label: "Total",
    stroke: "#de7b5d",
    xOffset: -3,
    strokeWidth: 2.9,
    strokeDasharray: undefined,
    dotRadius: 3.6,
  },
  {
    key: "promptTokens",
    label: "Prompt",
    stroke: "#6c93e6",
    xOffset: 0,
    strokeWidth: 2.2,
    strokeDasharray: undefined,
    dotRadius: 2.8,
  },
  {
    key: "completionTokens",
    label: "Completion",
    stroke: "#35c9a0",
    xOffset: 3,
    strokeWidth: 2.2,
    strokeDasharray: undefined,
    dotRadius: 2.8,
  },
] as const;

const OPTIMIZER_FILLER_REGEX =
  /\b(please|could you|would you|can you|i want you to|just|really|kind of|sort of)\b/i;
const OPTIMIZER_REDUNDANCY_REGEX = /\b(\w+)(?:\s+\1\b)+/gi;
const OPTIMIZER_SECTION_LABEL_REGEX =
  /^(?:task|context|background|constraints|output|return|success criteria)\s*:\s*/i;

export const OPTIMIZER_METRIC_TIPS = {
  brevity:
    "How efficiently the optimizer cuts extra words while keeping the request intact. Higher scores mean the prompt says the same thing with less overhead.",
  outputEfficiency:
    "How well the prompt is shaped to get useful output without wasting completion tokens. Higher scores usually mean clearer constraints and less cleanup in the response.",
  redundancyPenalty:
    "How much repeated wording or duplicated instructions the optimizer removed. Higher scores mean fewer repeated asks that can confuse or bloat the model response.",
  instructionDensity:
    "How much actionable guidance is packed into the prompt. Higher scores mean more signal per line, with concrete requirements instead of filler.",
} as const;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function stripOptimizerSectionLabel(text: string): string {
  return text.replace(OPTIMIZER_SECTION_LABEL_REGEX, "").trim();
}

export function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function formatAxisDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function formatAxisTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function classifyOptimizerAttachment(
  file: File
): "image" | "video" | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (
    type.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|ico|heic|heif)$/i.test(name)
  ) {
    return "image";
  }
  if (
    type.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|ogv|avi|mkv)$/i.test(name)
  ) {
    return "video";
  }
  return null;
}

function resolveClipboardMimeType(file: File): string | null {
  const type = file.type.trim().toLowerCase();
  if (type.startsWith("image/") || type.startsWith("video/")) return type;
  const name = file.name.toLowerCase();
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.(jpg|jpeg)$/i.test(name)) return "image/jpeg";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.mp4$/i.test(name)) return "video/mp4";
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.ogv$/i.test(name)) return "video/ogg";
  return null;
}

export async function copyOptimizerPayload(
  text: string,
  attachments: OptimizerAttachment[]
): Promise<"media" | "text"> {
  if (!navigator.clipboard) {
    throw new Error("Clipboard is not available in this browser.");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Nothing to copy yet.");
  }
  if (
    attachments.length > 0 &&
    navigator.clipboard.write &&
    typeof ClipboardItem !== "undefined"
  ) {
    const items: ClipboardItem[] = [
      new ClipboardItem({
        "text/plain": new Blob([trimmed], { type: "text/plain" }),
      }),
    ];
    for (const attachment of attachments) {
      const mimeType = resolveClipboardMimeType(attachment.file);
      if (!mimeType) continue;
      items.push(
        new ClipboardItem({
          [mimeType]: attachment.file,
        })
      );
    }
    if (items.length > 1) {
      await navigator.clipboard.write(items);
      return "media";
    }
  }
  if (!navigator.clipboard.writeText) {
    throw new Error("Text clipboard copy is not available in this browser.");
  }
  await navigator.clipboard.writeText(trimmed);
  return "text";
}

export function MetricLabelWithTip({
  label,
  tip,
}: {
  label: string;
  tip: string;
}) {
  return (
    <span className="prompt-usage-metric-label">
      <span>{label}</span>
      <span
        className="prompt-usage-metric-tip"
        tabIndex={0}
        aria-label={`${label} info`}
      >
        i
        <span
          className="prompt-usage-metric-tip-content"
          role="tooltip"
          aria-hidden="true"
        >
          <strong>{label}</strong>
          <span>{tip}</span>
        </span>
      </span>
    </span>
  );
}

export function buildTrendPolyline(
  points: PromptUsageTrendPoint[],
  key: (typeof SERIES)[number]["key"],
  width: number,
  height: number,
  padding: number,
  maxValue: number,
  xOffset = 0
): string {
  if (points.length === 0) return "";
  const stepX =
    points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const chartHeight = height - padding * 2;
  const toY = (value: number) =>
    height - padding - (Math.max(0, value) / maxValue) * chartHeight;
  const windowSize = Math.min(
    7,
    Math.max(3, Math.floor(points.length / 18) || 3)
  );
  const radius = Math.floor(windowSize / 2);

  return points
    .map((_, index) => {
      let total = 0;
      let count = 0;
      for (
        let cursor = Math.max(0, index - radius);
        cursor <= Math.min(points.length - 1, index + radius);
        cursor += 1
      ) {
        total += Number(points[cursor]?.[key] ?? 0);
        count += 1;
      }
      const smoothedValue = count > 0 ? total / count : 0;
      return `${padding + index * stepX + xOffset},${toY(smoothedValue)}`;
    })
    .join(" ");
}

export function summaryLabel(points: PromptUsageTrendPoint[]): string {
  if (points.length === 0) return "No prompt usage yet";
  const totalTokens = points.reduce((sum, point) => sum + point.totalTokens, 0);
  const totalPrompts = points.reduce(
    (sum, point) => sum + point.promptCount,
    0
  );
  return `${totalPrompts} prompts · ${totalTokens.toLocaleString()} total tokens`;
}

export function efficiencyTone(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Fair";
  return "Needs trimming";
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function isStructuredOptimizerPrompt(promptText: string): boolean {
  return (
    /^task\s*:/im.test(promptText) &&
    /^constraints\s*:/im.test(promptText) &&
    /^(output|return)\s*:/im.test(promptText)
  );
}

function buildOptimizerPromptBreakdown(
  promptText: string
): PromptEfficiencyBreakdown {
  const trimmed = promptText.trim();
  const promptTokens = Math.max(0, Math.ceil(trimmed.length / 4));
  const structured = isStructuredOptimizerPrompt(trimmed);
  const effectivePromptTokens = structured
    ? Math.max(0, promptTokens - 40)
    : promptTokens;
  const promptWordCount = countWords(trimmed);
  const fillerMatches = countMatches(
    trimmed,
    new RegExp(OPTIMIZER_FILLER_REGEX.source, "gi")
  );
  const redundancyMatches = countMatches(trimmed, OPTIMIZER_REDUNDANCY_REGEX);
  const punctuationMatches = countMatches(trimmed, /[:,\-\n]/g);
  const brevity = clamp(
    Math.round(
      35 -
        Math.max(0, effectivePromptTokens - (structured ? 85 : 40)) *
          (structured ? 0.035 : 0.08)
    ),
    0,
    35
  );
  let outputEfficiency = 0;
  if (trimmed) outputEfficiency += 6;
  if (/\b(return|output|format|respond|reply)\b/i.test(trimmed)) {
    outputEfficiency += 8;
  }
  if (
    /\b(json|yaml|csv|table|markdown|bullet|bullets|list|sentence|paragraph)\b/i.test(
      trimmed
    )
  ) {
    outputEfficiency += 8;
  }
  if (
    /\b(only|exactly|at most|under|no more than|limit|maximum|max)\b/i.test(
      trimmed
    )
  ) {
    outputEfficiency += 4;
  }
  if (/\b\d+\b/.test(trimmed)) {
    outputEfficiency += 2;
  }
  if (/^(output|return)\s*:/im.test(trimmed)) {
    outputEfficiency += 2;
  }
  outputEfficiency = clamp(outputEfficiency, 0, 30);
  const redundancyPenalty = clamp(
    20 - fillerMatches * 5 - redundancyMatches * 4,
    0,
    20
  );
  const denseInstructionSignals =
    punctuationMatches +
    (/\b(with|without|only|return|output|format|include|exclude|keep|limit|preserve)\b/i.test(
      trimmed
    )
      ? 2
      : 0) +
    (/^constraints\s*:/im.test(trimmed) ? 2 : 0) +
    (/^(output|return)\s*:/im.test(trimmed) ? 2 : 0);
  const instructionDensity = clamp(
    Math.round(
      promptWordCount === 0
        ? 0
        : 15 *
            Math.min(
              1,
              denseInstructionSignals / Math.max(3, promptWordCount / 8)
            )
    ),
    0,
    15
  );
  return {
    brevity,
    outputEfficiency,
    redundancyPenalty,
    instructionDensity,
  };
}

export function analyzeOptimizerPrompt(promptText: string): {
  score: number;
  breakdown: PromptEfficiencyBreakdown;
  gapHints: Array<{ title: string; example: string }>;
  humanGapHints: Array<{ title: string; example: string }>;
} {
  const breakdown = buildOptimizerPromptBreakdown(promptText);
  const gapHints = buildScoreGapHints(promptText, breakdown);
  return {
    score:
      breakdown.brevity +
      breakdown.outputEfficiency +
      breakdown.redundancyPenalty +
      breakdown.instructionDensity,
    breakdown,
    gapHints,
    humanGapHints: buildHumanRequiredGapHints(promptText, gapHints),
  };
}

function truncateForExample(text: string, maxLength = 120): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildRelevantPromptEdits(promptText: string): string[] {
  const normalized = promptText.replace(/\s+/g, " ").trim();
  const edits: string[] = [];

  if (
    /\b(chart|graph)\b.*\b(stretched|distorted|misaligned)\b/i.test(normalized)
  ) {
    edits.push("Fix the stretched chart layout.");
  }
  if (
    /\bx-axis\b.*\b(does not align|misalign|not align|align)\b/i.test(
      normalized
    ) ||
    /\bdata points?\b/i.test(normalized)
  ) {
    edits.push("Align the x-axis labels with the data points.");
  }
  if (
    /\btime\b.*\bbelow\b.*\bdate\b/i.test(normalized) ||
    /\bdate\b.*\btime\b/i.test(normalized)
  ) {
    edits.push("Show a compact time label below each date on the x-axis.");
  }
  if (
    /\b10\b.*\b(points?|data points?)\b/i.test(normalized) ||
    /\blimit\b.*\b10\b/i.test(normalized)
  ) {
    edits.push("Show 10 data points at a time.");
  }
  if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
    edits.push("Enable horizontal scrolling for the chart.");
  }

  if (edits.length === 0) {
    const firstSentence =
      normalized
        .split(/[.!?]/)
        .find((part) => part.trim().length > 0)
        ?.trim() ?? "";
    if (firstSentence) {
      edits.push(rewritePromptTextAsTaskAction(firstSentence));
    }
  }

  return Array.from(new Set(edits)).slice(0, 4);
}

function buildRelevantPromptConstraints(promptText: string): string[] {
  const normalized = promptText.replace(/\s+/g, " ").trim();
  const constraints: string[] = [];
  if (
    /\blimit\b.*\b10\b.*\bdata points?\b/i.test(normalized) ||
    /\b10\b.*\bdata points?\b/i.test(normalized)
  ) {
    constraints.push("Limit visible data points to 10.");
  }
  if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
    constraints.push("Enable horizontal scrolling for overflow.");
  }
  if (
    /\bcompact\b.*\btime\b/i.test(normalized) ||
    /\bsimplest format\b/i.test(normalized)
  ) {
    constraints.push("Keep the time label compact.");
  }
  return Array.from(new Set(constraints)).slice(0, 3);
}

function buildRelevantPromptSuccessCriteria(
  promptText: string,
  edits: string[]
): string[] {
  const normalized = promptText.replace(/\s+/g, " ").trim();
  const criteria: string[] = [];
  if (
    /\bx[- ]axis\b.*\b(does not align|doesn't align|misalign|not align)\b/i.test(
      normalized
    ) ||
    /\balign\b.*\bx[- ]axis\b.*\bdata points?\b/i.test(normalized)
  ) {
    criteria.push("X-axis labels align with their data points.");
  }
  if (
    /\b(unique|compact)\s+time\b/i.test(normalized) ||
    /\btime\b.*\bbelow\b.*\bdate\b/i.test(normalized)
  ) {
    criteria.push("Each date shows a compact time label below it.");
  }
  if (
    /\blimit\b.*\b10\b.*\bdata points?\b/i.test(normalized) ||
    /\b10\b.*\bdata points?\b/i.test(normalized)
  ) {
    criteria.push("The chart shows 10 data points at a time.");
  }
  if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
    criteria.push("Overflow is handled with horizontal scrolling.");
  }
  if (criteria.length === 0) {
    const inferredOutcomes = extractPromptOutcomeCandidates(promptText);
    if (inferredOutcomes.length > 0) {
      return inferredOutcomes;
    }
    return edits
      .map(stripOptimizerSectionLabel)
      .map(rewriteEditAsSuccessCriterion)
      .slice(0, 3);
  }
  return Array.from(new Set(criteria)).slice(0, 4);
}

function extractPromptOutcomeCandidates(text: string): string[] {
  return Array.from(
    new Set(
      text
        .replace(/\r\n/g, "\n")
        .split(/\n|[.;]/)
        .map((chunk) =>
          chunk
            .replace(/^(?:[-*]\s*)+/, "")
            .replace(
              /^(?:task|context|background|constraints|output|return|success criteria)\s*:/i,
              ""
            )
            .trim()
        )
        .filter(Boolean)
        .map((chunk) => rewriteTextAsSuccessOutcome(chunk))
        .filter((chunk): chunk is string => Boolean(chunk))
        .map((chunk) => `${capitalizeSentence(chunk)}.`)
    )
  ).slice(0, 4);
}

function rewriteEditAsSuccessCriterion(text: string): string {
  const normalized = text
    .trim()
    .replace(/^[*-]\s*/, "")
    .replace(/[.!?]+$/g, "");
  if (!normalized) {
    return text;
  }
  const rewritten = rewriteTextAsSuccessOutcome(normalized);
  return `${capitalizeSentence(rewritten ?? normalized)}.`;
}

function rewriteTextAsSuccessOutcome(text: string): string | null {
  const normalized = text
    .trim()
    .replace(/^[*-]\s*/, "")
    .replace(/[.!?]+$/g, "");
  if (!normalized) {
    return null;
  }
  return (
    rewriteIssueAsSuccessOutcome(normalized) ??
    rewriteGenericTaskAsSuccessOutcome(normalized)
  );
}

function rewritePromptTextAsTaskAction(text: string): string {
  const normalized = stripOptimizerSectionLabel(text)
    .trim()
    .replace(/^[*-]\s*/, "")
    .replace(/[.!?]+$/g, "");
  if (!normalized) {
    return text;
  }
  const rewritten = rewriteIssueAsTaskAction(normalized);
  return `${capitalizeSentence(rewritten ?? normalized)}.`;
}

function rewriteIssueAsTaskAction(text: string): string | null {
  const forcedBehaviorTask = rewriteForcedBehaviorAsTaskAction(text);
  if (forcedBehaviorTask) {
    return forcedBehaviorTask;
  }

  const nonWorkingMatch = text.match(
    /^(.+?)\s+(?:is|isn't|is not|isnt|aren't|are not|doesn't|does not|don't|do not|can't|cannot|won't|will not)\s+working$/i
  );
  if (nonWorkingMatch?.[1]) {
    return `Fix ${nonWorkingMatch[1].trim()}`;
  }

  const glitchMatch = text.match(
    /^(.+?)\s+(?:tends to\s+)?glitch(?:es|ing)?(?:\s+when\s+(.+))?$/i
  );
  if (glitchMatch?.[1]) {
    const subject = glitchMatch[1].trim();
    const condition = glitchMatch[2]?.trim();
    return condition
      ? `Fix ${subject} glitching when ${condition}`
      : `Fix ${subject} glitching`;
  }

  const brokenMatch = text.match(/^(.+?)\s+is\s+broken$/i);
  if (brokenMatch?.[1]) {
    return `Fix ${brokenMatch[1].trim()}`;
  }

  const failsMatch = text.match(/^(.+?)\s+fails\s+to\s+(.+)$/i);
  if (failsMatch?.[1] && failsMatch?.[2]) {
    return `Ensure ${failsMatch[1].trim()} can ${failsMatch[2].trim()}`;
  }

  return null;
}

function rewriteIssueAsSuccessOutcome(text: string): string | null {
  const forcedBehaviorOutcome = rewriteForcedBehaviorAsSuccessOutcome(text);
  if (forcedBehaviorOutcome) {
    return forcedBehaviorOutcome;
  }

  const nonWorkingMatch = text.match(
    /^(.+?)\s+(?:is|isn't|is not|isnt|aren't|are not|doesn't|does not|don't|do not|can't|cannot|won't|will not)\s+working$/i
  );
  if (nonWorkingMatch?.[1]) {
    return `${nonWorkingMatch[1].trim()} is working`;
  }

  const glitchMatch = text.match(
    /^(.+?)\s+(?:tends to\s+)?glitch(?:es|ing)?(?:\s+when\s+(.+))?$/i
  );
  if (glitchMatch?.[1]) {
    const subject = glitchMatch[1].trim();
    const condition = glitchMatch[2]?.trim();
    return condition
      ? `${subject} does not glitch when ${condition}`
      : `${subject} does not glitch`;
  }

  const brokenMatch = text.match(/^(.+?)\s+is\s+broken$/i);
  if (brokenMatch?.[1]) {
    return `${brokenMatch[1].trim()} is working`;
  }

  const failsMatch = text.match(/^(.+?)\s+fails\s+to\s+(.+)$/i);
  if (failsMatch?.[1] && failsMatch?.[2]) {
    return `${failsMatch[1].trim()} can ${failsMatch[2].trim()}`;
  }

  return null;
}

function rewriteGenericTaskAsSuccessOutcome(text: string): string | null {
  const normalized = text.trim().replace(/[.!?]+$/g, "");
  if (!normalized) return null;

  const updateToMatch = normalized.match(/^update\s+(.+?)\s+to\s+(.+)$/i);
  if (updateToMatch?.[1] && updateToMatch?.[2]) {
    return `${updateToMatch[1].trim()} is updated to ${updateToMatch[2].trim()}`;
  }

  const updateMatch = normalized.match(/^update\s+(.+)$/i);
  if (updateMatch?.[1]) {
    return `${updateMatch[1].trim()} is updated as requested`;
  }

  const addMatch = normalized.match(/^add\s+(.+)$/i);
  if (addMatch?.[1]) {
    return `${addMatch[1].trim()} is added`;
  }

  const removeMatch = normalized.match(/^remove\s+(.+)$/i);
  if (removeMatch?.[1]) {
    return `${removeMatch[1].trim()} is removed`;
  }

  const fixMatch = normalized.match(/^fix\s+(.+)$/i);
  if (fixMatch?.[1]) {
    return `${fixMatch[1].trim()} works as expected`;
  }

  const ensureMatch = normalized.match(/^ensure\s+(.+?)\s+can\s+(.+)$/i);
  if (ensureMatch?.[1] && ensureMatch?.[2]) {
    return `${ensureMatch[1].trim()} can ${ensureMatch[2].trim()}`;
  }

  const preventMatch = normalized.match(/^prevent\s+(.+?)\s+from\s+(.+)$/i);
  if (preventMatch?.[1] && preventMatch?.[2]) {
    return `${preventMatch[1].trim()} does not ${preventMatch[2].trim()}`;
  }

  const showMatch = normalized.match(/^(?:show|display)\s+(.+)$/i);
  if (showMatch?.[1]) {
    return `${showMatch[1].trim()} is shown`;
  }

  const returnMatch = normalized.match(/^return\s+only\s+(.+)$/i);
  if (returnMatch?.[1]) {
    return `The response returns only ${returnMatch[1].trim()}`;
  }

  return null;
}

function rewriteForcedBehaviorAsTaskAction(text: string): string | null {
  const parsed = parseForcedBehaviorIssue(text);
  if (!parsed) return null;
  const conditionSuffix = parsed.condition ? ` when ${parsed.condition}` : "";
  return `Prevent ${parsed.object} from being forced to ${parsed.behavior}${conditionSuffix}`;
}

function rewriteForcedBehaviorAsSuccessOutcome(text: string): string | null {
  const parsed = parseForcedBehaviorIssue(text);
  if (!parsed) return null;
  const conditionSuffix = parsed.condition ? ` when ${parsed.condition}` : "";
  return `${parsed.object} does not ${parsed.behavior}${conditionSuffix}`;
}

function parseForcedBehaviorIssue(text: string): {
  condition: string | null;
  object: string;
  behavior: string;
} | null {
  const normalized = text
    .trim()
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ");
  if (!normalized) return null;

  const whenMatch = normalized.match(/^when\s+(.+?),\s*(.+)$/i);
  const condition = whenMatch?.[1]?.trim() ?? null;
  const remainder = whenMatch?.[2]?.trim() ?? normalized;

  const forcedBehaviorMatch = remainder.match(
    /^(?:(?:it|this|that|the [^,]+?)\s+)?(?:forces?|causes?)\s+(.+?)\s+to\s+(.+)$/i
  );
  if (!forcedBehaviorMatch?.[1] || !forcedBehaviorMatch?.[2]) {
    return null;
  }

  const object = forcedBehaviorMatch[1].trim();
  const behavior = forcedBehaviorMatch[2]
    .trim()
    .replace(/\s+after\s+it\s+loads?$/i, "")
    .replace(/\s+after\s+loading$/i, "");
  if (!object || !behavior) {
    return null;
  }

  return { condition, object, behavior };
}

function capitalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

export function normalizeOptimizedPromptText(promptText: string): string {
  const normalized = promptText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return normalized;
  const shouldCanonicalize =
    isStructuredOptimizerPrompt(normalized) ||
    /\b(?:isn't working|is not working|doesn't work|does not work|tends to glitch|glitches?|is broken|fails to)\b/i.test(
      normalized
    ) ||
    /\b(chart|graph|x-axis|data points?|horizontal scroll(?:ing)?)\b/i.test(
      normalized
    ) ||
    /\bPreserve the original intent and scope\b/i.test(normalized) ||
    /\bUse direct, concise wording with no filler\b/i.test(normalized) ||
    /\bFix spelling, grammar, and syntax\b/i.test(normalized) ||
    /\bDo not introduce unrelated changes\b/i.test(normalized) ||
    /\bthis looks bad\b/i.test(normalized);
  if (!shouldCanonicalize) {
    return normalized;
  }

  const edits = buildRelevantPromptEdits(normalized);
  const constraints = buildRelevantPromptConstraints(normalized);
  const successCriteria = buildRelevantPromptSuccessCriteria(normalized, edits);
  const firstNonEmptyLine =
    normalized
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? "";
  const task =
    edits.map(stripOptimizerSectionLabel).slice(0, 3).join(" ") ||
    stripOptimizerSectionLabel(firstNonEmptyLine) ||
    normalized;
  const output = /\b(chart|graph)\b/i.test(normalized)
    ? "Return only a compact Markdown bullet list of the required chart changes in 3 bullets."
    : "Return only a compact Markdown bullet list of the required result in 3 bullets.";

  return [
    `Task: ${task}`,
    "Constraints:",
    ...(constraints.length > 0
      ? constraints.map((line) => `- ${line}`)
      : ["- Preserve existing behavior unless needed for the requested fix."]),
    `Output: ${output}`,
    "Success criteria:",
    ...successCriteria.map((line) => `- ${line}`),
  ].join("\n");
}

export function summarizeProviderNote(note: string | null): string | null {
  if (!note) return null;
  if (/local deterministic optimizer was used/i.test(note)) {
    return "Using local optimizer.";
  }
  return note;
}

function buildOutputExample(promptText: string, edits: string[]): string {
  const relevantEdits =
    edits.length > 0 ? edits : buildRelevantPromptEdits(promptText);
  return `Example: add "Output: return only these chart changes in 3 bullets: ${relevantEdits
    .slice(0, 3)
    .map((edit) => edit.replace(/\.$/, "").toLowerCase())
    .join("; ")}."`;
}

function buildConstraintExample(promptText: string, edits: string[]): string {
  const relevantEdits =
    edits.length > 0 ? edits : buildRelevantPromptEdits(promptText);
  const successCriteria =
    relevantEdits.length > 0
      ? relevantEdits
          .slice(0, 3)
          .map((edit) => edit.replace(/\.$/, ""))
          .join("; ")
      : truncateForExample(promptText, 90);
  return `Example: add "Success criteria: ${successCriteria}."`;
}

function buildScoreGapHints(
  promptText: string,
  breakdown: PromptEfficiencyBreakdown
): Array<{
  title: string;
  example: string;
}> {
  const hints: Array<{ title: string; example: string }> = [];
  const relevantEdits = buildRelevantPromptEdits(promptText);
  const conciseRewrite =
    relevantEdits.length > 0
      ? relevantEdits.join(" ")
      : truncateForExample(promptText, 100);
  const originalSnippet = truncateForExample(promptText, 110);

  if (breakdown.brevity < 35) {
    hints.push({
      title:
        "Trim extra context or repeated phrasing in the optimized prompt so the task stays as short as possible.",
      example: `Example: in the optimized prompt, replace "${originalSnippet}" with "${conciseRewrite}"`,
    });
  }
  if (breakdown.outputEfficiency < 30) {
    hints.push({
      title:
        "Add a more explicit output format to the optimized prompt so the model can answer with fewer tokens.",
      example: buildOutputExample(promptText, relevantEdits),
    });
  }
  if (breakdown.redundancyPenalty < 20) {
    hints.push({
      title:
        "Remove filler words and duplicated instructions from the optimized prompt.",
      example: `Example: in the optimized prompt, replace "${originalSnippet}" with "${conciseRewrite}"`,
    });
  }
  if (breakdown.instructionDensity < 15) {
    hints.push({
      title:
        "Add one explicit constraint or success condition to the optimized prompt so the request is more precise.",
      example: buildConstraintExample(promptText, relevantEdits),
    });
  }
  if (hints.length === 0) {
    hints.push({
      title: "This optimized prompt is already at the current scoring ceiling.",
      example:
        "Example: no further change is needed to the optimized prompt under the current heuristic.",
    });
  }
  return hints;
}

function buildHumanRequiredGapHints(
  promptText: string,
  gapHints: Array<{ title: string; example: string }>
): Array<{ title: string; example: string }> {
  const normalized = promptText.trim();
  const needsHumanContext =
    /\b(tbd|todo|placeholder|fill in|decide|choose|pick one|as needed)\b/i.test(
      normalized
    ) ||
    /\[[^\]]+\]/.test(normalized) ||
    /<[^>]+>/.test(normalized) ||
    /\?{2,}/.test(normalized);
  return needsHumanContext ? gapHints : [];
}

function buildWhyHigherNotes(
  originalPrompt: string,
  optimizedPrompt: string,
  notes: string[]
): string[] {
  const items = [...notes];
  if (optimizedPrompt.length < originalPrompt.length) {
    items.unshift(
      `It is shorter and more direct, using ${originalPrompt.length - optimizedPrompt.length} fewer characters than your input.`
    );
  }
  if (
    !/\b(return|output|format)\b/i.test(originalPrompt) &&
    /\b(return|output|format)\b/i.test(optimizedPrompt)
  ) {
    items.push(
      "It makes the expected output more explicit, which helps the model answer with less drift."
    );
  }
  if (items.length === 0) {
    items.push(
      "It is clearer, tighter, and easier for the model to follow without extra interpretation."
    );
  }
  return Array.from(new Set(items)).slice(0, 4);
}

export function buildComparisonNotes(
  originalPrompt: string,
  currentPrompt: string,
  notes: string[],
  scoreDelta: number
): string[] {
  const contentNotes = notes.filter(
    (note) => !/^ai provider\b/i.test(note.trim())
  );
  if (scoreDelta > 0) {
    return buildWhyHigherNotes(originalPrompt, currentPrompt, contentNotes);
  }
  if (scoreDelta < 0) {
    return [
      "The current wording is clearer in places, but it lost efficiency under this scoring model.",
      "Add an explicit output line and remove filler to recover points.",
      ...contentNotes.filter((note) => note.trim().length > 0),
    ].slice(0, 4);
  }
  return [
    "The wording changed, but the current prompt scores the same under this heuristic.",
    "To raise the score, make the output format more explicit or tighten redundant phrasing.",
    ...contentNotes.filter((note) => note.trim().length > 0),
  ].slice(0, 4);
}

export function roundAxisStep(value: number): number {
  if (value <= 0) return 1;
  return Math.max(500, Math.ceil(value / 500) * 500);
}

export function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * ratio))
  );
  return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
}

export function SourcePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`prompt-usage-pill${active ? " is-active" : ""}`}
    >
      {children}
    </button>
  );
}
