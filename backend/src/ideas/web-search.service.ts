import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt: string | null;
};

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  published_date?: unknown;
};

type TavilyResponse = {
  results?: TavilyResult[];
};

@Injectable()
export class WebSearchService {
  private readonly defaultTimeoutMs = 12000;
  private readonly maxSnippetLength = 220;

  isConfigured(): boolean {
    return Boolean(process.env.TAVILY_API_KEY?.trim());
  }

  async search(query: string, limit = 5): Promise<WebSearchResult[]> {
    const normalized = query.trim();
    if (!normalized) throw new BadRequestException("Search query is required");
    const apiKey = process.env.TAVILY_API_KEY?.trim();
    if (!apiKey) {
      throw new BadRequestException(
        "Web search is not configured. Set TAVILY_API_KEY in backend/.env."
      );
    }

    const resultLimit = Math.max(1, Math.min(8, Math.floor(limit)));
    const response = await this.fetchTavily({
      apiKey,
      query: normalized,
      limit: resultLimit,
    });

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException(
          "Web search provider is unavailable"
        );
      }
      throw new BadGatewayException(
        `Web search request failed (${response.status})`
      );
    }

    let payload: TavilyResponse;
    try {
      payload = (await response.json()) as TavilyResponse;
    } catch {
      throw new BadGatewayException("Web search response could not be parsed");
    }

    const rows = Array.isArray(payload.results) ? payload.results : [];
    return rows
      .map((row) => this.normalizeResult(row))
      .filter((row): row is WebSearchResult => Boolean(row))
      .slice(0, resultLimit);
  }

  private normalizeResult(raw: TavilyResult): WebSearchResult | null {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    const snippet = typeof raw.content === "string" ? raw.content.trim() : "";
    const publishedRaw =
      typeof raw.published_date === "string" ? raw.published_date.trim() : "";
    if (!url || !snippet) return null;
    return {
      title: title || url,
      url,
      snippet: snippet.slice(0, this.maxSnippetLength),
      publishedAt: publishedRaw || null,
    };
  }

  private async fetchTavily(input: {
    apiKey: string;
    query: string;
    limit: number;
  }): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);
    try {
      return await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: input.apiKey,
          query: input.query,
          max_results: input.limit,
          search_depth: "advanced",
          include_answer: false,
          include_images: false,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ServiceUnavailableException(
          `Web search timed out after ${this.defaultTimeoutMs}ms`
        );
      }
      throw new ServiceUnavailableException(
        "Web search network request failed"
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
