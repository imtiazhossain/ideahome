import {
  QUALITY_SCORE_ITEM_IDS,
  computeQualityScorePercent,
  createDefaultQualityScoreConfig,
  normalizeQualityScoreConfig,
  type ProjectQualityScoreConfig,
  type QualityScoreItemId,
} from "@ideahome/shared";
import type { Issue } from "../../lib/api/issues";

/** Same stops as .quality-score-bar-fill: red -> yellow (50%) -> green. */
export function getQualityScoreColor(percent: number): string {
  const p = Math.max(0, Math.min(100, percent)) / 100;
  const lerp = (a: number, b: number, t: number) =>
    Math.round(a + (b - a) * t);
  let r: number;
  let g: number;
  let b: number;
  if (p <= 0.5) {
    const t = p * 2;
    r = lerp(229, 236, t);
    g = lerp(62, 201, t);
    b = lerp(62, 75, t);
  } else {
    const t = (p - 0.5) * 2;
    r = lerp(236, 56, t);
    g = lerp(201, 161, t);
    b = lerp(75, 105, t);
  }
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export type ScoreItemDefinition = {
  id: QualityScoreItemId;
  label: string;
};

const SCORE_ITEM_LABELS: Record<QualityScoreItemId, string> = {
  title: "Title",
  description: "Description",
  acceptanceCriteria: "Acceptance Criteria",
  database: "Database",
  api: "API",
  testCases: "Test Cases",
  automatedTest: "Automated Tests",
  assignee: "Assigned To",
  comments: "Comments",
  screenshots: "Screenshots",
  recordings: "Recordings",
  files: "Files",
};

export const SCORE_ITEM_DEFINITIONS: ScoreItemDefinition[] =
  QUALITY_SCORE_ITEM_IDS.map((id) => ({
    id,
    label: SCORE_ITEM_LABELS[id],
  }));

export function getQualityScoreConfig(
  value: unknown
): ProjectQualityScoreConfig {
  return normalizeQualityScoreConfig(value ?? createDefaultQualityScoreConfig());
}

export function computeQualityScore(
  issue: Pick<
    Issue,
    | "title"
    | "description"
    | "acceptanceCriteria"
    | "database"
    | "api"
    | "testCases"
    | "automatedTest"
    | "assigneeId"
    | "recordings"
    | "screenshots"
    | "files"
  > & { commentsCount?: number },
  config?: ProjectQualityScoreConfig | null
): number {
  return computeQualityScorePercent(
    issue as unknown as Record<string, unknown>,
    getQualityScoreConfig(config)
  );
}
