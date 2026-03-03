import { useEffect, useMemo, useState } from "react";
import {
  AUTH_CHANGE_EVENT,
  ASSISTANT_VOICE_CHANGE_EVENT,
} from "./api";

const DEFAULT_OPENROUTER_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-5-mini",
];

function readPublicEnv(name: string): string | undefined {
  const maybeProcess = (globalThis as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return maybeProcess?.env?.[name];
}

function parseCsvValues(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

const INITIAL_OPENROUTER_MODEL_OPTIONS = (() => {
  const fromEnv = parseCsvValues(
    readPublicEnv("NEXT_PUBLIC_OPENROUTER_MODEL_OPTIONS")
  );
  return fromEnv.length > 0 ? fromEnv : DEFAULT_OPENROUTER_MODELS;
})();

const OPENROUTER_MODEL_SWITCHER_EMAILS = new Set(
  parseCsvValues(
    readPublicEnv("NEXT_PUBLIC_OPENROUTER_MODEL_SWITCHER_EMAILS")
  ).map((email) => email.toLowerCase())
);

export function useAssistantSettings() {
  const [currentUserEmail, setCurrentUserEmail] =
    useState<string | null>(null);
  const [openRouterModelOptions, setOpenRouterModelOptions] =
    useState<string[]>(INITIAL_OPENROUTER_MODEL_OPTIONS);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(
    () => INITIAL_OPENROUTER_MODEL_OPTIONS[0] ?? ""
  );
  const [availableVoices, setAvailableVoices] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => void) | null = null;
    void (async () => {
      const api = await import("./api");
      if (cancelled) return;
      const syncFromAuth = () => {
        const email = api.getUserEmailFromToken();
        setCurrentUserEmail(email);
        setSelectedVoiceUri(api.getStoredAssistantVoiceUri() ?? "");
        const stored = api.getStoredOpenRouterModel();
        if (stored && openRouterModelOptions.includes(stored)) {
          setSelectedAiModel(stored);
          return;
        }
        setSelectedAiModel(openRouterModelOptions[0] ?? "");
      };

      syncFromAuth();
      window.addEventListener(AUTH_CHANGE_EVENT, syncFromAuth);
      removeListener = () =>
        window.removeEventListener(AUTH_CHANGE_EVENT, syncFromAuth);
    })();
    return () => {
      cancelled = true;
      removeListener?.();
    };
  }, [openRouterModelOptions]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return;
    const synth = window.speechSynthesis;
    const syncVoices = async () => {
      const browserVoices = synth
        .getVoices()
        .map((voice) => ({
          value: `browser:${voice.voiceURI}`,
          label: `${voice.name} (${voice.lang})`,
        }))
        .filter((voice, idx, arr) => {
          const voiceUri = voice.value.replace(/^browser:/, "");
          if (!voiceUri) return false;
          return arr.findIndex((v) => v.value === voice.value) === idx;
        })
        .sort((a, b) => a.label.localeCompare(b.label));

      const api = await import("./api");
      let elevenLabsVoices: Array<{ value: string; label: string }> = [];
      try {
        const voices = await api.fetchElevenLabsVoices();
        elevenLabsVoices = voices.map((voice) => ({
          value: `elevenlabs:${voice.id}`,
          label: `11Labs: ${voice.name}`,
        }));
      } catch {
        // keep browser voices only when ElevenLabs is unavailable
      }

      const voices = [...elevenLabsVoices, ...browserVoices];
      setAvailableVoices(voices);
      const stored = api.getStoredAssistantVoiceUri();
      const normalizedStored =
        stored && !stored.includes(":") ? `browser:${stored}` : stored;
      if (
        normalizedStored &&
        voices.some((voice) => voice.value === normalizedStored)
      ) {
        setSelectedVoiceUri(normalizedStored);
        if (stored !== normalizedStored)
          api.setStoredAssistantVoiceUri(normalizedStored);
      } else if (voices[0]) {
        setSelectedVoiceUri(voices[0].value);
      } else {
        setSelectedVoiceUri("");
      }
    };
    void syncVoices();
    const onVoicesChanged = () => {
      void syncVoices();
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
    window.addEventListener(
      ASSISTANT_VOICE_CHANGE_EVENT,
      onVoicesChanged
    );
    return () => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      window.removeEventListener(
        ASSISTANT_VOICE_CHANGE_EVENT,
        onVoicesChanged
      );
    };
  }, []);

  const canManageOpenRouterModel = useMemo(() => {
    const email = currentUserEmail?.toLowerCase().trim();
    if (!email) return false;
    if (openRouterModelOptions.length === 0) return false;
    return OPENROUTER_MODEL_SWITCHER_EMAILS.has(email);
  }, [currentUserEmail, openRouterModelOptions]);

  const selectedVoiceLabel = useMemo(
    () =>
      availableVoices.find(
        (voice) => voice.value === selectedVoiceUri
      )?.label ?? "Assistant voice",
    [availableVoices, selectedVoiceUri]
  );

  useEffect(() => {
    if (!canManageOpenRouterModel) return;
    let active = true;
    (async () => {
      try {
        const { fetchOpenRouterModels } = await import("./api");
        const models = await fetchOpenRouterModels();
        if (!active || models.length === 0) return;
        setOpenRouterModelOptions((prev) => {
          const merged = Array.from(new Set([...models, ...prev]));
          return merged;
        });
      } catch {
        // Keep env/default list when live fetch fails.
      }
    })();
    return () => {
      active = false;
    };
  }, [canManageOpenRouterModel]);

  return {
    availableVoices,
    selectedVoiceUri,
    setSelectedVoiceUri,
    selectedVoiceLabel,
    openRouterModelOptions,
    selectedAiModel,
    setSelectedAiModel,
    canManageOpenRouterModel,
  };
}
