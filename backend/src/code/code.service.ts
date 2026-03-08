import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";
import {
  buildPromptUsageDetail,
  type PromptUsageDetailEntry,
  type PromptUsageSource,
  type PromptUsageTrendPoint,
  type PromptUsageTrendResponse,
} from "./prompt-usage";

@Injectable()
export class CodeService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly maxPromptUsageRows = 60;
  private readonly defaultProviderTimeoutMs = 30000;
  private readonly defaultOpenRouterModel = "openai/gpt-4o-mini";
  private readonly maxModelLength = 120;
  private readonly optimizerFillerRegex =
    /\b(please|could you|would you|can you|i want you to|just|really|kind of|sort of)\b/i;
  private readonly optimizerRedundancyRegex = /\b(\w+)(?:\s+\1\b)+/gi;

  private async ensureProjectAccess(projectId: string, userId: string) {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  private normalizePromptUsageSource(
    source: unknown
  ): PromptUsageSource {
    if (source === "gpt-openai") return source;
    return "bulby-openrouter";
  }

  private sanitizeRepoFullName(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("Repository full name is required");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException("Repository full name is required");
    }
    if (!trimmed.includes("/")) {
      throw new BadRequestException(
        "Repository full name must be in the form owner/name"
      );
    }
    if (trimmed.length > 200) {
      throw new BadRequestException(
        "Repository full name must be 200 characters or fewer"
      );
    }
    return trimmed;
  }

  async listRepositoriesForProject(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);
    return this.prisma.codeRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createGithubRepositoryForProject(
    projectId: string,
    userId: string,
    data: { repoFullName: unknown; defaultBranch?: unknown }
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repoFullName = this.sanitizeRepoFullName(data.repoFullName);
    let defaultBranch: string | undefined;
    if (typeof data.defaultBranch === "string") {
      const trimmed = data.defaultBranch.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > 200) {
          throw new BadRequestException(
            "Default branch must be 200 characters or fewer"
          );
        }
        defaultBranch = trimmed;
      }
    }
    return this.prisma.codeRepository.create({
      data: {
        projectId,
        provider: "github",
        repoFullName,
        defaultBranch,
      },
    });
  }

  async getLatestAnalysisRun(
    projectId: string,
    userId: string,
    codeRepositoryId: string
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repo = await this.prisma.codeRepository.findFirst({
      where: { id: codeRepositoryId, projectId },
    });
    if (!repo) {
      throw new NotFoundException("Code repository not found");
    }
    return this.prisma.codeAnalysisRun.findFirst({
      where: { codeRepositoryId },
      orderBy: { createdAt: "desc" },
    });
  }

  async saveAnalysisRun(
    projectId: string,
    userId: string,
    codeRepositoryId: string,
    payload: unknown
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repo = await this.prisma.codeRepository.findFirst({
      where: { id: codeRepositoryId, projectId },
    });
    if (!repo) {
      throw new NotFoundException("Code repository not found");
    }
    return this.prisma.codeAnalysisRun.create({
      data: {
        codeRepositoryId,
        payload: payload as any,
      },
    });
  }

  async recordPromptUsage(input: {
    projectId: string;
    userId: string;
    source: unknown;
    promptText: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }) {
    if (!input.projectId || !input.userId) return null;
    if (
      input.promptTokens <= 0 &&
      input.completionTokens <= 0 &&
      input.totalTokens <= 0
    ) {
      return null;
    }
    await this.ensureProjectAccess(input.projectId, input.userId);
    const detail = buildPromptUsageDetail({
      id: "pending",
      timestamp: new Date().toISOString(),
      source: this.normalizePromptUsageSource(input.source),
      promptText: input.promptText.trim(),
      promptTokens: Math.max(0, Math.round(input.promptTokens)),
      completionTokens: Math.max(0, Math.round(input.completionTokens)),
      totalTokens: Math.max(0, Math.round(input.totalTokens)),
    });
    return this.prisma.promptUsageEvent.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        source: detail.source,
        promptText: detail.promptText,
        promptTokens: detail.promptTokens,
        completionTokens: detail.completionTokens,
        totalTokens: detail.totalTokens,
        promptWordCount: detail.promptWordCount,
        efficiencyScore: detail.efficiencyScore,
        improvementHints: detail.improvementHints as unknown as Prisma.InputJsonValue,
        breakdown: detail.breakdown as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getProjectPromptUsageTrend(
    projectId: string,
    userId: string,
    source: unknown
  ): Promise<PromptUsageTrendResponse> {
    await this.ensureProjectAccess(projectId, userId);
    const normalizedSource =
      source === "all" || typeof source !== "string"
        ? "all"
        : this.normalizePromptUsageSource(source);
    const rows = await this.prisma.promptUsageEvent.findMany({
      where: {
        projectId,
        ...(normalizedSource === "all" ? {} : { source: normalizedSource }),
      },
      orderBy: { createdAt: "desc" },
      take: this.maxPromptUsageRows,
      select: {
        createdAt: true,
        totalTokens: true,
        promptTokens: true,
        completionTokens: true,
      },
    });
    const points: PromptUsageTrendPoint[] = rows.reverse().map((row) => ({
      timestamp: row.createdAt.toISOString(),
      totalTokens: row.totalTokens,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      promptCount: 1,
    }));
    return {
      mode: "project",
      source: normalizedSource,
      points,
    };
  }

  async getMyPromptUsage(
    projectId: string,
    userId: string,
    source: unknown
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const normalizedSource =
      source === "all" || typeof source !== "string"
        ? "all"
        : this.normalizePromptUsageSource(source);
    const rows = await this.prisma.promptUsageEvent.findMany({
      where: {
        projectId,
        userId,
        ...(normalizedSource === "all" ? {} : { source: normalizedSource }),
      },
      orderBy: { createdAt: "desc" },
      take: this.maxPromptUsageRows,
    });
    const entries: PromptUsageDetailEntry[] = rows.reverse().map((row) => ({
      id: row.id,
      timestamp: row.createdAt.toISOString(),
      source: this.normalizePromptUsageSource(row.source),
      promptText: row.promptText,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      promptWordCount: row.promptWordCount,
      efficiencyScore: row.efficiencyScore,
      improvementHints: Array.isArray(row.improvementHints)
        ? row.improvementHints.filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [],
      breakdown:
        row.breakdown && typeof row.breakdown === "object"
          ? (row.breakdown as PromptUsageDetailEntry["breakdown"])
          : {
              brevity: 0,
              outputEfficiency: 0,
              redundancyPenalty: 0,
              instructionDensity: 0,
            },
    }));
    return {
      source: normalizedSource,
      entries,
    };
  }

  async clearMyPromptUsage(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);
    await this.prisma.promptUsageEvent.deleteMany({
      where: { projectId, userId },
    });
    return { ok: true };
  }

  async optimizePrompt(input: {
    projectId: string;
    userId: string;
    prompt: unknown;
  }) {
    await this.ensureProjectAccess(input.projectId, input.userId);
    const prompt =
      typeof input.prompt === "string" ? input.prompt.trim() : "";
    if (!prompt) {
      throw new BadRequestException("Prompt is required");
    }
    if (prompt.length > 8000) {
      throw new BadRequestException("Prompt must be 8000 characters or fewer");
    }

    const model = this.resolveModelForOptimization();
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        "AI provider is not configured, so a local deterministic optimizer was used."
      );
    }

    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) headers["X-Title"] = appName;

    const response = await this.fetchOpenRouter({
      headers,
      body: {
        model,
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content:
              "You rewrite prompts for AI models. Produce a strict, compact, paste-ready prompt block. Keep the user's intent and context, fix spelling/grammar/syntax, remove filler and redundancy, use direct instructions, and include explicit output format and constraints. Never output meta-instructions like 'ask for' or 'provide a template'. Return strict JSON only.",
          },
          {
            role: "user",
            content: [
              "Rewrite the following prompt into a structured prompt block that is ready to paste into Codex/OpenAI.",
              "Preserve the original intent and context.",
              "Improve spelling, grammar, syntax, and wording for clarity and token efficiency.",
              "Use a strict compact format with explicit: Task, Context, Constraints, Output format, Success criteria.",
              "Return a structuredPrompt and short notes.",
              "",
              "Prompt to optimize:",
              prompt,
            ].join("\n"),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "prompt_optimizer_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                structuredPrompt: { type: "string" },
                optimizedPrompt: { type: "string" },
                notes: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["structuredPrompt", "notes"],
            },
          },
        },
      },
    }).catch((error) => {
      const message =
        error instanceof Error ? error.message : "Prompt optimization request failed";
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        `AI provider was unavailable (${message}), so a local deterministic optimizer was used.`
      );
    });

    if (!(response instanceof Response)) {
      return response;
    }

    if (!response.ok) {
      const errorBody = (await this.tryReadOpenAiError(response)) ?? null;
      const providerMessage =
        errorBody?.error?.message?.trim() ||
        `Prompt optimization request failed (${response.status})`;
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        `AI provider returned an error (${providerMessage}), so a local deterministic optimizer was used.`
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = this.extractMessageContent(payload);
    if (!content) {
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        "AI provider returned an empty optimization response, so a local deterministic optimizer was used."
      );
    }
    const parsed = this.parseJsonLikeContent(content);
    if (!parsed || typeof parsed !== "object") {
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        "AI provider returned invalid optimization data, so a local deterministic optimizer was used."
      );
    }
    const structuredPrompt = this.readStringField(parsed, "structuredPrompt");
    const optimizedPrompt = this.readStringField(parsed, "optimizedPrompt");
    const repairedPrompt = this.repairOptimizedPrompt(
      prompt,
      structuredPrompt || optimizedPrompt
    );
    const primaryPrompt = repairedPrompt;
    const notes = this.repairOptimizationNotes(
      prompt,
      repairedPrompt,
      this.readStringArrayField(parsed, "notes")
    );
    if (!primaryPrompt) {
      return this.buildLocalPromptOptimizationResult(
        prompt,
        model,
        "AI provider did not return an optimized prompt, so a local deterministic optimizer was used."
      );
    }

    const usage = payload.usage;
    const promptTokens =
      typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const completionTokens =
      typeof usage?.completion_tokens === "number" ? usage.completion_tokens : 0;
    const totalTokens =
      typeof usage?.total_tokens === "number"
        ? usage.total_tokens
        : promptTokens + completionTokens;

    return {
      structuredPrompt: primaryPrompt,
      optimizedPrompt: optimizedPrompt || primaryPrompt,
      notes,
      tokenUsage:
        promptTokens > 0 || completionTokens > 0 || totalTokens > 0
          ? {
              promptTokens,
              completionTokens,
              totalTokens,
            }
          : null,
      source: this.resolvePromptUsageSource(model),
    };
  }

  private buildLocalPromptOptimizationResult(
    prompt: string,
    model: string,
    providerNote: string
  ) {
    const structuredPrompt = this.buildStructuredPromptFallback(prompt);
    const notes = this.repairOptimizationNotes(prompt, structuredPrompt, [
      providerNote,
    ]);
    return {
      structuredPrompt,
      optimizedPrompt: structuredPrompt,
      notes,
      tokenUsage: null,
      source: this.resolvePromptUsageSource(model),
    };
  }

  private readStringField(value: unknown, key: string): string {
    if (!value || typeof value !== "object") return "";
    const record = value as Record<string, unknown>;
    return typeof record[key] === "string" ? record[key].trim() : "";
  }

  private readStringArrayField(value: unknown, key: string): string[] {
    if (!value || typeof value !== "object") return [];
    const record = value as Record<string, unknown>;
    return Array.isArray(record[key])
      ? record[key].filter((entry): entry is string => typeof entry === "string")
      : [];
  }

  private repairOptimizedPrompt(
    originalPrompt: string,
    candidatePrompt: string
  ): string {
    const trimmedCandidate = candidatePrompt.trim();
    const originalFallback = this.buildStructuredPromptFallback(originalPrompt);
    if (!trimmedCandidate || this.isMetaTemplatePrompt(trimmedCandidate)) {
      return originalFallback;
    }
    const normalizedCandidate = this.buildStructuredPromptFallback(trimmedCandidate);
    const best = this.pickBestOptimizerPrompt([
      normalizedCandidate,
      originalFallback,
    ]);
    const originalScore = this.scoreOptimizerPrompt(originalPrompt);
    if (this.scoreOptimizerPrompt(best) <= originalScore) {
      return originalFallback;
    }
    return best;
  }

  private repairOptimizationNotes(
    originalPrompt: string,
    optimizedPrompt: string,
    notes: string[]
  ): string[] {
    const cleanedNotes = notes
      .map((note) => note.trim())
      .filter((note) => note.length > 0 && !this.isMetaTemplatePrompt(note));
    if (cleanedNotes.length > 0) {
      return cleanedNotes.slice(0, 4);
    }
    const fallbackNotes = [
      "Converted the request into a direct, paste-ready prompt instead of meta instructions.",
      "Tightened the wording and removed filler so the model spends fewer tokens interpreting the request.",
      "Added explicit constraints and output framing to reduce ambiguity.",
    ];
    if (optimizedPrompt.length < originalPrompt.length) {
      fallbackNotes.unshift("Shortened the request while preserving the original intent.");
    }
    return fallbackNotes.slice(0, 4);
  }

  private isMetaTemplatePrompt(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    return (
      /\b(?:provide|create|give|generate|write)\s+(?:an?\s+)?template\b/.test(
        normalized
      ) ||
      /\b(?:fill|populate)\s+the\s+(?:optimized\s+)?prompt\b/.test(normalized) ||
      normalized.includes("rerun icon") ||
      normalized.includes("allow rerunning") ||
      normalized.includes("update the score") ||
      normalized.includes("prompt optimizer") ||
      normalized.includes("to reach 100/100")
    );
  }

  private isStructuredPrompt(value: string): boolean {
    return (
      /^task\s*:/im.test(value) &&
      /^constraints\s*:/im.test(value) &&
      /^(output|return)\s*:/im.test(value)
    );
  }

  private scoreOptimizerPrompt(promptText: string): number {
    const breakdown = this.buildOptimizerPromptBreakdown(promptText);
    return (
      breakdown.brevity +
      breakdown.outputEfficiency +
      breakdown.redundancyPenalty +
      breakdown.instructionDensity
    );
  }

  private buildOptimizerPromptBreakdown(
    promptText: string
  ): PromptUsageDetailEntry["breakdown"] {
    const trimmed = promptText.trim();
    const promptTokens = Math.max(0, Math.ceil(trimmed.length / 4));
    const structured = this.isStructuredPrompt(trimmed);
    const effectivePromptTokens = structured
      ? Math.max(0, promptTokens - 40)
      : promptTokens;
    const promptWordCount = this.countOptimizerWords(trimmed);
    const fillerMatches = this.countOptimizerMatches(
      trimmed,
      new RegExp(this.optimizerFillerRegex.source, "gi")
    );
    const redundancyMatches = this.countOptimizerMatches(
      trimmed,
      this.optimizerRedundancyRegex
    );
    const punctuationMatches = this.countOptimizerMatches(trimmed, /[:,\-\n]/g);
    const brevity = Math.max(
      0,
      Math.min(
        35,
        Math.round(
          35 -
            Math.max(0, effectivePromptTokens - (structured ? 85 : 40)) *
              (structured ? 0.035 : 0.08)
        )
      )
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
    if (/\b(only|exactly|at most|under|no more than|limit|maximum|max)\b/i.test(trimmed)) {
      outputEfficiency += 4;
    }
    if (/\b\d+\b/.test(trimmed)) {
      outputEfficiency += 2;
    }
    if (/^(output|return)\s*:/im.test(trimmed)) {
      outputEfficiency += 2;
    }
    outputEfficiency = Math.max(0, Math.min(30, outputEfficiency));
    const redundancyPenalty = Math.max(
      0,
      Math.min(20, 20 - fillerMatches * 5 - redundancyMatches * 4)
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
    const instructionDensity = Math.max(
      0,
      Math.min(
        15,
        Math.round(
          promptWordCount === 0
            ? 0
            : 15 *
                Math.min(
                  1,
                  denseInstructionSignals / Math.max(3, promptWordCount / 8)
                )
        )
      )
    );
    return {
      brevity,
      outputEfficiency,
      redundancyPenalty,
      instructionDensity,
    };
  }

  private countOptimizerWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }

  private countOptimizerMatches(text: string, regex: RegExp): number {
    const matches = text.match(regex);
    return matches ? matches.length : 0;
  }

  private buildStructuredPromptFallback(originalPrompt: string): string {
    const cleaned = originalPrompt
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let task = "";
    let context = "";
    let output = "";
    const extraConstraints: string[] = [];
    const explicitSuccessCriteria: string[] = [];

    for (const line of cleaned) {
      const taskMatch = line.match(/^task\s*:\s*(.+)$/i);
      if (taskMatch) {
        task = taskMatch[1].trim();
        continue;
      }
      const contextMatch = line.match(/^(?:context|background)\s*:\s*(.+)$/i);
      if (contextMatch) {
        context = contextMatch[1].trim();
        continue;
      }
      const outputMatch = line.match(/^(?:return|output)\s*:\s*(.+)$/i);
      if (outputMatch) {
        output = outputMatch[1].trim();
        continue;
      }
      const successMatch = line.match(/^success criteria\s*:\s*(.+)$/i);
      if (successMatch) {
        explicitSuccessCriteria.push(successMatch[1].trim());
        continue;
      }
      extraConstraints.push(line);
    }

    const rawPromptBody = cleaned
      .map((line) =>
        line
          .replace(/^(?:task|context|background|constraints|output|return|success criteria)\s*:/i, "")
          .replace(/^(?:[-*]\s*)+/, "")
          .trim()
      )
      .filter(Boolean)
      .join(" ");
    const inferredActions = this.inferPromptActions(rawPromptBody);
    const extractedActions = this.extractPromptActions(rawPromptBody);
    const actionItems = Array.from(
      new Set([...inferredActions, ...extractedActions].map((item) => item.trim()))
    ).filter(Boolean);
    const actionSummary = actionItems.slice(0, 3).join(" ");

    if (!task || this.shouldReplaceWithActionSummary(task, actionItems)) {
      task =
        actionItems.length > 0
          ? actionSummary
          : cleaned
              .filter((line) => !/^(?:return|output)\s*:/i.test(line))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
    }

    const prefersChartOutput =
      /\b(chart|graph|x-axis|data points?)\b/i.test(
        [rawPromptBody, task, output].join(" ")
      ) || actionItems.some((item) => /\b(chart|graph|x-axis|data points?)\b/i.test(item));
    const canonicalOutput = prefersChartOutput
      ? "Return only a compact Markdown bullet list of the required chart changes in 3 bullets."
      : "Return only a compact Markdown bullet list of the required result in 3 bullets.";
    const outputBreakdown = output
      ? this.buildOptimizerPromptBreakdown(`Output: ${this.ensureTrailingPeriod(output)}`)
      : null;
    if (
      !output ||
      this.shouldReplaceWithActionSummary(output, actionItems) ||
      (outputBreakdown?.outputEfficiency ?? 0) < 30 ||
      !/\b(markdown|bullet|bullets|list)\b/i.test(output) ||
      !/\bonly\b/i.test(output) ||
      !/\b\d+\b/.test(output)
    ) {
      output = canonicalOutput;
    }

    const explicitConstraintCandidates = extraConstraints
      .filter(
        (line) =>
          line.length > 0 &&
          !/^task\s*:/i.test(line) &&
          !/^(?:context|background)\s*:/i.test(line) &&
          !/^(?:return|output|success criteria)\s*:/i.test(line)
      )
      .map((line) => line.replace(/^[*-]\s*/, "").trim())
      .filter((line) => !this.shouldDropAsSubjectiveComplaint(line))
      .filter((line) => this.looksLikeConstraint(line));
    const inferredConstraints = this.inferPromptConstraints(rawPromptBody);
    const taskSpecificConstraints = Array.from(
      new Set(
        [
          ...inferredConstraints,
          ...explicitConstraintCandidates,
        ].map((line) => line.replace(/^[*-]\s*/, "").trim())
      )
    )
      .filter((line) => !this.isBoilerplateOptimizerConstraint(line))
      .slice(0, 4);
    const constraints =
      taskSpecificConstraints.length > 0
        ? taskSpecificConstraints
        : ["Preserve existing behavior unless needed for the requested fix."];

    const successCriteria = Array.from(
      new Set(
        [
          ...explicitSuccessCriteria.filter(
            (line) => !this.shouldDropAsSubjectiveComplaint(line)
          ),
          ...(actionItems.length > 0
            ? this.inferPromptSuccessCriteria(rawPromptBody, actionItems)
            : ["The request is clear, specific, and ready to paste into Codex."]),
        ].map((line) => this.ensureTrailingPeriod(line))
      )
    ).slice(0, 4);

    const sections = [
      `Task: ${this.ensureTrailingPeriod(task)}`,
      context ? `Context: ${context}` : "",
      "Constraints:",
      ...constraints.map((line) => `- ${line}`),
      `Output: ${this.ensureTrailingPeriod(output)}`,
      "Success criteria:",
      ...successCriteria.map((line) => `- ${line}`),
    ].filter(Boolean);

    return sections.join("\n");
  }

  private extractPromptActions(text: string): string[] {
    return Array.from(
      new Set(
        text
          .replace(/\r\n/g, "\n")
          .split(/\n|[.;]/)
          .flatMap((chunk) =>
            chunk
              .split(/\band\b/gi)
              .map((part) => part.trim())
              .filter(Boolean)
          )
          .map((chunk) =>
            chunk
              .replace(/^(?:[-*]\s*)+/, "")
              .replace(
                /^(?:task|context|background|constraints|output|return|success criteria)\s*:/i,
                ""
              )
              .replace(
                /^(?:please|can you|could you|would you|i want you to|just)\s+/i,
                ""
              )
              .replace(/\s+/g, " ")
              .trim()
          )
          .filter(
            (chunk) =>
              chunk.length > 8 &&
              !this.shouldDropAsSubjectiveComplaint(chunk) &&
              !/^(?:task|context|constraints|output|return|success criteria)\b/i.test(
                chunk
              )
          )
          .map((chunk) => this.rewriteTextAsTaskAction(chunk))
      )
    ).slice(0, 4);
  }

  private inferPromptActions(text: string): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();
    const actions: string[] = [];
    if (
      /\b(chart|graph)\b.*\b(stretched|stretched out|distorted|misaligned)\b/i.test(
        normalized
      )
    ) {
      actions.push("Fix the stretched chart layout.");
    }
    if (
      /\bx[- ]axis\b.*\b(does not align|doesn't align|misalign|not align)\b/i.test(
        normalized
      ) ||
      /\balign\b.*\bx[- ]axis\b.*\bdata points?\b/i.test(normalized)
    ) {
      actions.push("Align the x-axis labels with the data points.");
    }
    if (
      /\b(unique|compact)\s+time\b/i.test(normalized) ||
      /\btime\b.*\bbelow\b.*\bdate\b/i.test(normalized)
    ) {
      actions.push("Show a compact time label below each date on the x-axis.");
    }
    if (/\blimit\b.*\b10\b.*\bdata points?\b/i.test(normalized) || /\b10\b.*\bdata points?\b/i.test(normalized)) {
      actions.push("Show 10 data points at a time.");
    }
    if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
      actions.push("Enable horizontal scrolling for the chart.");
    }
    return Array.from(new Set(actions)).slice(0, 4);
  }

  private inferPromptConstraints(text: string): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();
    const constraints: string[] = [];
    if (/\blimit\b.*\b10\b.*\bdata points?\b/i.test(normalized) || /\b10\b.*\bdata points?\b/i.test(normalized)) {
      constraints.push("Limit visible data points to 10.");
    }
    if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
      constraints.push("Use horizontal scrolling for overflow.");
    }
    if (/\bcompact\b.*\btime\b/i.test(normalized) || /\bsimplest format\b/i.test(normalized)) {
      constraints.push("Keep the time label compact.");
    }
    return Array.from(new Set(constraints)).slice(0, 3);
  }

  private inferPromptSuccessCriteria(
    text: string,
    actionItems: string[]
  ): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();
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
    if (/\blimit\b.*\b10\b.*\bdata points?\b/i.test(normalized) || /\b10\b.*\bdata points?\b/i.test(normalized)) {
      criteria.push("The chart shows 10 data points at a time.");
    }
    if (/\bhorizontal scroll(ing)?\b/i.test(normalized)) {
      criteria.push("Overflow is handled with horizontal scrolling.");
    }
    if (criteria.length === 0) {
      const inferredOutcomes = this.extractPromptOutcomeCandidates(text);
      if (inferredOutcomes.length > 0) {
        return inferredOutcomes;
      }
      return actionItems.map((item) =>
        this.rewriteActionAsSuccessCriterion(item)
      );
    }
    return Array.from(new Set(criteria)).slice(0, 4);
  }

  private extractPromptOutcomeCandidates(text: string): string[] {
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
          .map((chunk) => this.rewriteIssueAsSuccessOutcome(chunk))
          .filter((chunk): chunk is string => Boolean(chunk))
          .map((chunk) =>
            this.ensureTrailingPeriod(this.capitalizeSentence(chunk))
          )
      )
    ).slice(0, 4);
  }

  private rewriteActionAsSuccessCriterion(text: string): string {
    const normalized = text
      .trim()
      .replace(/^[*-]\s*/, "")
      .replace(/[.!?]+$/g, "");
    if (!normalized) {
      return text;
    }
    const rewritten = this.rewriteIssueAsSuccessOutcome(normalized);
    return this.ensureTrailingPeriod(
      this.capitalizeSentence(rewritten ?? normalized)
    );
  }

  private rewriteTextAsTaskAction(text: string): string {
    const normalized = text
      .trim()
      .replace(/^[*-]\s*/, "")
      .replace(/[.!?]+$/g, "");
    if (!normalized) {
      return text;
    }
    const issueTask = this.rewriteIssueAsTaskAction(normalized);
    return this.ensureTrailingPeriod(
      this.capitalizeSentence(issueTask ?? normalized)
    );
  }

  private rewriteIssueAsTaskAction(text: string): string | null {
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

  private rewriteIssueAsSuccessOutcome(text: string): string | null {
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

  private capitalizeSentence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  }

  private looksLikeConstraint(text: string): boolean {
    return /\b(keep|preserve|limit|do not|don't|without|only|at most|under|use)\b/i.test(
      text.trim()
    );
  }

  private isBoilerplateOptimizerConstraint(text: string): boolean {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[.!?]+$/g, "");
    return (
      normalized === "preserve the original intent and scope" ||
      normalized === "use direct, concise wording with no filler" ||
      normalized === "fix spelling, grammar, and syntax" ||
      normalized === "do not introduce unrelated changes"
    );
  }

  private shouldDropAsSubjectiveComplaint(text: string): boolean {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return true;
    const hasActionVerb =
      /\b(add|align|show|display|limit|enable|keep|preserve|return|use|fix|update|move|remove|make|set)\b/i.test(
        normalized
      );
    return (
      !hasActionVerb &&
      /\b(looks bad|ugly|terrible|awful|bad|weird|broken|stretched out|distorted)\b/i.test(
        normalized
      )
    );
  }

  private shouldReplaceWithActionSummary(
    currentText: string,
    actionItems: string[]
  ): boolean {
    if (actionItems.length === 0) return false;
    const normalized = currentText.trim();
    if (!normalized) return true;
    if (this.shouldDropAsSubjectiveComplaint(normalized)) return true;
    const actionSummary = actionItems.join(" ");
    return actionSummary.length > 0 && normalized.length > actionSummary.length + 20;
  }

  private ensureTrailingPeriod(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  private pickBestOptimizerPrompt(candidates: string[]): string {
    let best = "";
    let bestScore = -1;
    for (const candidate of candidates) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      const score = this.scoreOptimizerPrompt(trimmed);
      if (
        score > bestScore ||
        (score === bestScore && (best === "" || trimmed.length < best.length))
      ) {
        best = trimmed;
        bestScore = score;
      }
    }
    return best;
  }

  private resolveModelForOptimization(): string {
    const configured = process.env.OPENROUTER_MODEL?.trim();
    if (
      configured &&
      configured.length <= this.maxModelLength &&
      /^[A-Za-z0-9._:/-]+$/.test(configured)
    ) {
      return configured;
    }
    return this.defaultOpenRouterModel;
  }

  private async tryReadOpenAiError(
    response: Response
  ): Promise<{ error?: { message?: string } } | null> {
    try {
      return (await response.json()) as { error?: { message?: string } };
    } catch {
      return null;
    }
  }

  private extractMessageContent(payload: {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
  }): string {
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) {
      return raw
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const row = entry as { text?: unknown };
          return typeof row.text === "string" ? row.text : "";
        })
        .join("")
        .trim();
    }
    if (raw == null) return "";
    return String(raw);
  }

  private parseJsonLikeContent(content: string): unknown | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  private getProviderTimeoutMs(): number {
    const raw = process.env.OPENROUTER_TIMEOUT_MS;
    if (!raw) return this.defaultProviderTimeoutMs;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return this.defaultProviderTimeoutMs;
    return Math.max(5000, Math.min(120000, Math.floor(parsed)));
  }

  private async fetchOpenRouter(input: {
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }): Promise<Response> {
    const timeoutMs = this.getProviderTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: input.headers,
        body: JSON.stringify(input.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Timed out after ${timeoutMs}ms`);
      }
      throw new Error("Network request to AI provider failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private resolvePromptUsageSource(model: string): PromptUsageSource {
    const normalized = model.trim().toLowerCase();
    if (normalized.startsWith("openai/") || normalized.includes("/gpt")) {
      return "gpt-openai";
    }
    return "bulby-openrouter";
  }
}
