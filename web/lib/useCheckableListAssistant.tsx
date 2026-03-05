import React, { useCallback, useState } from "react";
import {
  ASSISTANT_VOICE_CHANGE_EVENT,
  generateIdeaAssistantChat,
  generateListItemAssistantChat,
  getStoredAssistantVoiceUri,
  getStoredOpenRouterModel,
  synthesizeIdeaChatSpeech,
} from "../lib/api";
import { buildIdeaChatContext, shouldUseWebSearch } from "../lib/assistant-context";
import type { ListCacheKey } from "../lib/listCache";
import {
  IdeaAssistantPanel,
  type AssistantChatMessage,
  type AssistantPlaybackStatus,
} from "../components/IdeaAssistantPanel";

export type UseCheckableListAssistantOptions = {
  items: Array<{ id: string; name: string }>;
  listType: ListCacheKey;
  selectedProjectId: string | null;
};

export type UseCheckableListAssistantResult = {
  renderIdeaDetails: (ideaId: string) => React.ReactNode;
  setPendingFocusIdeaId: (id: string | null) => void;
  assistantLoadingById: Record<string, boolean>;
  assistantChatById: Record<string, AssistantChatMessage[]>;
  assistantGifById: Record<string, string>;
  assistantCollapsedById: Record<string, boolean>;
  setAssistantCollapsedById: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  handleAssistantChatRequest: (
    ideaId: string,
    context?: string,
    includeWeb?: boolean
  ) => Promise<void>;
  pruneAssistantStateByIds: (removedIds: Set<string>) => void;
};

function pruneIdsFromRecord<T>(
  source: Record<string, T>,
  removedIds: Set<string>
): Record<string, T> {
  const next = { ...source };
  removedIds.forEach((id) => delete next[id]);
  return next;
}

