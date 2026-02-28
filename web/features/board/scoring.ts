import { parseTestCases } from "../../lib/utils";

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

/** Quality score = number of filled issue fields. */
export function computeQualityScore(issue: {
  title?: string | null;
  description?: string | null;
  acceptanceCriteria?: string | null;
  database?: string | null;
  api?: string | null;
  testCases?: string | null;
}): number {
  let score = 0;
  if ((issue.title ?? "").trim()) score += 1;
  if ((issue.description ?? "").trim()) score += 1;
  if ((issue.acceptanceCriteria ?? "").trim()) score += 1;
  if ((issue.database ?? "").trim()) score += 1;
  if ((issue.api ?? "").trim()) score += 1;
  const cases = parseTestCases(issue.testCases);
  if (cases.some((c) => (c ?? "").trim() !== "")) score += 1;
  return score;
}
