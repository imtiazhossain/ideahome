import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import {
  createBug,
  createFeature,
  createIdea,
  createTodo,
  deleteBug,
  deleteFeature,
  deleteIdea,
  deleteTodo,
  fetchBugs,
  fetchFeatures,
  fetchIdeas,
  fetchTodos,
  generateIdeaAssistantChat,
  reorderBugs,
  reorderFeatures,
  reorderIdeas,
  reorderTodos,
  updateBug,
  updateFeature,
  updateIdea,
  updateTodo,
  type ChecklistItem,
  type IdeaAssistantChatResult,
} from "../api/client";
import { buildIdeaChatContext } from "@ideahome/shared-assistant";
import type { AppTab, AssistantChatMessage, ChecklistKind } from "../types";
import type { ChecklistSectionProps } from "../components/ChecklistSection";
import { enhancementsStorageKey } from "../utils/enhancementsStorage";

export function useChecklistState(
  token: string,
  selectedProjectId: string,
  activeTab: string
) {
  const [features, setFeatures] = useState<ChecklistItem[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState("");
  const [featureName, setFeatureName] = useState("");
  const [creatingFeature, setCreatingFeature] = useState(false);

  const [todos, setTodos] = useState<ChecklistItem[]>([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todosError, setTodosError] = useState("");
  const [todoName, setTodoName] = useState("");
  const [creatingTodo, setCreatingTodo] = useState(false);

  const [ideas, setIdeas] = useState<ChecklistItem[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState("");
  const [ideaName, setIdeaName] = useState("");
  const [creatingIdea, setCreatingIdea] = useState(false);
  const [ideaAssistantChatById, setIdeaAssistantChatById] = useState<
    Record<string, AssistantChatMessage[]>
  >({});
  const [ideaAssistantDraftById, setIdeaAssistantDraftById] = useState<Record<string, string>>({});
  const [ideaAssistantExpandedById, setIdeaAssistantExpandedById] = useState<
    Record<string, boolean>
  >({});
  const [ideaAssistantLoadingById, setIdeaAssistantLoadingById] = useState<
    Record<string, boolean>
  >({});

  const [bugs, setBugs] = useState<ChecklistItem[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [bugsError, setBugsError] = useState("");
  const [bugName, setBugName] = useState("");
  const [creatingBug, setCreatingBug] = useState(false);
  const [enhancements, setEnhancements] = useState<ChecklistItem[]>([]);
  const [enhancementsLoading, setEnhancementsLoading] = useState(false);
  const [enhancementsError, setEnhancementsError] = useState("");
  const [enhancementName, setEnhancementName] = useState("");
  const [creatingEnhancement, setCreatingEnhancement] = useState(false);
  const [clearingEnhancements, setClearingEnhancements] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<{
    kind: ChecklistKind;
    id: string;
    name: string;
  } | null>(null);

  const createAssistantMessageId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const loadFeatures = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setFeaturesLoading(true);
    setFeaturesError("");
    try {
      const data = await fetchFeatures(token, selectedProjectId);
      setFeatures(Array.isArray(data) ? data : []);
    } catch (error) {
      setFeaturesError(error instanceof Error ? error.message : "Failed to load features");
    } finally {
      setFeaturesLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadTodos = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setTodosLoading(true);
    setTodosError("");
    try {
      const data = await fetchTodos(token, selectedProjectId);
      setTodos(Array.isArray(data) ? data : []);
    } catch (error) {
      setTodosError(error instanceof Error ? error.message : "Failed to load todos");
    } finally {
      setTodosLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadIdeas = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setIdeasLoading(true);
    setIdeasError("");
    try {
      const data = await fetchIdeas(token, selectedProjectId);
      setIdeas(Array.isArray(data) ? data : []);
    } catch (error) {
      setIdeasError(error instanceof Error ? error.message : "Failed to load ideas");
    } finally {
      setIdeasLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadBugs = useCallback(async () => {
    if (!token || !selectedProjectId) return;
    setBugsLoading(true);
    setBugsError("");
    try {
      const data = await fetchBugs(token, selectedProjectId);
      setBugs(Array.isArray(data) ? data : []);
    } catch (error) {
      setBugsError(error instanceof Error ? error.message : "Failed to load bugs");
    } finally {
      setBugsLoading(false);
    }
  }, [selectedProjectId, token]);

  const loadEnhancements = useCallback(async () => {
    if (!selectedProjectId || !token) return;
    setEnhancementsLoading(true);
    setEnhancementsError("");
    try {
      const key = enhancementsStorageKey(selectedProjectId, token);
      const raw = (await AsyncStorage.getItem(key)) ?? "[]";
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setEnhancements([]);
        return;
      }
      const normalized = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String((item as { id?: unknown }).id ?? ""),
          name: String((item as { name?: unknown }).name ?? ""),
          done: Boolean((item as { done?: unknown }).done),
          order: Number((item as { order?: unknown }).order ?? 0),
          projectId: String((item as { projectId?: unknown }).projectId ?? selectedProjectId),
          createdAt: String(
            (item as { createdAt?: unknown }).createdAt ?? new Date().toISOString()
          ),
        }))
        .filter((item) => item.id && item.name);
      setEnhancements(normalized.sort((a, b) => a.order - b.order));
    } catch {
      setEnhancementsError("Failed to load enhancements");
      setEnhancements([]);
    } finally {
      setEnhancementsLoading(false);
    }
  }, [selectedProjectId, token]);

  useEffect(() => {
    const ideaIds = new Set(ideas.map((idea) => idea.id));
    const pruneRecord = <T,>(source: Record<string, T>): Record<string, T> => {
      const next: Record<string, T> = {};
      Object.entries(source).forEach(([key, value]) => {
        if (ideaIds.has(key)) next[key] = value;
      });
      return next;
    };
    setIdeaAssistantChatById((current) => pruneRecord(current));
    setIdeaAssistantDraftById((current) => pruneRecord(current));
    setIdeaAssistantExpandedById((current) => pruneRecord(current));
    setIdeaAssistantLoadingById((current) => pruneRecord(current));
  }, [ideas]);

  const clearChecklist = useCallback(() => {
    setFeatures([]);
    setTodos([]);
    setIdeas([]);
    setBugs([]);
    setEnhancements([]);
    setFeatureName("");
    setTodoName("");
    setIdeaName("");
    setBugName("");
    setEnhancementName("");
    setIdeaAssistantChatById({});
    setIdeaAssistantDraftById({});
    setIdeaAssistantExpandedById({});
    setIdeaAssistantLoadingById({});
    setEditingChecklist(null);
  }, []);

  useEffect(() => {
    clearChecklist();
  }, [selectedProjectId, clearChecklist]);

  useEffect(() => {
    if (!token) return;
    if (activeTab === "features") loadFeatures().catch(() => {});
    if (activeTab === "todos") loadTodos().catch(() => {});
    if (activeTab === "ideas") loadIdeas().catch(() => {});
    if (activeTab === "bugs") loadBugs().catch(() => {});
    if (activeTab === "enhancements") loadEnhancements().catch(() => {});
  }, [
    activeTab,
    token,
    loadFeatures,
    loadTodos,
    loadIdeas,
    loadBugs,
    loadEnhancements,
  ]);

  const clearEnhancementsForProject = useCallback(async () => {
    if (!selectedProjectId || !token) return;
    setClearingEnhancements(true);
    try {
      const key = enhancementsStorageKey(selectedProjectId, token);
      await AsyncStorage.removeItem(key);
      setEnhancements([]);
      Alert.alert("Enhancements cleared", "Local enhancements were removed for this project.");
    } catch (error) {
      Alert.alert(
        "Clear enhancements failed",
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setClearingEnhancements(false);
    }
  }, [selectedProjectId, token]);

  const clearEnhancements = useCallback(() => {
    return clearEnhancementsForProject();
  }, [clearEnhancementsForProject]);

  const handleIdeaAssistantSend = useCallback(
    async (idea: ChecklistItem) => {
      if (!token) return;
      const draft = (ideaAssistantDraftById[idea.id] ?? "").trim();
      if (!draft) return;
      if (ideaAssistantLoadingById[idea.id]) return;
      const prior = ideaAssistantChatById[idea.id] ?? [];
      const context = buildIdeaChatContext(prior, draft);
      const userMessage: AssistantChatMessage = {
        id: createAssistantMessageId(),
        role: "user",
        text: draft,
      };
      setIdeaAssistantExpandedById((current) => ({ ...current, [idea.id]: true }));
      setIdeaAssistantDraftById((current) => ({ ...current, [idea.id]: "" }));
      setIdeaAssistantChatById((current) => ({
        ...current,
        [idea.id]: [...(current[idea.id] ?? []), userMessage],
      }));
      setIdeaAssistantLoadingById((current) => ({ ...current, [idea.id]: true }));
      try {
        const result: IdeaAssistantChatResult = await generateIdeaAssistantChat(token, idea.id, context);
        const assistantText =
          typeof result.message === "string" && result.message.trim()
            ? result.message.trim()
            : "No assistant response text was returned.";
        setIdeaAssistantChatById((current) => ({
          ...current,
          [idea.id]: [
            ...(current[idea.id] ?? []),
            { id: createAssistantMessageId(), role: "assistant", text: assistantText },
          ],
        }));
      } catch (error) {
        setIdeaAssistantChatById((current) => ({
          ...current,
          [idea.id]: [
            ...(current[idea.id] ?? []),
            {
              id: createAssistantMessageId(),
              role: "assistant",
              text: error instanceof Error ? error.message : "Failed to generate AI assistant response",
            },
          ],
        }));
      } finally {
        setIdeaAssistantLoadingById((current) => ({ ...current, [idea.id]: false }));
      }
    },
    [
      createAssistantMessageId,
      ideaAssistantChatById,
      ideaAssistantDraftById,
      ideaAssistantLoadingById,
      token,
    ]
  );

  const handleChecklistReorder = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem, direction: "up" | "down") => {
      if (!token || !selectedProjectId) return;
      const items =
        kind === "features"
          ? features
          : kind === "enhancements"
            ? enhancements
            : kind === "todos"
              ? todos
              : kind === "ideas"
                ? ideas
                : bugs;
      const sorted = [...items].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((entry) => entry.id === item.id);
      if (index < 0) return;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return;
      const swapped = [...sorted];
      const tmp = swapped[index];
      swapped[index] = swapped[targetIndex];
      swapped[targetIndex] = tmp;
      const ids = swapped.map((entry) => entry.id);
      try {
        if (kind === "features") {
          await reorderFeatures(token, selectedProjectId, ids);
          await loadFeatures();
        }
        if (kind === "todos") {
          await reorderTodos(token, selectedProjectId, ids);
          await loadTodos();
        }
        if (kind === "ideas") {
          await reorderIdeas(token, selectedProjectId, ids);
          await loadIdeas();
        }
        if (kind === "bugs") {
          await reorderBugs(token, selectedProjectId, ids);
          await loadBugs();
        }
        if (kind === "enhancements") {
          const reordered = swapped.map((entry, reorderIndex) => ({
            ...entry,
            order: reorderIndex,
          }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(reordered));
          setEnhancements(reordered);
        }
      } catch (error) {
        Alert.alert("Reorder failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [
      bugs,
      enhancements,
      features,
      ideas,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todos,
      token,
    ]
  );

  const handleChecklistCreate = useCallback(
    async (kind: ChecklistKind) => {
      if (!token || !selectedProjectId) return;
      if (kind === "features") {
        const name = featureName.trim();
        if (!name) return;
        setCreatingFeature(true);
        try {
          await createFeature(token, { projectId: selectedProjectId, name });
          setFeatureName("");
          await loadFeatures();
        } catch (error) {
          Alert.alert("Create feature failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingFeature(false);
        }
      }

      if (kind === "enhancements") {
        const name = enhancementName.trim();
        if (!name) return;
        setCreatingEnhancement(true);
        try {
          const nextItem: ChecklistItem = {
            id: `enh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name,
            done: false,
            order: enhancements.length,
            projectId: selectedProjectId,
            createdAt: new Date().toISOString(),
          };
          const next = [...enhancements, nextItem];
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
          setEnhancementName("");
        } catch (error) {
          Alert.alert(
            "Create enhancement failed",
            error instanceof Error ? error.message : "Unknown error"
          );
        } finally {
          setCreatingEnhancement(false);
        }
      }

      if (kind === "todos") {
        const name = todoName.trim();
        if (!name) return;
        setCreatingTodo(true);
        try {
          await createTodo(token, { projectId: selectedProjectId, name });
          setTodoName("");
          await loadTodos();
        } catch (error) {
          Alert.alert("Create todo failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingTodo(false);
        }
      }

      if (kind === "ideas") {
        const name = ideaName.trim();
        if (!name) return;
        setCreatingIdea(true);
        try {
          await createIdea(token, { projectId: selectedProjectId, name });
          setIdeaName("");
          await loadIdeas();
        } catch (error) {
          Alert.alert("Create idea failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingIdea(false);
        }
      }

      if (kind === "bugs") {
        const name = bugName.trim();
        if (!name) return;
        setCreatingBug(true);
        try {
          await createBug(token, { projectId: selectedProjectId, name });
          setBugName("");
          await loadBugs();
        } catch (error) {
          Alert.alert("Create bug failed", error instanceof Error ? error.message : "Unknown error");
        } finally {
          setCreatingBug(false);
        }
      }
    },
    [
      bugName,
      enhancementName,
      enhancements,
      featureName,
      ideaName,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todoName,
      token,
    ]
  );

  const handleChecklistToggle = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem) => {
      if (!token) return;
      try {
        if (kind === "features") {
          await updateFeature(token, item.id, { done: !item.done });
          await loadFeatures();
        }
        if (kind === "todos") {
          await updateTodo(token, item.id, { done: !item.done });
          await loadTodos();
        }
        if (kind === "ideas") {
          await updateIdea(token, item.id, { done: !item.done });
          await loadIdeas();
        }
        if (kind === "bugs") {
          await updateBug(token, item.id, { done: !item.done });
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements.map((entry) =>
            entry.id === item.id ? { ...entry, done: !entry.done } : entry
          );
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [enhancements, loadBugs, loadFeatures, loadIdeas, loadTodos, selectedProjectId, token]
  );

  const handleChecklistDelete = useCallback(
    async (kind: ChecklistKind, item: ChecklistItem) => {
      if (!token) return;
      try {
        if (kind === "features") {
          await deleteFeature(token, item.id);
          await loadFeatures();
        }
        if (kind === "todos") {
          await deleteTodo(token, item.id);
          await loadTodos();
        }
        if (kind === "ideas") {
          await deleteIdea(token, item.id);
          await loadIdeas();
        }
        if (kind === "bugs") {
          await deleteBug(token, item.id);
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements
            .filter((entry) => entry.id !== item.id)
            .map((entry, index) => ({ ...entry, order: index }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert("Delete failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [enhancements, loadBugs, loadFeatures, loadIdeas, loadTodos, selectedProjectId, token]
  );

  const handleChecklistClearDone = useCallback(
    async (kind: ChecklistKind) => {
      if (!token) return;
      const list =
        kind === "features"
          ? features
          : kind === "enhancements"
            ? enhancements
            : kind === "todos"
              ? todos
              : kind === "ideas"
                ? ideas
                : bugs;
      const completed = list.filter((item) => item.done);
      if (!completed.length) return;
      try {
        if (kind === "features") {
          await Promise.all(completed.map((item) => deleteFeature(token, item.id)));
          await loadFeatures();
          return;
        }
        if (kind === "todos") {
          await Promise.all(completed.map((item) => deleteTodo(token, item.id)));
          await loadTodos();
          return;
        }
        if (kind === "ideas") {
          await Promise.all(completed.map((item) => deleteIdea(token, item.id)));
          await loadIdeas();
          return;
        }
        if (kind === "bugs") {
          await Promise.all(completed.map((item) => deleteBug(token, item.id)));
          await loadBugs();
          return;
        }
        if (kind === "enhancements") {
          const next = enhancements
            .filter((entry) => !entry.done)
            .map((entry, index) => ({ ...entry, order: index }));
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
      } catch (error) {
        Alert.alert(
          "Clear completed failed",
          error instanceof Error ? error.message : "Unknown error"
        );
      }
    },
    [
      bugs,
      enhancements,
      features,
      ideas,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      todos,
      token,
    ]
  );

  const startChecklistEdit = useCallback((kind: ChecklistKind, item: ChecklistItem) => {
    setEditingChecklist({ kind, id: item.id, name: item.name });
  }, []);

  const cancelChecklistEdit = useCallback(() => {
    setEditingChecklist(null);
  }, []);

  const saveChecklistEdit = useCallback(
    async (kind: ChecklistKind) => {
      if (!token || !editingChecklist || editingChecklist.kind !== kind) return;
      const name = editingChecklist.name.trim();
      if (!name) return;
      try {
        if (kind === "features") {
          await updateFeature(token, editingChecklist.id, { name });
          await loadFeatures();
        }
        if (kind === "todos") {
          await updateTodo(token, editingChecklist.id, { name });
          await loadTodos();
        }
        if (kind === "ideas") {
          await updateIdea(token, editingChecklist.id, { name });
          await loadIdeas();
        }
        if (kind === "bugs") {
          await updateBug(token, editingChecklist.id, { name });
          await loadBugs();
        }
        if (kind === "enhancements") {
          const next = enhancements.map((entry) =>
            entry.id === editingChecklist.id ? { ...entry, name } : entry
          );
          const key = enhancementsStorageKey(selectedProjectId, token);
          await AsyncStorage.setItem(key, JSON.stringify(next));
          setEnhancements(next);
        }
        setEditingChecklist(null);
      } catch (error) {
        Alert.alert("Rename failed", error instanceof Error ? error.message : "Unknown error");
      }
    },
    [
      editingChecklist,
      enhancements,
      loadBugs,
      loadFeatures,
      loadIdeas,
      loadTodos,
      selectedProjectId,
      token,
    ]
  );

  const CHECKLIST_TABS: ChecklistKind[] = [
    "features",
    "todos",
    "ideas",
    "bugs",
    "enhancements",
  ];
  const isChecklistTab = (tab: AppTab): tab is ChecklistKind =>
    CHECKLIST_TABS.includes(tab as ChecklistKind);

  const checklistSectionPropsByKind = useMemo((): Record<
    ChecklistKind,
    ChecklistSectionProps
  > => {
    const base = (kind: ChecklistKind) => ({
      selectedProjectId,
      editingId: editingChecklist?.kind === kind ? editingChecklist.id : "",
      editingName: editingChecklist?.kind === kind ? editingChecklist.name : "",
      setEditingName: (value: string) =>
        setEditingChecklist((current) =>
          current?.kind === kind ? { ...current, name: value } : current
        ),
      onCreate: () => handleChecklistCreate(kind),
      onToggle: (item: ChecklistItem) => handleChecklistToggle(kind, item),
      onDelete: (item: ChecklistItem) => handleChecklistDelete(kind, item),
      onClearDone: () => {
        handleChecklistClearDone(kind).catch(() => {});
      },
      onReorder: (item: ChecklistItem, direction: "up" | "down") =>
        handleChecklistReorder(kind, item, direction),
      onStartEdit: (item: ChecklistItem) => startChecklistEdit(kind, item),
      onSaveEdit: () => saveChecklistEdit(kind),
      onCancelEdit: cancelChecklistEdit,
    });
    return {
      features: {
        title: "Features",
        itemName: featureName,
        setItemName: setFeatureName,
        creating: creatingFeature,
        loading: featuresLoading,
        error: featuresError,
        items: features,
        ...base("features"),
      },
      todos: {
        title: "Todos",
        itemName: todoName,
        setItemName: setTodoName,
        creating: creatingTodo,
        loading: todosLoading,
        error: todosError,
        items: todos,
        ...base("todos"),
      },
      ideas: {
        title: "Ideas",
        itemName: ideaName,
        setItemName: setIdeaName,
        creating: creatingIdea,
        loading: ideasLoading,
        error: ideasError,
        items: ideas,
        ...base("ideas"),
        assistant: {
          title: "Idea Assistant",
          chatsById: ideaAssistantChatById,
          draftsById: ideaAssistantDraftById,
          loadingById: ideaAssistantLoadingById,
          expandedById: ideaAssistantExpandedById,
          onToggle: (itemId: string) =>
            setIdeaAssistantExpandedById((current) => ({
              ...current,
              [itemId]: !current[itemId],
            })),
          onDraftChange: (itemId: string, value: string) =>
            setIdeaAssistantDraftById((current) => ({ ...current, [itemId]: value })),
          onSend: (item: ChecklistItem) => {
            handleIdeaAssistantSend(item).catch(() => {});
          },
        },
      },
      bugs: {
        title: "Bugs",
        itemName: bugName,
        setItemName: setBugName,
        creating: creatingBug,
        loading: bugsLoading,
        error: bugsError,
        items: bugs,
        ...base("bugs"),
      },
      enhancements: {
        title: "Enhancements",
        itemName: enhancementName,
        setItemName: setEnhancementName,
        creating: creatingEnhancement,
        loading: enhancementsLoading,
        error: enhancementsError,
        items: enhancements,
        ...base("enhancements"),
      },
    };
  }, [
    bugName,
    bugs,
    bugsLoading,
    bugsError,
    cancelChecklistEdit,
    creatingBug,
    creatingEnhancement,
    creatingFeature,
    creatingIdea,
    creatingTodo,
    editingChecklist,
    enhancementName,
    enhancements,
    enhancementsLoading,
    enhancementsError,
    featureName,
    features,
    featuresLoading,
    featuresError,
    handleChecklistClearDone,
    handleChecklistCreate,
    handleChecklistDelete,
    handleChecklistReorder,
    handleChecklistToggle,
    handleIdeaAssistantSend,
    ideaAssistantChatById,
    ideaAssistantDraftById,
    ideaAssistantExpandedById,
    ideaAssistantLoadingById,
    ideaName,
    ideas,
    ideasLoading,
    ideasError,
    selectedProjectId,
    saveChecklistEdit,
    setEditingChecklist,
    startChecklistEdit,
    todoName,
    todos,
    todosLoading,
    todosError,
  ]);

  return {
    features,
    featuresLoading,
    featuresError,
    featureName,
    setFeatureName,
    creatingFeature,
    todos,
    todosLoading,
    todosError,
    todoName,
    setTodoName,
    creatingTodo,
    ideas,
    ideasLoading,
    ideasError,
    ideaName,
    setIdeaName,
    creatingIdea,
    ideaAssistantChatById,
    ideaAssistantDraftById,
    ideaAssistantExpandedById,
    ideaAssistantLoadingById,
    bugs,
    bugsLoading,
    bugsError,
    bugName,
    setBugName,
    creatingBug,
    enhancements,
    enhancementsLoading,
    enhancementsError,
    enhancementName,
    setEnhancementName,
    creatingEnhancement,
    clearingEnhancements,
    editingChecklist,
    loadFeatures,
    loadTodos,
    loadIdeas,
    loadBugs,
    loadEnhancements,
    handleChecklistCreate,
    handleChecklistToggle,
    handleChecklistDelete,
    handleChecklistReorder,
    handleChecklistClearDone,
    handleIdeaAssistantSend,
    startChecklistEdit,
    saveChecklistEdit,
    cancelChecklistEdit,
    clearEnhancements,
    clearEnhancementsForProject,
    clearChecklist,
    isChecklistTab,
    checklistSectionPropsByKind,
  };
}
