import type {
  PromptEfficiencyBreakdown,
  PromptUsageDetailEntry,
} from "./types";

export type PromptUsageMetricsInput = {
  promptText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
};

const FILLER_REGEX =
  /\b(please|could you|would you|can you|i want you to|just|really|kind of|sort of)\b/i;

const REDUNDANCY_REGEX =
  /\b(\w+)(?:\s+\1\b)+/gi;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

export function buildPromptEfficiencyBreakdown(
  input: PromptUsageMetricsInput
): PromptEfficiencyBreakdown {
  const promptText = input.promptText.trim();
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const wordCount = countWords(promptText);
  const fillerMatches = countMatches(promptText, new RegExp(FILLER_REGEX.source, "gi"));
  const redundancyMatches = countMatches(promptText, REDUNDANCY_REGEX);
  const punctuationMatches = countMatches(promptText, /[:,\-\n]/g);

  const brevity = clamp(Math.round(35 - Math.max(0, promptTokens - 40) * 0.08), 0, 35);
  const ratio = completionTokens > 0 ? promptTokens / completionTokens : promptTokens > 0 ? 4 : 0;
  const outputEfficiency = clamp(Math.round(30 - Math.max(0, ratio - 0.8) * 9), 0, 30);
  const redundancyPenalty = clamp(
    20 - fillerMatches * 5 - redundancyMatches * 4,
    0,
    20
  );
  const denseInstructionSignals = punctuationMatches + (/\b(with|without|only|return|format|include|exclude)\b/i.test(promptText) ? 2 : 0);
  const instructionDensity = clamp(
    Math.round(
      wordCount === 0 ? 0 : 15 * Math.min(1, denseInstructionSignals / Math.max(3, wordCount / 8))
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

export function computePromptEfficiencyScore(
  input: PromptUsageMetricsInput
): number {
  const breakdown = buildPromptEfficiencyBreakdown(input);
  return clamp(
    breakdown.brevity +
      breakdown.outputEfficiency +
      breakdown.redundancyPenalty +
      breakdown.instructionDensity,
    0,
    100
  );
}

export function buildPromptImprovementHints(
  input: PromptUsageMetricsInput
): string[] {
  const promptText = input.promptText.trim();
  const promptTokens = Math.max(0, input.promptTokens);
  const completionTokens = Math.max(0, input.completionTokens);
  const wordCount = countWords(promptText);
  const ratio = completionTokens > 0 ? promptTokens / completionTokens : 0;
  const hints: string[] = [];

  if (promptTokens > 220 || wordCount > 45) {
    hints.push(
      "Lead with the exact task, then keep only the context that changes the answer."
    );
  }
  if (ratio > 1.4) {
    hints.push(
      "Your prompt is heavier than the response. Replace repeated context with file names, IDs, or short constraints."
    );
  }
  if (FILLER_REGEX.test(promptText)) {
    hints.push(
      "Remove filler phrases like polite setup or repeated asks and switch to direct instructions."
    );
  }
  if (/\b(and|also|plus)\b/gi.test(promptText) && wordCount > 25) {
    hints.push(
      "Break the request into numbered requirements so the model does not need a long connective sentence."
    );
  }
  if (!/\b(return|show|output|format|only|include|exclude)\b/i.test(promptText)) {
    hints.push(
      "Specify the output shape up front so the response stays shorter and more targeted."
    );
  }
  if (hints.length === 0) {
    hints.push("This prompt is already fairly lean. Keep the same direct structure.");
  }

  return hints.slice(0, 3);
}

function normalizePromptText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripFillerPhrases(text: string): string {
  return text
    .replace(
      /^(please|can you|could you|would you|i want you to|help me)\b[:,\s-]*/i,
      ""
    )
    .replace(/\b(please|just|really|kind of|sort of)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPromptClauses(text: string): string[] {
  return text
    .split(/\.\s+|\n+|,\s+(?=(?:and|but|with|without|return|show|include|exclude)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildOptimizedPrompt(promptText: string): string {
  const cleaned = stripFillerPhrases(normalizePromptText(promptText));
  if (!cleaned) return "";

  const clauses = splitPromptClauses(cleaned);
  const [firstClause, ...rest] = clauses;
  const task = (firstClause ?? cleaned)
    .replace(/^(to\s+)/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const constraints = rest
    .map((clause) =>
      clause
        .replace(/^(and|also|plus)\s+/i, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const hasOutputDirective = /\b(return|show|output|format|only|include|exclude)\b/i.test(
    cleaned
  );

  const lines = [`Task: ${task}`];
  if (constraints.length > 0) {
    lines.push("Constraints:");
    for (const constraint of constraints.slice(0, 4)) {
      lines.push(`- ${constraint}`);
    }
  }
  if (!hasOutputDirective) {
    lines.push("Return: only the final answer in the smallest useful format.");
  }
  return lines.join("\n");
}

export function buildPromptUsageDetail(
  input: PromptUsageMetricsInput & {
    id: string;
    timestamp: string;
    source: PromptUsageDetailEntry["source"];
  }
): PromptUsageDetailEntry {
  const promptWordCount = countWords(input.promptText);
  const breakdown = buildPromptEfficiencyBreakdown(input);
  return {
    id: input.id,
    timestamp: input.timestamp,
    source: input.source,
    promptText: input.promptText,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens ?? input.promptTokens + input.completionTokens,
    promptWordCount,
    efficiencyScore: computePromptEfficiencyScore(input),
    improvementHints: buildPromptImprovementHints(input),
    breakdown,
  };
}

export function buildShareablePromptCoachTemplate(): string {
  return [
    "Analyze my prompts and reply with an Overall Prompt Efficiency summary for the current set.",
    "1. Total prompt count, total prompt tokens, total completion tokens, total tokens, and average prompt word count.",
    "2. One overall score out of 100 and a score breakdown for brevity, output efficiency, redundancy control, and instruction density.",
    "3. The top improvement priorities based on the most common issues across the prompts.",
    "4. Call out the most common missing prompt structure across the set: task clarity, constraints, output format, and success criteria.",
    "5. When useful, include up to 3 compact rewrite examples that improve efficiency without changing intent.",
    "6. Flag any prompts that still require human-provided details or placeholders before optimization can be complete.",
    "",
    "Keep the advice concrete. Prefer direct rewrites over generic tips.",
    "Do not add charts, trend summaries, or a replacement prompt unless I explicitly ask for them.",
  ].join("\n");
}
