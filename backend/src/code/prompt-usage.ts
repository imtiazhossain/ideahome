export type PromptUsageSource = "bulby-openrouter" | "gpt-openai";

export type PromptEfficiencyBreakdown = {
  brevity: number;
  outputEfficiency: number;
  redundancyPenalty: number;
  instructionDensity: number;
};

export type PromptUsageDetailEntry = {
  id: string;
  timestamp: string;
  source: PromptUsageSource;
  promptText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  promptWordCount: number;
  efficiencyScore: number;
  improvementHints: string[];
  breakdown: PromptEfficiencyBreakdown;
};

export type PromptUsageTrendPoint = {
  timestamp: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  promptCount: number;
};

export type PromptUsageTrendResponse = {
  mode: "project";
  source: PromptUsageSource | "all";
  points: PromptUsageTrendPoint[];
};

type PromptUsageMetricsInput = {
  promptText: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
};

const FILLER_REGEX =
  /\b(please|could you|would you|can you|i want you to|just|really|kind of|sort of)\b/i;
const REDUNDANCY_REGEX = /\b(\w+)(?:\s+\1\b)+/gi;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

export function buildPromptUsageDetail(
  input: PromptUsageMetricsInput & {
    id: string;
    timestamp: string;
    source: PromptUsageSource;
  }
): PromptUsageDetailEntry {
  const promptText = input.promptText.trim();
  const promptWordCount = countWords(promptText);
  const fillerMatches = countMatches(
    promptText,
    new RegExp(FILLER_REGEX.source, "gi")
  );
  const redundancyMatches = countMatches(promptText, REDUNDANCY_REGEX);
  const punctuationMatches = countMatches(promptText, /[:,\-\n]/g);
  const brevity = clamp(
    Math.round(35 - Math.max(0, input.promptTokens - 40) * 0.08),
    0,
    35
  );
  const ratio =
    input.completionTokens > 0
      ? input.promptTokens / input.completionTokens
      : input.promptTokens > 0
        ? 4
        : 0;
  const outputEfficiency = clamp(
    Math.round(30 - Math.max(0, ratio - 0.8) * 9),
    0,
    30
  );
  const redundancyPenalty = clamp(
    20 - fillerMatches * 5 - redundancyMatches * 4,
    0,
    20
  );
  const denseInstructionSignals =
    punctuationMatches +
    (/\b(with|without|only|return|format|include|exclude)\b/i.test(promptText)
      ? 2
      : 0);
  const instructionDensity = clamp(
    Math.round(
      promptWordCount === 0
        ? 0
        : 15 *
            Math.min(1, denseInstructionSignals / Math.max(3, promptWordCount / 8))
    ),
    0,
    15
  );
  const improvementHints: string[] = [];
  if (input.promptTokens > 220 || promptWordCount > 45) {
    improvementHints.push(
      "Lead with the exact task, then keep only the context that changes the answer."
    );
  }
  if (ratio > 1.4) {
    improvementHints.push(
      "Your prompt is heavier than the response. Replace repeated context with file names, IDs, or short constraints."
    );
  }
  if (FILLER_REGEX.test(promptText)) {
    improvementHints.push(
      "Remove filler phrases like polite setup or repeated asks and switch to direct instructions."
    );
  }
  if (/\b(and|also|plus)\b/i.test(promptText) && promptWordCount > 25) {
    improvementHints.push(
      "Break the request into numbered requirements so the model does not need a long connective sentence."
    );
  }
  if (!/\b(return|show|output|format|only|include|exclude)\b/i.test(promptText)) {
    improvementHints.push(
      "Specify the output shape up front so the response stays shorter and more targeted."
    );
  }
  if (improvementHints.length === 0) {
    improvementHints.push(
      "This prompt is already fairly lean. Keep the same direct structure."
    );
  }

  return {
    id: input.id,
    timestamp: input.timestamp,
    source: input.source,
    promptText,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
    totalTokens: input.totalTokens ?? input.promptTokens + input.completionTokens,
    promptWordCount,
    efficiencyScore: clamp(
      brevity + outputEfficiency + redundancyPenalty + instructionDensity,
      0,
      100
    ),
    improvementHints: improvementHints.slice(0, 3),
    breakdown: {
      brevity,
      outputEfficiency,
      redundancyPenalty,
      instructionDensity,
    },
  };
}
