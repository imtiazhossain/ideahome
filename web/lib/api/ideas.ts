import { createAssistantApi, type ElevenLabsVoice } from "./assistant";
import {
  createCheckableApis,
  type Bug,
  type Enhancement,
  type Feature,
  type Idea,
  type IdeaAssistantChatResult,
  type IdeaPlan,
  type Todo,
} from "./checkable-entities";
import { getUserScopedStorageKey } from "./auth";
import { requestBlob, requestJson, requestVoid } from "./http";

export type {
  Todo,
  Idea,
  IdeaPlan,
  IdeaAssistantChatResult,
  Bug,
  Feature,
  Enhancement,
  ElevenLabsVoice,
};

const checkableApis = createCheckableApis({
  requestJson,
  requestVoid,
  getUserScopedStorageKey,
});
const { todoApi, ideaApi, bugApi, featureApi } = checkableApis;

export const fetchTodos = todoApi.fetch;
export const fetchTodoSearch = todoApi.search;
export const createTodo = todoApi.create;
export const updateTodo = todoApi.update;
export const deleteTodo = todoApi.remove;
export const reorderTodos = todoApi.reorder;

export const fetchIdeas = ideaApi.fetch;
export const fetchIdeaSearch = ideaApi.search;
export const createIdea = ideaApi.create;
export const updateIdea = ideaApi.update;
export const deleteIdea = ideaApi.remove;
export const reorderIdeas = ideaApi.reorder;

const assistantApi = createAssistantApi<Idea, IdeaAssistantChatResult>({
  requestJson,
  requestBlob,
});

export const generateIdeaPlan = assistantApi.generateIdeaPlan;
export const generateIdeaAssistantChat = assistantApi.generateIdeaAssistantChat;
export const generateListItemAssistantChat =
  assistantApi.generateListItemAssistantChat;
export const fetchOpenRouterModels = assistantApi.fetchOpenRouterModels;
export const fetchElevenLabsVoices = assistantApi.fetchElevenLabsVoices;
export const synthesizeIdeaChatSpeech = assistantApi.synthesizeIdeaChatSpeech;

export const fetchBugs = bugApi.fetch;
export const fetchBugSearch = bugApi.search;
export const createBug = bugApi.create;
export const updateBug = bugApi.update;
export const deleteBug = bugApi.remove;
export const reorderBugs = bugApi.reorder;

export const fetchFeatures = featureApi.fetch;
export const fetchFeatureSearch = featureApi.search;
export const createFeature = featureApi.create;
export const updateFeature = featureApi.update;
export const deleteFeature = featureApi.remove;
export const reorderFeatures = featureApi.reorder;

export const fetchEnhancements = checkableApis.fetchEnhancements;
export const createEnhancement = checkableApis.createEnhancement;
export const updateEnhancement = checkableApis.updateEnhancement;
export const deleteEnhancement = checkableApis.deleteEnhancement;
export const reorderEnhancements = checkableApis.reorderEnhancements;
