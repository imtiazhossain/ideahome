import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { PromptUsageSource } from "../code/prompt-usage";
import { WebSearchResult, WebSearchService } from "./web-search.service";

export type IdeaPlan = {
  summary: string;
  milestones: string[];
  tasks: string[];
  risks: string[];
  firstSteps: string[];
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type OpenAiErrorResponse = {
  error?: {
    message?: string;
  };
};

type ProviderError = {
  status: number;
  message: string;
};

type ActionMessagePayload = {
  message: string;
};

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type IdeaActionResponse = {
  message: string;
  tokenUsage?: TokenUsage;
  tokenSource?: PromptUsageSource;
};

export type ElevenLabsVoice = {
  id: string;
  name: string;
};

@Injectable()
export class IdeaPlanService {
  private readonly defaultProviderTimeoutMs = 30000;
  private readonly defaultOpenRouterModel = "openai/gpt-4o-mini";
  private readonly maxModelLength = 120;
  private readonly maxWebSources = 5;
  private readonly maxWebContextSources = 3;
  private readonly defaultElevenLabsVoiceId = "21m00Tcm4TlvDq8ikWAM";
  private readonly maxTtsTextLength = 1200;

  constructor(private readonly webSearchService: WebSearchService) {}

  async generateActionResponse(input: {
    ideaName: string;
    projectName?: string | null;
    context?: string | null;
    preferredModel?: string | null;
    requesterEmail?: string | null;
    includeWeb?: boolean;
  }): Promise<IdeaActionResponse> {
    const directTimeAnswer = this.tryResolveDirectTimeAnswer(input.ideaName);
    if (directTimeAnswer) {
      return { message: directTimeAnswer };
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "AI action is not configured. Set OPENROUTER_API_KEY in backend/.env."
      );
    }

    const models = this.resolveModelsForRequest({
      preferredModel: input.preferredModel,
      requesterEmail: input.requesterEmail,
    });
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    const context = (input.context ?? "").trim();
    const projectName = (input.projectName ?? "").trim();
    const webContext = await this.buildWebContext({
      includeWeb: input.includeWeb === true,
      ideaName: input.ideaName,
      context,
    });
    const dateContext = this.buildDateContext();
    const userPrompt = [
      dateContext,
      `User request: ${input.ideaName.trim()}`,
      projectName ? `Project: ${projectName}` : null,
      context ? `Extra context: ${context}` : null,
      webContext,
      "Do the request directly in assistant form. Keep it short and useful.",
    ]
      .filter(Boolean)
      .join("\n");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) headers["X-Title"] = appName;

    let payload: OpenAiChatCompletionResponse | null = null;
    let lastRetryableError: ProviderError | null = null;

    for (const model of models) {
      let response: Response;
      try {
        response = await this.fetchOpenRouter({
          headers,
          body: {
            model,
            temperature: 0.3,
            max_tokens: 180,
            messages: [
              {
                role: "system",
                content:
                  "You return strict JSON with a single field 'message'. Be truthful about app capabilities. Never claim you created, updated, deleted, sent, saved, or changed anything unless that action was actually executed by the app outside this model. If the request requires a side effect you cannot perform, say clearly that you could not complete it.",
              },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "idea_action_response",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    message: { type: "string" },
                  },
                  required: ["message"],
                },
              },
            },
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "AI action request failed";
        lastRetryableError = { status: 504, message };
        continue;
      }

      if (response.ok) {
        payload = (await response.json()) as OpenAiChatCompletionResponse;
        break;
      }

      const errorBody = (await this.tryReadOpenAiError(response)) ?? null;
      const providerMessage =
        errorBody?.error?.message?.trim() ||
        `AI action request failed (${response.status})`;
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException(
          `AI provider rejected the key: ${providerMessage}`
        );
      }
      if (response.status === 429 || response.status >= 500) {
        lastRetryableError = {
          status: response.status,
          message: providerMessage,
        };
        continue;
      }
      throw new BadGatewayException(providerMessage);
    }

    if (!payload) {
      if (lastRetryableError?.status === 429) {
        throw new HttpException(
          `AI rate limit or quota exceeded: ${lastRetryableError.message}`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      if (lastRetryableError) {
        throw new ServiceUnavailableException(
          `AI provider is unavailable: ${lastRetryableError.message}`
        );
      }
      throw new InternalServerErrorException("AI action request failed");
    }

    const content = this.extractMessageContent(payload);
    if (!content) {
      throw new InternalServerErrorException("AI action response was empty");
    }
    const parsed = this.parseJsonLikeContent(content);
    if (!parsed) {
      throw new InternalServerErrorException(
        "AI action response could not be parsed"
      );
    }
    const message = this.readActionMessage(parsed);
    if (!message) {
      throw new InternalServerErrorException("AI action response was invalid");
    }
    const tokenUsage = this.extractTokenUsage(payload);
    return {
      message,
      ...(tokenUsage ? { tokenUsage } : {}),
      ...(tokenUsage
        ? {
            tokenSource: this.resolvePromptUsageSource(
              input.preferredModel ?? models[0] ?? this.defaultOpenRouterModel
            ),
          }
        : {}),
    };
  }

  async generateActionItems(input: {
    ideaName: string;
    projectName?: string | null;
    context?: string | null;
  }): Promise<string[]> {
    const plan = await this.generatePlan(input);
    const candidates = [...plan.firstSteps, ...plan.tasks];
    const seen = new Set<string>();
    const items: string[] = [];
    for (const candidate of candidates) {
      const normalized = candidate.trim();
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(normalized);
      if (items.length >= 8) break;
    }
    return items;
  }

  async generatePlan(input: {
    ideaName: string;
    projectName?: string | null;
    context?: string | null;
    preferredModel?: string | null;
    requesterEmail?: string | null;
  }): Promise<IdeaPlan> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "AI planning is not configured. Set OPENROUTER_API_KEY in backend/.env."
      );
    }

    const models = this.resolveModelsForRequest({
      preferredModel: input.preferredModel,
      requesterEmail: input.requesterEmail,
    });
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    const context = (input.context ?? "").trim();
    const projectName = (input.projectName ?? "").trim();
    const dateContext = this.buildDateContext();
    const userPrompt = [
      dateContext,
      `Idea: ${input.ideaName.trim()}`,
      projectName ? `Project: ${projectName}` : null,
      context ? `Extra context: ${context}` : null,
      "Create a practical implementation plan suitable for a small team building software.",
    ]
      .filter(Boolean)
      .join("\n");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) headers["X-Title"] = appName;

    let payload: OpenAiChatCompletionResponse | null = null;
    let lastRetryableError: ProviderError | null = null;

    for (const model of models) {
      const result = await this.callProvider({
        model,
        headers,
        userPrompt,
      });
      if (result.ok) {
        payload = result.payload;
        break;
      }

      const error = result.error;
      if (!error) continue;

      if (error.status === 401 || error.status === 403) {
        throw new UnauthorizedException(
          `AI provider rejected the key: ${error.message}`
        );
      }
      if (error.status === 429 || error.status >= 500) {
        lastRetryableError = error;
        continue;
      }
      throw new BadGatewayException(error.message);
    }

    if (!payload) {
      if (lastRetryableError?.status === 429) {
        throw new HttpException(
          `AI rate limit or quota exceeded: ${lastRetryableError.message}`,
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
      if (lastRetryableError) {
        throw new ServiceUnavailableException(
          `AI provider is unavailable: ${lastRetryableError.message}`
        );
      }
      throw new InternalServerErrorException("AI planning request failed");
    }

    const content = this.extractMessageContent(payload);
    if (!content) {
      throw new InternalServerErrorException("AI planning response was empty");
    }

    const parsed = this.parseJsonLikeContent(content);
    if (!parsed) {
      throw new InternalServerErrorException(
        "AI planning response could not be parsed"
      );
    }

    return this.normalizePlan(parsed);
  }

  async listAvailableModels(requesterEmail?: string | null): Promise<string[]> {
    if (!this.canUserOverrideModel(requesterEmail)) {
      throw new ForbiddenException(
        "Model switching is not enabled for this user"
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    const headers: Record<string, string> = {};
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    if (referer) headers["HTTP-Referer"] = referer;
    if (appName) headers["X-Title"] = appName;

    let response: Response;
    try {
      response = await this.fetchOpenRouterModels(headers);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch OpenRouter models";
      throw new ServiceUnavailableException(message);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException("AI provider rejected the key");
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException("AI provider is unavailable");
      }
      throw new BadGatewayException("Failed to fetch OpenRouter models");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        "OpenRouter model list response was invalid"
      );
    }

    const data = (payload as { data?: unknown[] })?.data;
    if (!Array.isArray(data)) {
      throw new BadGatewayException(
        "OpenRouter model list response was invalid"
      );
    }

    const preferredModels = this.parseCsvEnv("OPENROUTER_MODEL_OPTIONS");
    const allowedPreferred = new Set(preferredModels);
    const modelIds = data
      .map((entry) =>
        entry && typeof entry === "object"
          ? (entry as { id?: unknown }).id
          : undefined
      )
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean)
      .filter((id) => this.isAllowedOverrideModel(id))
      .sort((a, b) => {
        const aPreferred = allowedPreferred.has(a);
        const bPreferred = allowedPreferred.has(b);
        if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
        return a.localeCompare(b);
      });

    return Array.from(new Set(modelIds));
  }

  async searchWeb(
    query: string,
    limit = this.maxWebSources
  ): Promise<WebSearchResult[]> {
    return this.webSearchService.search(query, limit);
  }

  async listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      // Voice listing is optional for chat UX; return empty when not configured.
      return [];
    }

    const response = await this.fetchElevenLabsVoices(apiKey);
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Some restricted keys allow TTS but do not allow listing voices.
        // In that case, keep voice features usable by returning an empty list.
        return [];
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException("ElevenLabs is unavailable");
      }
      throw new BadGatewayException(
        `Failed to fetch ElevenLabs voices (${response.status})`
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException(
        "ElevenLabs voices response could not be parsed"
      );
    }

    const voices = (payload as { voices?: unknown[] })?.voices;
    if (!Array.isArray(voices)) return [];
    return voices
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const id = (entry as { voice_id?: unknown }).voice_id;
        const name = (entry as { name?: unknown }).name;
        if (typeof id !== "string" || typeof name !== "string") return null;
        const normalizedId = id.trim();
        const normalizedName = name.trim();
        if (!normalizedId || !normalizedName) return null;
        return { id: normalizedId, name: normalizedName };
      })
      .filter((entry): entry is ElevenLabsVoice => Boolean(entry))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async synthesizeElevenLabsSpeech(
    text: string,
    voiceId?: string
  ): Promise<Buffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "ElevenLabs is not configured. Set ELEVENLABS_API_KEY in backend/.env."
      );
    }
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new BadRequestException("Text is required for speech synthesis");
    }
    const safeText = normalizedText.slice(0, this.maxTtsTextLength);
    const resolvedVoiceId =
      voiceId?.trim() ||
      process.env.ELEVENLABS_DEFAULT_VOICE_ID?.trim() ||
      this.defaultElevenLabsVoiceId;
    const response = await this.fetchElevenLabsSpeech({
      apiKey,
      voiceId: resolvedVoiceId,
      text: safeText,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new UnauthorizedException("ElevenLabs rejected the API key");
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException("ElevenLabs is unavailable");
      }
      throw new BadGatewayException(
        `Failed to synthesize ElevenLabs speech (${response.status})`
      );
    }
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }

  private normalizePlan(raw: unknown): IdeaPlan {
    if (!raw || typeof raw !== "object") {
      throw new InternalServerErrorException(
        "AI planning response was invalid"
      );
    }

    const source = raw as Record<string, unknown>;
    const summary = this.normalizeString(source.summary, "Plan summary");
    const milestones = this.normalizeStringArray(
      source.milestones,
      "Milestones"
    );
    const tasks = this.normalizeStringArray(source.tasks, "Tasks");
    const risks = this.normalizeStringArray(source.risks, "Risks");
    const firstSteps = this.normalizeStringArray(
      source.firstSteps,
      "First steps"
    );

    return { summary, milestones, tasks, risks, firstSteps };
  }

  private normalizeString(value: unknown, label: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new InternalServerErrorException(`${label} was invalid`);
    }
    return value.trim();
  }

  private normalizeStringArray(value: unknown, label: string): string[] {
    if (!Array.isArray(value)) {
      throw new InternalServerErrorException(`${label} were invalid`);
    }
    const items = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (items.length === 0) {
      throw new InternalServerErrorException(`${label} were empty`);
    }
    return items;
  }

  private async tryReadOpenAiError(
    response: Response
  ): Promise<OpenAiErrorResponse | null> {
    try {
      return (await response.json()) as OpenAiErrorResponse;
    } catch {
      return null;
    }
  }

  private async callProvider(input: {
    model: string;
    headers: Record<string, string>;
    userPrompt: string;
  }): Promise<
    | { ok: true; payload: OpenAiChatCompletionResponse }
    | { ok: false; error: ProviderError }
  > {
    let response: Response;
    try {
      response = await this.fetchOpenRouter({
        headers: input.headers,
        body: {
          model: input.model,
          temperature: 0.2,
          max_tokens: 800,
          messages: [
            {
              role: "system",
              content:
                "You generate concise, actionable execution plans. Be concrete and implementation-focused.",
            },
            { role: "user", content: input.userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "idea_plan",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  summary: { type: "string" },
                  milestones: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 7,
                  },
                  tasks: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 5,
                    maxItems: 15,
                  },
                  risks: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 2,
                    maxItems: 8,
                  },
                  firstSteps: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 6,
                  },
                },
                required: [
                  "summary",
                  "milestones",
                  "tasks",
                  "risks",
                  "firstSteps",
                ],
              },
            },
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI planning request failed";
      return {
        ok: false,
        error: { status: 504, message },
      };
    }

    if (!response.ok) {
      const errorBody = (await this.tryReadOpenAiError(response)) ?? null;
      const providerMessage =
        errorBody?.error?.message?.trim() ||
        `AI planning request failed (${response.status})`;
      return {
        ok: false,
        error: { status: response.status, message: providerMessage },
      };
    }

    return {
      ok: true,
      payload: (await response.json()) as OpenAiChatCompletionResponse,
    };
  }

  private readActionMessage(raw: unknown): string {
    if (!raw || typeof raw !== "object") return "";
    const payload = raw as Partial<ActionMessagePayload>;
    if (typeof payload.message !== "string") return "";
    return payload.message.trim();
  }

  private extractTokenUsage(
    payload: OpenAiChatCompletionResponse
  ): TokenUsage | null {
    const usage = payload.usage;
    if (!usage) return null;
    const promptTokens =
      typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0;
    const completionTokens =
      typeof usage.completion_tokens === "number"
        ? usage.completion_tokens
        : 0;
    const totalTokens =
      typeof usage.total_tokens === "number"
        ? usage.total_tokens
        : promptTokens + completionTokens;
    if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
      return null;
    }
    return { promptTokens, completionTokens, totalTokens };
  }

  private extractMessageContent(payload: OpenAiChatCompletionResponse): string {
    const raw = payload.choices?.[0]?.message?.content;
    if (typeof raw === "string") return raw;
    // Some providers return content as structured chunks.
    if (Array.isArray(raw)) {
      const text = raw
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const row = entry as { text?: unknown };
          return typeof row.text === "string" ? row.text : "";
        })
        .join("")
        .trim();
      return text;
    }
    if (raw == null) return "";
    return String(raw);
  }

  private resolvePromptUsageSource(model: string): PromptUsageSource {
    const normalized = model.trim().toLowerCase();
    if (normalized.startsWith("openai/") || normalized.includes("/gpt")) {
      return "gpt-openai";
    }
    return "bulby-openrouter";
  }

  private parseJsonLikeContent(content: string): unknown | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    const direct = this.tryParseJson(trimmed);
    if (direct) return direct;

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch?.[1]) {
      const fromFence = this.tryParseJson(fencedMatch[1].trim());
      if (fromFence) return fromFence;
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const fromObjectSlice = this.tryParseJson(
        trimmed.slice(firstBrace, lastBrace + 1)
      );
      if (fromObjectSlice) return fromObjectSlice;
    }

    return null;
  }

  private tryParseJson(value: string): unknown | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private buildDateContext(): string {
    const now = new Date();
    return `Current server date/time (ISO): ${now.toISOString()} | Current year: ${now.getUTCFullYear()}`;
  }

  private tryResolveDirectTimeAnswer(rawPrompt: string): string | null {
    const prompt = rawPrompt.trim().toLowerCase();
    if (!prompt) return null;
    const now = new Date();
    if (/\b(current|what(?:'s| is)?|today(?:'s)?)\s+year\b/.test(prompt)) {
      return `The current year is ${now.getUTCFullYear()}.`;
    }
    if (/\b(current|what(?:'s| is)?|today(?:'s)?)\s+date\b/.test(prompt)) {
      return `Today's date is ${now.toISOString().slice(0, 10)} (UTC).`;
    }
    if (/\b(current|what(?:'s| is)?)\s+time\b/.test(prompt)) {
      return `The current time is ${now.toISOString()} (UTC).`;
    }
    return null;
  }

  private async buildWebContext(input: {
    includeWeb: boolean;
    ideaName: string;
    context: string;
  }): Promise<string | null> {
    if (!input.includeWeb) return null;
    if (!this.webSearchService.isConfigured()) return null;
    const query = [input.ideaName.trim(), input.context.trim()]
      .filter(Boolean)
      .join(" ");
    if (!query) return null;

    let results: WebSearchResult[];
    try {
      results = await this.webSearchService.search(
        query,
        this.maxWebContextSources
      );
    } catch {
      return null;
    }
    if (results.length === 0) return null;

    const nowIso = new Date().toISOString();
    const lines = results.map((row, idx) => {
      const dateLine = row.publishedAt
        ? ` | published: ${row.publishedAt}`
        : "";
      return `${idx + 1}. ${row.title} (${row.url}${dateLine}) - ${row.snippet}`;
    });
    return [
      `Fresh web context retrieved at ${nowIso}:`,
      ...lines,
      "Use this web context when answering time-sensitive questions and cite the source URLs in plain text.",
    ].join("\n");
  }

  private resolveModelsForRequest(input: {
    preferredModel?: string | null;
    requesterEmail?: string | null;
  }): string[] {
    const primaryModel =
      process.env.OPENROUTER_MODEL?.trim() || this.defaultOpenRouterModel;
    const fallbackModels = this.parseCsvEnv("OPENROUTER_FALLBACK_MODELS");
    const preferredModel: string =
      this.canUserOverrideModel(input.requesterEmail) &&
      this.isAllowedOverrideModel(input.preferredModel)
        ? (input.preferredModel?.trim() ?? "")
        : "";
    return Array.from(
      new Set([preferredModel, primaryModel, ...fallbackModels].filter(Boolean))
    );
  }

  private canUserOverrideModel(email?: string | null): boolean {
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalizedEmail) return false;
    const allowlisted = this.parseCsvEnv(
      "OPENROUTER_MODEL_SWITCHER_EMAILS"
    ).map((value) => value.toLowerCase());
    if (allowlisted.length === 0) return false;
    return allowlisted.includes(normalizedEmail);
  }

  private isAllowedOverrideModel(model?: string | null): boolean {
    const normalized = typeof model === "string" ? model.trim() : "";
    if (!normalized) return false;
    if (normalized.length > this.maxModelLength) return false;
    if (!/^[A-Za-z0-9._:/-]+$/.test(normalized)) return false;
    const allowedModels = this.parseCsvEnv("OPENROUTER_MODEL_OPTIONS");
    if (allowedModels.length === 0) return true;
    return allowedModels.includes(normalized);
  }

  private parseCsvEnv(name: string): string[] {
    const raw = process.env[name]?.trim() || "";
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
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

  private async fetchOpenRouterModels(
    headers: Record<string, string>
  ): Promise<Response> {
    const timeoutMs = this.getProviderTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers,
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

  private async fetchElevenLabsVoices(apiKey: string): Promise<Response> {
    const timeoutMs = this.getProviderTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: {
          "xi-api-key": apiKey,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException(`Timed out after ${timeoutMs}ms`);
      }
      throw new ServiceUnavailableException(
        "Network request to ElevenLabs failed"
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchElevenLabsSpeech(input: {
    apiKey: string;
    voiceId: string;
    text: string;
  }): Promise<Response> {
    const timeoutMs = this.getProviderTimeoutMs();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": input.apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            model_id: "eleven_turbo_v2_5",
            text: input.text,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.75,
            },
          }),
          signal: controller.signal,
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException(`Timed out after ${timeoutMs}ms`);
      }
      throw new ServiceUnavailableException(
        "Network request to ElevenLabs failed"
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