export function useCheckableListAssistant(
  options: UseCheckableListAssistantOptions
): UseCheckableListAssistantResult {
  const { items, listType, selectedProjectId } = options;

  const [assistantLoadingById, setAssistantLoadingById] = useState<
    Record<string, boolean>
  >({});
  const [assistantChatById, setAssistantChatById] = useState<
    Record<string, AssistantChatMessage[]>
  >({});
  const [assistantInputById, setAssistantInputById] = useState<
    Record<string, string>
  >({});
  const [assistantGifById, setAssistantGifById] = useState<
    Record<string, string>
  >({});
  const [assistantCollapsedById, setAssistantCollapsedById] = useState<
    Record<string, boolean>
  >({});
  const [assistantLoadingStatusById, setAssistantLoadingStatusById] =
    useState<Record<string, string>>({});
  const [assistantVoiceEnabledById, setAssistantVoiceEnabledById] = useState<
    Record<string, boolean>
  >({});
  const [assistantPlaybackStatusById, setAssistantPlaybackStatusById] =
    useState<Record<string, AssistantPlaybackStatus>>({});
  const [assistantRecordingById, setAssistantRecordingById] = useState<
    Record<string, boolean>
  >({});
  const [isMobileAssistantComposer, setIsMobileAssistantComposer] =
    useState(false);
  const [pendingFocusIdeaId, setPendingFocusIdeaId] = useState<string | null>(
    null
  );
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>(
    () => getStoredAssistantVoiceUri() ?? ""
  );

  const assistantInputRefs = React.useRef<
    Record<string, HTMLTextAreaElement | null>
  >({});
  const assistantThreadRefs = React.useRef<
    Record<string, HTMLDivElement | null>
  >({});
  const loadingTickerRef = React.useRef<
    Record<string, ReturnType<typeof setInterval>>
  >({});
  const speechRecognitionRef = React.useRef<any | null>(null);
  const recordingIdeaIdRef = React.useRef<string | null>(null);
  const spokenMessageIdsRef = React.useRef<Record<string, string>>({});
  const assistantAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const assistantAudioMetaRef = React.useRef<{
    ideaId: string | null;
    messageId: string | null;
    voiceUri: string | null;
  }>({ ideaId: null, messageId: null, voiceUri: null });
  const assistantSpeechMetaRef = React.useRef<{
    ideaId: string | null;
    messageId: string | null;
  }>({ ideaId: null, messageId: null });

  const focusIdeaInput = useCallback((ideaId: string) => {
    const node = assistantInputRefs.current[ideaId];
    if (!node) return;
    requestAnimationFrame(() => {
      node.focus({ preventScroll: true });
      const valueLength = node.value.length;
      node.setSelectionRange(valueLength, valueLength);
    });
  }, []);

  const syncIdeaInputViewport = useCallback((ideaId: string) => {
    const node = assistantInputRefs.current[ideaId];
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
      if (document.activeElement === node) {
        const valueLength = node.value.length;
        node.setSelectionRange(valueLength, valueLength);
      }
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobileAssistantComposer(media.matches);
    sync();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  React.useEffect(() => {
    if (!pendingFocusIdeaId) return;
    focusIdeaInput(pendingFocusIdeaId);
    setPendingFocusIdeaId(null);
  }, [
    focusIdeaInput,
    pendingFocusIdeaId,
    assistantLoadingById,
    assistantChatById,
    assistantGifById,
  ]);

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      Object.values(assistantThreadRefs.current).forEach((node) => {
        if (!node) return;
        node.scrollTop = node.scrollHeight;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    assistantChatById,
    assistantLoadingById,
    assistantGifById,
    assistantCollapsedById,
  ]);

  React.useEffect(() => {
    Object.entries(assistantRecordingById).forEach(([ideaId, recording]) => {
      if (!recording) return;
      syncIdeaInputViewport(ideaId);
    });
  }, [assistantInputById, assistantRecordingById, syncIdeaInputViewport]);

  React.useEffect(
    () => () => {
      Object.values(loadingTickerRef.current).forEach((timer) =>
        clearInterval(timer)
      );
      loadingTickerRef.current = {};
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (assistantAudioRef.current) {
        assistantAudioRef.current.pause();
        if (assistantAudioRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(assistantAudioRef.current.src);
        }
        assistantAudioRef.current.src = "";
      }
    },
    []
  );

  React.useEffect(() => {
    const syncVoice = () =>
      setSelectedVoiceUri(getStoredAssistantVoiceUri() ?? "");
    syncVoice();
    if (typeof window === "undefined") return;
    window.addEventListener(ASSISTANT_VOICE_CHANGE_EVENT, syncVoice);
    window.addEventListener("storage", syncVoice);
    return () => {
      window.removeEventListener(ASSISTANT_VOICE_CHANGE_EVENT, syncVoice);
      window.removeEventListener("storage", syncVoice);
    };
  }, []);

  const createChatMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const appendChatAssistantMessage = useCallback(
    (ideaId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setAssistantChatById((prev) => ({
        ...prev,
        [ideaId]: [
          ...(prev[ideaId] ?? []),
          {
            id: createChatMessageId(),
            role: "assistant",
            text: trimmed,
          },
        ],
      }));
    },
    [createChatMessageId]
  );

  const resolveIdeaModel = useCallback(() => {
    const model = getStoredOpenRouterModel();
    return model ?? undefined;
  }, []);

  const handleAssistantChatRequest = useCallback(
    async (ideaId: string, context?: string, includeWeb?: boolean) => {
      const clearLoadingTicker = () => {
        const timer = loadingTickerRef.current[ideaId];
        if (timer) {
          clearInterval(timer);
          delete loadingTickerRef.current[ideaId];
        }
        setAssistantLoadingStatusById((prev) => {
          const next = { ...prev };
          delete next[ideaId];
          return next;
        });
      };
      clearLoadingTicker();
      const startMs = Date.now();
      const phases = includeWeb
        ? [
            "Starting live web lookup...",
            "Fetching fresh sources...",
            "Still fetching live updates...",
            "Still working, validating sources...",
          ]
        : [
            "Thinking...",
            "Still working on it...",
            "Still fetching details...",
            "Still working, almost there...",
          ];
      setAssistantLoadingStatusById((prev) => ({
        ...prev,
        [ideaId]: phases[0],
      }));
      loadingTickerRef.current[ideaId] = setInterval(() => {
        const elapsedSec = Math.max(
          1,
          Math.round((Date.now() - startMs) / 1000)
        );
        const phaseIndex = Math.min(
          phases.length - 1,
          Math.floor(elapsedSec / 4)
        );
        setAssistantLoadingStatusById((prev) => ({
          ...prev,
          [ideaId]: `${phases[phaseIndex]} (${elapsedSec}s)`,
        }));
      }, 1000);

      setAssistantLoadingById((prev) => ({ ...prev, [ideaId]: true }));
      setAssistantGifById((prev) => {
        const next = { ...prev };
        delete next[ideaId];
        return next;
      });
      try {
        const item = items.find((entry) => entry.id === ideaId);
        const isIdeasPage = listType === "ideas";
        const result = isIdeasPage
          ? await generateIdeaAssistantChat(
              ideaId,
              context,
              resolveIdeaModel(),
              includeWeb
            )
          : await generateListItemAssistantChat(
              selectedProjectId ?? "",
              item?.name ?? "",
              context,
              resolveIdeaModel(),
              includeWeb
            );
        setAssistantCollapsedById((prev) => ({ ...prev, [ideaId]: false }));
        appendChatAssistantMessage(
          ideaId,
          typeof result.message === "string" ? result.message : ""
        );
        if (
          typeof result.previewGifUrl === "string" &&
          result.previewGifUrl.trim()
        ) {
          setAssistantGifById((prev) => ({
            ...prev,
            [ideaId]: result.previewGifUrl!,
          }));
        }
      } catch (err) {
        appendChatAssistantMessage(
          ideaId,
          err instanceof Error
            ? err.message
            : "Failed to generate AI assistant response"
        );
      } finally {
        clearLoadingTicker();
        setAssistantLoadingById((prev) => ({ ...prev, [ideaId]: false }));
      }
    },
    [appendChatAssistantMessage, listType, selectedProjectId, items, resolveIdeaModel]
  );

  const submitIdeaChatText = useCallback(
    async (ideaId: string, draftRaw: string) => {
      const draft = draftRaw.trim();
      if (!draft) return;
      if (assistantLoadingById[ideaId]) return;
      const userMessage = {
        id: createChatMessageId(),
        role: "user" as const,
        text: draft,
      };
      const prior = assistantChatById[ideaId] ?? [];
      const context = buildIdeaChatContext(prior, draft);
      const includeWeb = shouldUseWebSearch(draft);
      setAssistantChatById((prev) => ({
        ...prev,
        [ideaId]: [...(prev[ideaId] ?? []), userMessage],
      }));
      setAssistantInputById((prev) => ({ ...prev, [ideaId]: "" }));
      await handleAssistantChatRequest(ideaId, context, includeWeb);
      focusIdeaInput(ideaId);
    },
    [
      assistantChatById,
      assistantLoadingById,
      createChatMessageId,
      focusIdeaInput,
      handleAssistantChatRequest,
    ]
  );

  const toggleVoiceRecording = useCallback(
    async (ideaId: string) => {
      const activeIdea = recordingIdeaIdRef.current;
      if (activeIdea === ideaId && speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        return;
      }
      const SpeechRecognitionCtor =
        typeof window !== "undefined"
          ? (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition
          : null;
      if (!SpeechRecognitionCtor) {
        appendChatAssistantMessage(
          ideaId,
          "Voice input is not supported in this browser."
        );
        return;
      }

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }

      let finalTranscript = "";
      const recognition = new SpeechRecognitionCtor();
      speechRecognitionRef.current = recognition;
      recordingIdeaIdRef.current = ideaId;
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;
      setAssistantRecordingById((prev) => ({ ...prev, [ideaId]: true }));

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i]?.[0]?.transcript ?? "";
          if (event.results[i].isFinal) finalTranscript += piece;
          transcript += piece;
        }
        const merged = (finalTranscript || transcript).trim();
        setAssistantInputById((prev) => ({ ...prev, [ideaId]: merged }));
        syncIdeaInputViewport(ideaId);
      };

      recognition.onerror = (event: any) => {
        appendChatAssistantMessage(
          ideaId,
          `Voice input error: ${String(event?.error ?? "unknown error")}`
        );
      };

      recognition.onend = () => {
        setAssistantRecordingById((prev) => ({ ...prev, [ideaId]: false }));
        if (recordingIdeaIdRef.current === ideaId) {
          recordingIdeaIdRef.current = null;
        }
        if (speechRecognitionRef.current === recognition) {
          speechRecognitionRef.current = null;
        }
        const transcript = finalTranscript.trim();
        if (transcript) {
          void submitIdeaChatText(ideaId, transcript);
        }
      };

      try {
        recognition.start();
      } catch {
        setAssistantRecordingById((prev) => ({ ...prev, [ideaId]: false }));
        appendChatAssistantMessage(
          ideaId,
          "Could not start voice input. Please allow microphone access."
        );
      }
    },
    [appendChatAssistantMessage, submitIdeaChatText, syncIdeaInputViewport]
  );

  const setPlaybackStatus = useCallback(
    (ideaId: string, status: AssistantPlaybackStatus) => {
      setAssistantPlaybackStatusById((prev) => ({ ...prev, [ideaId]: status }));
    },
    []
  );

  const getLatestAssistantMessage = useCallback(
    (ideaId: string) => {
      const messages = assistantChatById[ideaId] ?? [];
      return [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.text.trim());
    },
    [assistantChatById]
  );

  const pauseAssistantPlayback = useCallback(
    (ideaId: string) => {
      if (
        assistantAudioMetaRef.current.ideaId === ideaId &&
        assistantAudioRef.current
      ) {
        if (!assistantAudioRef.current.paused) {
          assistantAudioRef.current.pause();
        }
        setPlaybackStatus(ideaId, "paused");
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        if (
          assistantSpeechMetaRef.current.ideaId === ideaId &&
          synth.speaking &&
          !synth.paused
        ) {
          synth.pause();
          setPlaybackStatus(ideaId, "paused");
        }
      }
    },
    [setPlaybackStatus]
  );

  const playAssistantMessage = useCallback(
    async (
      ideaId: string,
      message: { id: string; text: string },
      opts?: { restart?: boolean }
    ) => {
      if (typeof window === "undefined") return;
      const restart = opts?.restart ?? false;
      const playBrowserSpeech = async () => {
        if (!("speechSynthesis" in window)) {
          throw new Error("Speech synthesis is not available in this browser.");
        }
        const synth = window.speechSynthesis;
        const sameSpeechMessage =
          assistantSpeechMetaRef.current.ideaId === ideaId &&
          assistantSpeechMetaRef.current.messageId === message.id;

        if (sameSpeechMessage && synth.speaking && synth.paused && !restart) {
          synth.resume();
          setPlaybackStatus(ideaId, "playing");
          return;
        }

        synth.cancel();
        const browserVoiceUri = selectedVoiceUri.startsWith("browser:")
          ? selectedVoiceUri.replace(/^browser:/, "")
          : selectedVoiceUri;
        const utterance = new SpeechSynthesisUtterance(message.text);
        const selectedVoice = synth
          .getVoices()
          .find((voice) => voice.voiceURI === browserVoiceUri);
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.onend = () => {
          if (assistantSpeechMetaRef.current.ideaId === ideaId) {
            setPlaybackStatus(ideaId, "idle");
          }
        };
        utterance.onerror = () => {
          if (assistantSpeechMetaRef.current.ideaId === ideaId) {
            setPlaybackStatus(ideaId, "idle");
          }
        };
        assistantSpeechMetaRef.current = { ideaId, messageId: message.id };
        synth.speak(utterance);
        setPlaybackStatus(ideaId, "playing");
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (!synth.speaking && !synth.pending) {
          throw new Error("Browser speech did not start");
        }
      };

      if ("speechSynthesis" in window) {
        const currentSpeechIdeaId = assistantSpeechMetaRef.current.ideaId;
        if (currentSpeechIdeaId && currentSpeechIdeaId !== ideaId) {
          window.speechSynthesis.cancel();
          setPlaybackStatus(currentSpeechIdeaId, "idle");
          assistantSpeechMetaRef.current = { ideaId: null, messageId: null };
        }
      }
      if (assistantAudioRef.current) {
        const currentAudioIdeaId = assistantAudioMetaRef.current.ideaId;
        if (currentAudioIdeaId && currentAudioIdeaId !== ideaId) {
          assistantAudioRef.current.pause();
          setPlaybackStatus(currentAudioIdeaId, "idle");
        }
      }

      if (selectedVoiceUri.startsWith("elevenlabs:")) {
        const voiceId = selectedVoiceUri.replace(/^elevenlabs:/, "").trim();
        if (!assistantAudioRef.current) {
          assistantAudioRef.current = new Audio();
        }
        const audio = assistantAudioRef.current;
        audio.preload = "auto";
        audio.volume = 1;
        audio.onplay = () => {
          const activeIdeaId = assistantAudioMetaRef.current.ideaId;
          if (activeIdeaId) setPlaybackStatus(activeIdeaId, "playing");
        };
        audio.onpause = () => {
          const activeIdeaId = assistantAudioMetaRef.current.ideaId;
          if (!activeIdeaId) return;
          if (!audio.ended) setPlaybackStatus(activeIdeaId, "paused");
        };
        audio.onended = () => {
          const activeIdeaId = assistantAudioMetaRef.current.ideaId;
          if (activeIdeaId) setPlaybackStatus(activeIdeaId, "idle");
        };
        audio.onerror = () => {
          const activeIdeaId = assistantAudioMetaRef.current.ideaId;
          if (activeIdeaId) setPlaybackStatus(activeIdeaId, "idle");
        };

        try {
          const canReuseSource =
            assistantAudioMetaRef.current.ideaId === ideaId &&
            assistantAudioMetaRef.current.messageId === message.id &&
            assistantAudioMetaRef.current.voiceUri === selectedVoiceUri &&
            Boolean(audio.src);

          if (!canReuseSource) {
            const blob = await synthesizeIdeaChatSpeech(
              message.text,
              voiceId || undefined
            );
            const previousSrc = audio.src;
            const nextUrl = URL.createObjectURL(blob);
            audio.pause();
            audio.src = nextUrl;
            if (previousSrc?.startsWith("blob:")) {
              URL.revokeObjectURL(previousSrc);
            }
            assistantAudioMetaRef.current = {
              ideaId,
              messageId: message.id,
              voiceUri: selectedVoiceUri,
            };
          }

          if (restart) audio.currentTime = 0;
          await audio.play();
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (audio.paused) {
            throw new Error("ElevenLabs audio did not start");
          }
          setPlaybackStatus(ideaId, "playing");
          return;
        } catch {
          assistantAudioMetaRef.current = {
            ideaId: null,
            messageId: null,
            voiceUri: null,
          };
        }
      }

      try {
        await playBrowserSpeech();
      } catch {
        try {
          if (!assistantAudioRef.current) {
            assistantAudioRef.current = new Audio();
          }
          const audio = assistantAudioRef.current;
          const blob = await synthesizeIdeaChatSpeech(message.text);
          const previousSrc = audio.src;
          const nextUrl = URL.createObjectURL(blob);
          audio.pause();
          audio.src = nextUrl;
          if (previousSrc?.startsWith("blob:")) {
            URL.revokeObjectURL(previousSrc);
          }
          assistantAudioMetaRef.current = {
            ideaId,
            messageId: message.id,
            voiceUri: "elevenlabs:default",
          };
          if (restart) audio.currentTime = 0;
          await audio.play();
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (audio.paused) {
            throw new Error("Fallback ElevenLabs audio did not start");
          }
          setPlaybackStatus(ideaId, "playing");
        } catch {
          appendChatAssistantMessage(
            ideaId,
            "Voice playback failed. Try selecting a different voice in Settings."
          );
          setPlaybackStatus(ideaId, "idle");
        }
      }
    },
    [appendChatAssistantMessage, selectedVoiceUri, setPlaybackStatus]
  );

  const resumeAssistantPlayback = useCallback(
    async (ideaId: string, message: { id: string; text: string }) => {
      if (
        assistantAudioMetaRef.current.ideaId === ideaId &&
        assistantAudioRef.current
      ) {
        await assistantAudioRef.current.play();
        setPlaybackStatus(ideaId, "playing");
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const synth = window.speechSynthesis;
        if (
          assistantSpeechMetaRef.current.ideaId === ideaId &&
          assistantSpeechMetaRef.current.messageId === message.id &&
          synth.speaking &&
          synth.paused
        ) {
          synth.resume();
          setPlaybackStatus(ideaId, "playing");
          return;
        }
      }
      await playAssistantMessage(ideaId, message);
    },
    [playAssistantMessage, setPlaybackStatus]
  );

  const handleVoiceReplyControl = useCallback(
    async (ideaId: string) => {
      const latestAssistant = getLatestAssistantMessage(ideaId);
      if (!latestAssistant) {
        appendChatAssistantMessage(
          ideaId,
          "No assistant response to play yet."
        );
        return;
      }
      setAssistantVoiceEnabledById((prev) => ({ ...prev, [ideaId]: true }));
      const playbackStatus = assistantPlaybackStatusById[ideaId] ?? "idle";
      try {
        if (playbackStatus === "playing") {
          pauseAssistantPlayback(ideaId);
          return;
        }
        if (playbackStatus === "paused") {
          await resumeAssistantPlayback(ideaId, latestAssistant);
          return;
        }
        await playAssistantMessage(ideaId, latestAssistant, { restart: true });
      } catch {
        appendChatAssistantMessage(
          ideaId,
          "Voice playback failed. Check browser sound and try a different voice."
        );
        setPlaybackStatus(ideaId, "idle");
      }
    },
    [
      appendChatAssistantMessage,
      assistantPlaybackStatusById,
      getLatestAssistantMessage,
      pauseAssistantPlayback,
      playAssistantMessage,
      resumeAssistantPlayback,
    ]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const playReplies = async () => {
      for (const [ideaId, messages] of Object.entries(assistantChatById)) {
        if (!(assistantVoiceEnabledById[ideaId] ?? false)) continue;
        const latestAssistant = [...messages]
          .reverse()
          .find(
            (message) => message.role === "assistant" && message.text.trim()
          );
        if (!latestAssistant) continue;
        if (spokenMessageIdsRef.current[ideaId] === latestAssistant.id)
          continue;
        spokenMessageIdsRef.current[ideaId] = latestAssistant.id;
        try {
          await playAssistantMessage(ideaId, latestAssistant, {
            restart: true,
          });
        } catch {
          // keep chat usable even if audio playback fails
        }
        if (cancelled) return;
      }
    };
    void playReplies();
    return () => {
      cancelled = true;
    };
  }, [assistantChatById, assistantVoiceEnabledById, playAssistantMessage]);

  const renderIdeaDetails = useCallback(
    (ideaId: string) => {
      const messages = assistantChatById[ideaId] ?? [];
      const gifUrl = assistantGifById[ideaId];
      const loading = Boolean(assistantLoadingById[ideaId]);
      const recording = Boolean(assistantRecordingById[ideaId]);
      const voiceRepliesEnabled = Boolean(assistantVoiceEnabledById[ideaId]);
      const playbackStatus = assistantPlaybackStatusById[ideaId] ?? "idle";
      const loadingStatus = assistantLoadingStatusById[ideaId] ?? "Thinking...";
      const inputValue = assistantInputById[ideaId] ?? "";
      const isCollapsed = assistantCollapsedById[ideaId] ?? true;
      return (
        <IdeaAssistantPanel
          messages={messages}
          gifUrl={gifUrl}
          loading={loading}
          recording={recording}
          voiceRepliesEnabled={voiceRepliesEnabled}
          playbackStatus={playbackStatus}
          loadingStatus={loadingStatus}
          inputValue={inputValue}
          isMobileAssistantComposer={isMobileAssistantComposer}
          isCollapsed={isCollapsed}
          onThreadRef={(node) => {
            assistantThreadRefs.current[ideaId] = node;
          }}
          onInputRef={(node) => {
            assistantInputRefs.current[ideaId] = node;
          }}
          onInputChange={(value) =>
            setAssistantInputById((prev) => ({
              ...prev,
              [ideaId]: value,
            }))
          }
          onSend={() => {
            void submitIdeaChatText(ideaId, inputValue);
          }}
          onToggleVoiceRecording={() => {
            void toggleVoiceRecording(ideaId);
          }}
          onVoiceReplyControl={() => {
            void handleVoiceReplyControl(ideaId);
          }}
        />
      );
    },
    [
      assistantChatById,
      assistantCollapsedById,
      assistantGifById,
      assistantInputById,
      assistantLoadingStatusById,
      assistantLoadingById,
      assistantPlaybackStatusById,
      assistantRecordingById,
      assistantVoiceEnabledById,
      handleVoiceReplyControl,
      isMobileAssistantComposer,
      submitIdeaChatText,
      toggleVoiceRecording,
    ]
  );

  const pruneAssistantStateByIds = useCallback((removedIds: Set<string>) => {
    setAssistantChatById((prev) => pruneIdsFromRecord(prev, removedIds));
    setAssistantInputById((prev) => pruneIdsFromRecord(prev, removedIds));
    setAssistantCollapsedById((prev) => pruneIdsFromRecord(prev, removedIds));
    setAssistantGifById((prev) => pruneIdsFromRecord(prev, removedIds));
    setAssistantLoadingById((prev) => pruneIdsFromRecord(prev, removedIds));
    setAssistantLoadingStatusById((prev) =>
      pruneIdsFromRecord(prev, removedIds)
    );
  }, []);

  return {
    renderIdeaDetails,
    setPendingFocusIdeaId,
    assistantLoadingById,
    assistantChatById,
    assistantGifById,
    assistantCollapsedById,
    setAssistantCollapsedById,
    handleAssistantChatRequest,
    pruneAssistantStateByIds,
  };
}
