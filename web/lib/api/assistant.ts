import {
  pathIdeaAssistantChat,
  pathIdeaPlan,
  pathIdeasAssistantChat,
  pathIdeasElevenlabsVoices,
  pathIdeasOpenrouterModels,
  pathIdeasTts,
} from "@ideahome/shared-config";

export type ElevenLabsVoice = { id: string; name: string };

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  errorMessage: string;
};

type RequestJson = <T>(path: string, options: RequestOptions) => Promise<T>;
type RequestBlob = (path: string, options: RequestOptions) => Promise<Blob>;

function normalizeOptionalText(value?: string): string {
  return typeof value === "string" ? value.trim() : "";
}

export function createAssistantApi<TIdea, TChatResult>(deps: {
  requestJson: RequestJson;
  requestBlob: RequestBlob;
}) {
  async function generateIdeaPlan(
    ideaId: string,
    context?: string,
    model?: string
  ): Promise<TIdea> {
    const payload: { context?: string; model?: string } = {};
    const normalizedContext = normalizeOptionalText(context);
    const normalizedModel = normalizeOptionalText(model);
    if (normalizedContext) payload.context = normalizedContext;
    if (normalizedModel) payload.model = normalizedModel;
    return deps.requestJson<TIdea>(pathIdeaPlan(ideaId), {
      method: "POST",
      body: payload,
      errorMessage: "Failed to generate idea plan",
    });
  }

  async function generateIdeaAssistantChat(
    ideaId: string,
    context?: string,
    model?: string,
    includeWeb?: boolean
  ): Promise<TChatResult> {
    const payload: { context?: string; model?: string; includeWeb?: boolean } =
      {};
    const normalizedContext = normalizeOptionalText(context);
    const normalizedModel = normalizeOptionalText(model);
    if (normalizedContext) payload.context = normalizedContext;
    if (normalizedModel) payload.model = normalizedModel;
    if (includeWeb === true) payload.includeWeb = true;
    return deps.requestJson<TChatResult>(pathIdeaAssistantChat(ideaId), {
      method: "POST",
      body: payload,
      errorMessage: "Failed to generate AI assistant response",
    });
  }

  async function generateListItemAssistantChat(
    projectId: string,
    itemName: string,
    context?: string,
    model?: string,
    includeWeb?: boolean
  ): Promise<TChatResult> {
    const payload: {
      projectId: string;
      itemName: string;
      context?: string;
      model?: string;
      includeWeb?: boolean;
    } = {
      projectId: projectId.trim(),
      itemName: itemName.trim(),
    };
    const normalizedContext = normalizeOptionalText(context);
    const normalizedModel = normalizeOptionalText(model);
    if (normalizedContext) payload.context = normalizedContext;
    if (normalizedModel) payload.model = normalizedModel;
    if (includeWeb === true) payload.includeWeb = true;
    return deps.requestJson<TChatResult>(pathIdeasAssistantChat(), {
      method: "POST",
      body: payload,
      errorMessage: "Failed to generate AI assistant response",
    });
  }

  async function fetchOpenRouterModels(): Promise<string[]> {
    const payload = (await deps.requestJson<unknown>(pathIdeasOpenrouterModels(), {
      errorMessage: "Failed to fetch OpenRouter models",
    })) as unknown;
    if (!Array.isArray(payload)) return [];
    return payload
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  async function fetchElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
    const payload = (await deps.requestJson<unknown>(pathIdeasElevenlabsVoices(), {
      errorMessage: "Failed to fetch ElevenLabs voices",
    })) as unknown;
    if (!Array.isArray(payload)) return [];
    return payload
      .filter((entry): entry is ElevenLabsVoice =>
        Boolean(
          entry &&
            typeof entry === "object" &&
            typeof (entry as ElevenLabsVoice).id === "string" &&
            typeof (entry as ElevenLabsVoice).name === "string"
        )
      )
      .map((entry) => ({ id: entry.id.trim(), name: entry.name.trim() }))
      .filter((entry) => Boolean(entry.id) && Boolean(entry.name));
  }

  async function synthesizeIdeaChatSpeech(
    text: string,
    voiceId?: string
  ): Promise<Blob> {
    const payload: { text: string; voiceId?: string } = { text: text.trim() };
    if (voiceId?.trim()) payload.voiceId = voiceId.trim();
    return deps.requestBlob(pathIdeasTts(), {
      method: "POST",
      body: payload,
      errorMessage: "Failed to synthesize speech",
    });
  }

  return {
    generateIdeaPlan,
    generateIdeaAssistantChat,
    generateListItemAssistantChat,
    fetchOpenRouterModels,
    fetchElevenLabsVoices,
    synthesizeIdeaChatSpeech,
  };
}
