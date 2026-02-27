import React, { useCallback, useState } from "react";
import { CheckableListPageShell } from "./CheckableListPageShell";
import { isOptimisticId } from "../lib/utils";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "../pages/_app";
import {
  ASSISTANT_VOICE_CHANGE_EVENT,
  generateIdeaAssistantChat,
  getStoredAssistantVoiceUri,
  getStoredOpenRouterModel,
  isAuthenticated,
  synthesizeIdeaChatSpeech,
} from "../lib/api";
import {
  CHECKABLE_LIST_PAGES,
  type CheckableListPageKey,
} from "../config/checkableListPages";
import { IconIdeas } from "./icons";
import {
  IdeaAssistantPanel,
  type AssistantChatMessage,
  type AssistantPlaybackStatus,
} from "./IdeaAssistantPanel";

export function CheckableListPage({
  pageKey,
}: {
  pageKey: CheckableListPageKey;
}) {
  const layout = useProjectLayout();
  const theme = useTheme();
  const def = CHECKABLE_LIST_PAGES[pageKey];
  const [addError, setAddError] = useState<string | null>(null);
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
  const [assistantLoadingStatusById, setAssistantLoadingStatusById] = useState<
    Record<string, string>
  >({});
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
  const [undoSyncToast, setUndoSyncToast] = useState<string | null>(null);
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
    if (!undoSyncToast) return;
    const timer = window.setTimeout(() => setUndoSyncToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [undoSyncToast]);

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

  const list = useCheckableProjectList({
    listType: def.listType,
    selectedProjectId: layout.selectedProjectId,
    authenticated: isAuthenticated(),
    fetchList: useCallback(
      (projectId: string) => def.fetchList(projectId),
      [def]
    ),
    createItem: def.createItem,
    updateItem: def.updateItem,
    deleteItem: def.deleteItem,
    reorderItems: def.reorderItems,
    legacyMigration: def.legacyMigration,
    ...(def.showAddError && {
      onAddError: (err) =>
        setAddError(err.message || "Failed to add item. Try again."),
      onReorderError: () =>
        setAddError("Order could not be saved. Item was added."),
    }),
    onUndoSyncError: (message) => setUndoSyncToast(message),
  });

  const handleAddSubmit = useCallback(
    (e: React.FormEvent) => {
      if (def.showAddError) setAddError(null);
      list.addItem(e);
    },
    [def.showAddError, list.addItem]
  );

  const handleCopyList = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setUndoSyncToast("Copy is not supported in this browser.");
      return;
    }
    const text = list.items.map((item) => `- ${item.name}`).join("\n");
    if (!text) {
      setUndoSyncToast("List is empty.");
      return;
    }
    void navigator.clipboard
      .writeText(text)
      .then(() => setUndoSyncToast("List copied."))
      .catch(() => setUndoSyncToast("Could not copy list."));
  }, [list.items]);

  const { theme: themeValue, toggleTheme } = theme;

  const createChatMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const buildIdeaChatContext = useCallback(
    (
      messages: { role: "user" | "assistant"; text: string }[],
      nextPrompt: string
    ) => {
      const recent = messages.slice(-8);
      const transcript = recent
        .map(
          (message) =>
            `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`
        )
        .join("\n");
      return [
        "Continue this conversation and answer the latest user request.",
        transcript ? `Conversation:\n${transcript}` : null,
        `User: ${nextPrompt}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    },
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

  const pruneIdsFromRecord = useCallback(
    <T,>(source: Record<string, T>, removedIds: Set<string>) => {
      const next = { ...source };
      removedIds.forEach((id) => delete next[id]);
      return next;
    },
    []
  );

  const resolveIdeaModel = useCallback(() => {
    const model = getStoredOpenRouterModel();
    return model ?? undefined;
  }, []);

  const shouldUseWebSearch = useCallback((text: string) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    return /(?:latest|today|current|news|recent|right now|this week|this month|weather|forecast|temperature|rain|snow|humidity|wind)/i.test(
      normalized
    );
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
        const result = await generateIdeaAssistantChat(
          ideaId,
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
    [appendChatAssistantMessage, resolveIdeaModel]
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
      buildIdeaChatContext,
      createChatMessageId,
      focusIdeaInput,
      handleAssistantChatRequest,
      shouldUseWebSearch,
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
    [appendChatAssistantMessage, submitIdeaChatText]
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
          // Fall back to browser speech when ElevenLabs is unavailable.
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

  const canBulkDelete = list.items.some(
    (item) => item.done && !isOptimisticId(item.id)
  );

  const handleBulkDelete = useCallback(async () => {
    const removedIds = new Set(
      list.items
        .filter((item) => item.done && !isOptimisticId(item.id))
        .map((item) => item.id)
    );
    await list.removeDoneItems();
    if (removedIds.size > 0) {
      setAssistantChatById((prev) => pruneIdsFromRecord(prev, removedIds));
      setAssistantInputById((prev) => pruneIdsFromRecord(prev, removedIds));
      setAssistantCollapsedById((prev) => pruneIdsFromRecord(prev, removedIds));
      setAssistantGifById((prev) => pruneIdsFromRecord(prev, removedIds));
    }
  }, [list, pruneIdsFromRecord]);

  return (
    <CheckableListPageShell
      appLayoutProps={{
        title: def.title,
        activeTab: def.activeTab,
        projectName: layout.projectDisplayName,
        projectId: layout.selectedProjectId || undefined,
        searchPlaceholder: "Search project",
        drawerOpen: layout.drawerOpen,
        setDrawerOpen: layout.setDrawerOpen,
        projects: layout.projects,
        selectedProjectId: layout.selectedProjectId ?? "",
        setSelectedProjectId: layout.setSelectedProjectId,
        editingProjectId: layout.editingProjectId,
        setEditingProjectId: layout.setEditingProjectId,
        editingProjectName: layout.editingProjectName,
        setEditingProjectName: layout.setEditingProjectName,
        saveProjectName: layout.saveProjectName,
        cancelEditProjectName: layout.cancelEditProjectName,
        projectNameInputRef: layout.projectNameInputRef,
        theme: themeValue,
        toggleTheme,
        projectToDelete: layout.projectToDelete,
        setProjectToDelete: layout.setProjectToDelete,
        projectDeleting: layout.projectDeleting,
        handleDeleteProject: layout.handleDeleteProject,
        onCreateProject: layout.createProjectByName,
      }}
      pageTitle={def.pageTitle}
      addFormProps={{
        value: list.newItem,
        onChange: list.setNewItem,
        onSubmit: def.showAddError ? handleAddSubmit : list.addItem,
        placeholder: def.addPlaceholder,
        ariaLabel: `New ${def.itemLabel}`,
        submitAriaLabel: `Add ${def.itemLabel}`,
        submitTitle: `Add ${def.itemLabel}`,
        ...(def.showAddError && {
          error: addError,
          onClearError: () => setAddError(null),
        }),
      }}
      listTitle={def.listTitle}
      itemCount={list.items.length}
      canUndo={list.canUndo}
      onUndo={list.undo}
      onCopyList={handleCopyList}
      copyListAriaLabel={`Copy ${def.listTitle}`}
      copyListTitle={`Copy ${def.listTitle} as bullet points`}
      canBulkDelete={canBulkDelete}
      onBulkDelete={handleBulkDelete}
      toastMessage={undoSyncToast}
      checkableListProps={{
        items: list.items,
        itemLabel: def.itemLabel,
        emptyMessage: def.emptyMessage,
        loading: list.loading,
        isItemDisabled: (item) => isOptimisticId(item.id),
        editingIndex: list.editingIndex,
        editingValue: list.editingValue,
        onEditingValueChange: list.setEditingValue,
        onStartEdit: list.startEdit,
        onSaveEdit: list.saveEdit,
        onCancelEdit: list.cancelEdit,
        onToggleDone: list.toggleDone,
        onReorder: list.handleReorder,
        onDelete: list.removeItem,
        renderItemActions: (item) => {
          if (item.done) return null;
          const loading = Boolean(assistantLoadingById[item.id]);
          const hasChat =
            (assistantChatById[item.id]?.length ?? 0) > 0 ||
            Boolean(assistantGifById[item.id]);
          const isCollapsed = assistantCollapsedById[item.id] ?? true;
          const hasChatSession = Object.prototype.hasOwnProperty.call(
            assistantCollapsedById,
            item.id
          );
          return (
            <button
              type="button"
              className={`idea-plan-generate-btn${!isCollapsed ? " is-active" : ""}${(hasChat || hasChatSession) && isCollapsed ? " is-dimmed" : ""}${loading ? " is-thinking" : ""}`}
              onClick={() => {
                const willOpen = isCollapsed;
                setAssistantCollapsedById((prev) => ({
                  ...prev,
                  [item.id]: !isCollapsed,
                }));
                if (willOpen) {
                  setPendingFocusIdeaId(item.id);
                  if (!hasChat && !loading) {
                    void handleAssistantChatRequest(item.id);
                  }
                }
              }}
              disabled={isOptimisticId(item.id)}
              aria-label="AI Assistance"
              title="AI Assistance"
            >
              <IconIdeas />
            </button>
          );
        },
        renderItemDetails: (item) => renderIdeaDetails(item.id),
      }}
      addGuard={{
        projectsLoaded: layout.projectsLoaded,
        selectedProjectId: layout.selectedProjectId ?? "",
        message: def.addGuardMessage,
      }}
      listGuard={{
        projectsLoaded: layout.projectsLoaded,
        selectedProjectId: layout.selectedProjectId ?? "",
        message: def.listGuardMessage,
      }}
    />
  );
}
