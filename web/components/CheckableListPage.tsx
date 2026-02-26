import React, { useCallback, useState } from "react";
import { CheckableList } from "./CheckableList";
import { CheckableListPageShell } from "./CheckableListPageShell";
import { isOptimisticId } from "../lib/utils";
import { useCheckableProjectList } from "../lib/useCheckableProjectList";
import { useProjectLayout } from "../lib/useProjectLayout";
import { useTheme } from "../pages/_app";
import {
  generateIdeaActionTodos,
  isAuthenticated,
} from "../lib/api";
import {
  CHECKABLE_LIST_PAGES,
  type CheckableListPageKey,
} from "../config/checkableListPages";
import { IconIdeas } from "./icons";

export function CheckableListPage({ pageKey }: { pageKey: CheckableListPageKey }) {
  const layout = useProjectLayout();
  const theme = useTheme();
  const def = CHECKABLE_LIST_PAGES[pageKey];
  const [addError, setAddError] = useState<string | null>(null);
  const [actionLoadingById, setActionLoadingById] = useState<Record<string, boolean>>(
    {}
  );
  const [actionChatById, setActionChatById] = useState<
    Record<string, { id: string; role: "user" | "assistant"; text: string }[]>
  >({});
  const [actionInputById, setActionInputById] = useState<Record<string, string>>(
    {}
  );
  const [actionGifById, setActionGifById] = useState<Record<string, string>>({});
  const [actionCollapsedById, setActionCollapsedById] = useState<
    Record<string, boolean>
  >({});
  const [pendingFocusIdeaId, setPendingFocusIdeaId] = useState<string | null>(null);
  const actionInputRefs = React.useRef<Record<string, HTMLTextAreaElement | null>>(
    {}
  );
  const actionThreadRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  React.useEffect(() => {
    if (!pendingFocusIdeaId) return;
    const input = actionInputRefs.current[pendingFocusIdeaId];
    if (!input) return;
    input.focus();
    const valueLength = input.value.length;
    input.setSelectionRange(valueLength, valueLength);
    setPendingFocusIdeaId(null);
  }, [pendingFocusIdeaId, actionLoadingById, actionChatById, actionGifById]);

  React.useEffect(() => {
    Object.values(actionThreadRefs.current).forEach((node) => {
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    });
  }, [actionChatById, actionLoadingById]);

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
  });

  const handleAddSubmit = useCallback(
    (e: React.FormEvent) => {
      if (def.showAddError) setAddError(null);
      list.addItem(e);
    },
    [def.showAddError, list.addItem]
  );

  const { theme: themeValue, toggleTheme } = theme;
  const isIdeasPage = pageKey === "ideas";

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
        .map((message) =>
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

  const appendAssistantMessage = useCallback(
    (ideaId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setActionChatById((prev) => ({
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

  const handleGenerateActionTodos = useCallback(
    async (ideaId: string, context?: string) => {
      setActionLoadingById((prev) => ({ ...prev, [ideaId]: true }));
      setActionGifById((prev) => {
        const next = { ...prev };
        delete next[ideaId];
        return next;
      });
      try {
        const result = await generateIdeaActionTodos(ideaId, context);
        setActionCollapsedById((prev) => ({ ...prev, [ideaId]: false }));
        appendAssistantMessage(ideaId, typeof result.message === "string" ? result.message : "");
        if (typeof result.previewGifUrl === "string" && result.previewGifUrl.trim()) {
          setActionGifById((prev) => ({ ...prev, [ideaId]: result.previewGifUrl! }));
        }
      } catch (err) {
        appendAssistantMessage(
          ideaId,
          err instanceof Error ? err.message : "Failed to create action items"
        );
      } finally {
        setActionLoadingById((prev) => ({ ...prev, [ideaId]: false }));
      }
    },
    [appendAssistantMessage]
  );

  const handleSendIdeaChat = useCallback(
    async (ideaId: string) => {
      const draft = actionInputById[ideaId]?.trim();
      if (!draft) return;
      if (actionLoadingById[ideaId]) return;

      const userMessage = {
        id: createChatMessageId(),
        role: "user" as const,
        text: draft,
      };
      const prior = actionChatById[ideaId] ?? [];
      const context = buildIdeaChatContext(prior, draft);

      setActionChatById((prev) => ({
        ...prev,
        [ideaId]: [...(prev[ideaId] ?? []), userMessage],
      }));
      setActionInputById((prev) => ({ ...prev, [ideaId]: "" }));

      await handleGenerateActionTodos(ideaId, context);
    },
    [
      actionChatById,
      actionInputById,
      actionLoadingById,
      buildIdeaChatContext,
      createChatMessageId,
      handleGenerateActionTodos,
    ]
  );

  const renderIdeaDetails = useCallback(
    (ideaId: string) => {
      if (!isIdeasPage) return null;
      const messages = actionChatById[ideaId] ?? [];
      const gifUrl = actionGifById[ideaId];
      const loading = Boolean(actionLoadingById[ideaId]);
      const inputValue = actionInputById[ideaId] ?? "";
      const isCollapsed = actionCollapsedById[ideaId] ?? true;
      if (isCollapsed) return null;
      return (
        <div className="idea-plan-card">
          <div className="idea-plan-card-head">
            <span className="idea-plan-card-badge">AI chat</span>
          </div>
          <div
            className="idea-chat-thread"
            ref={(node) => {
              actionThreadRefs.current[ideaId] = node;
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`idea-chat-message idea-chat-message--${message.role}`}
              >
                <p className="idea-plan-summary">{message.text}</p>
              </div>
            ))}
            {loading ? (
              <div className="idea-chat-message idea-chat-message--assistant">
                <p className="idea-plan-summary">Thinking...</p>
              </div>
            ) : null}
          </div>
          <div className="idea-chat-input-row">
            <textarea
              className="idea-chat-input"
              ref={(node) => {
                actionInputRefs.current[ideaId] = node;
              }}
              value={inputValue}
              onChange={(e) =>
                setActionInputById((prev) => ({
                  ...prev,
                  [ideaId]: e.target.value,
                }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendIdeaChat(ideaId);
                }
              }}
              placeholder="Ask AI a follow-up..."
              rows={1}
              aria-label="Ask AI a follow-up"
            />
            <button
              type="button"
              className="idea-chat-send-btn"
              onClick={() => void handleSendIdeaChat(ideaId)}
              disabled={loading || !inputValue.trim()}
            >
              Send
            </button>
          </div>
          {gifUrl ? (
            <img
              src={gifUrl}
              alt="AI generated action preview"
              className="idea-action-gif"
              loading="lazy"
            />
          ) : null}
        </div>
      );
    },
    [
      actionChatById,
      actionCollapsedById,
      actionGifById,
      actionInputById,
      actionLoadingById,
      handleSendIdeaChat,
      isIdeasPage,
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
      setActionChatById((prev) => pruneIdsFromRecord(prev, removedIds));
      setActionInputById((prev) => pruneIdsFromRecord(prev, removedIds));
      setActionCollapsedById((prev) => pruneIdsFromRecord(prev, removedIds));
      setActionGifById((prev) => pruneIdsFromRecord(prev, removedIds));
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
      canBulkDelete={canBulkDelete}
      onBulkDelete={handleBulkDelete}
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
        renderItemActions: isIdeasPage
          ? (item) => {
              if (item.done) return null;
              const loading = Boolean(actionLoadingById[item.id]);
              const hasChat =
                (actionChatById[item.id]?.length ?? 0) > 0 ||
                Boolean(actionGifById[item.id]);
              const isCollapsed = actionCollapsedById[item.id] ?? true;
              const hasChatSession = Object.prototype.hasOwnProperty.call(
                actionCollapsedById,
                item.id
              );
              return (
                <>
                  <button
                    type="button"
                    className={`idea-plan-generate-btn${!isCollapsed ? " is-active" : ""}${(hasChat || hasChatSession) && isCollapsed ? " is-dimmed" : ""}${loading ? " is-thinking" : ""}`}
                    onClick={() => {
                      const willOpen = isCollapsed;
                      setActionCollapsedById((prev) => ({
                        ...prev,
                        [item.id]: !isCollapsed,
                      }));
                      if (willOpen) {
                        setPendingFocusIdeaId(item.id);
                        if (!hasChat && !loading) {
                          void handleGenerateActionTodos(item.id);
                        }
                      }
                    }}
                    disabled={isOptimisticId(item.id)}
                    aria-label="AI Assistance"
                    title="AI Assistance"
                  >
                    <IconIdeas />
                  </button>
                </>
              );
            }
          : undefined,
        renderItemDetails: isIdeasPage
          ? (item) => renderIdeaDetails(item.id)
          : undefined,
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
