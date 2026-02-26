import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

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
      content?: string;
    };
  }>;
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

export type IdeaActionResponse = {
  message: string;
};

@Injectable()
export class IdeaPlanService {
  private readonly defaultProviderTimeoutMs = 30000;

  async generateActionResponse(input: {
    ideaName: string;
    projectName?: string | null;
    context?: string | null;
  }): Promise<IdeaActionResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "AI action is not configured. Set OPENROUTER_API_KEY in backend/.env."
      );
    }

    const primaryModel =
      process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
    const fallbackModelsRaw = process.env.OPENROUTER_FALLBACK_MODELS?.trim() || "";
    const fallbackModels = fallbackModelsRaw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const models = Array.from(new Set([primaryModel, ...fallbackModels]));
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    const context = (input.context ?? "").trim();
    const projectName = (input.projectName ?? "").trim();
    const userPrompt = [
      `User request: ${input.ideaName.trim()}`,
      projectName ? `Project: ${projectName}` : null,
      context ? `Extra context: ${context}` : null,
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
                  "You directly fulfill the user's request and return strict JSON with a single field 'message'.",
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
        lastRetryableError = { status: response.status, message: providerMessage };
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

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException("AI action response was empty");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new InternalServerErrorException("AI action response could not be parsed");
    }
    const message = this.readActionMessage(parsed);
    if (!message) {
      throw new InternalServerErrorException("AI action response was invalid");
    }
    return { message };
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
  }): Promise<IdeaPlan> {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "AI planning is not configured. Set OPENROUTER_API_KEY in backend/.env."
      );
    }

    const primaryModel =
      process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o-mini";
    const fallbackModelsRaw = process.env.OPENROUTER_FALLBACK_MODELS?.trim() || "";
    const fallbackModels = fallbackModelsRaw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const models = Array.from(new Set([primaryModel, ...fallbackModels]));
    const referer = process.env.OPENROUTER_SITE_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim();
    const context = (input.context ?? "").trim();
    const projectName = (input.projectName ?? "").trim();
    const userPrompt = [
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

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new InternalServerErrorException("AI planning response was empty");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new InternalServerErrorException(
        "AI planning response could not be parsed"
      );
    }

    return this.normalizePlan(parsed);
  }

  private normalizePlan(raw: unknown): IdeaPlan {
    if (!raw || typeof raw !== "object") {
      throw new InternalServerErrorException("AI planning response was invalid");
    }

    const source = raw as Record<string, unknown>;
    const summary = this.normalizeString(source.summary, "Plan summary");
    const milestones = this.normalizeStringArray(source.milestones, "Milestones");
    const tasks = this.normalizeStringArray(source.tasks, "Tasks");
    const risks = this.normalizeStringArray(source.risks, "Risks");
    const firstSteps = this.normalizeStringArray(source.firstSteps, "First steps");

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
                required: ["summary", "milestones", "tasks", "risks", "firstSteps"],
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
}
