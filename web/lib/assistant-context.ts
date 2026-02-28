/**
 * Re-export shared assistant context so web and app use one implementation.
 * Change once in @ideahome/shared-assistant, apply everywhere.
 */
export {
  buildIdeaChatContext,
  shouldUseWebSearch,
  formatProjectListsAsContext,
  combineAssistantContext,
  type AssistantTurn,
  type ProjectListsForContext,
} from "@ideahome/shared-assistant";
