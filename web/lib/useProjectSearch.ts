import { useEffect, useState } from "react";
import {
  fetchBugSearch,
  fetchFeatureSearch,
  fetchIdeaSearch,
  fetchIssueSearch,
  fetchTodoSearch,
} from "./api/search";
import type { Bug, Feature, Idea, Todo } from "./api/checklists";
import type { Issue } from "./api/issues";

const PROJECT_SEARCH_DEBOUNCE_MS = 250;
const PROJECT_SEARCH_MAX_ISSUES = 8;
const PROJECT_SEARCH_MAX_PER_LIST = 4;

export type ProjectSearchResult =
  | { type: "issue"; id: string; title: string; status?: string }
  | {
      type: "list";
      id: string;
      name: string;
      page: string;
      pageLabel: string;
      projectId: string;
    };

export function useProjectSearch(projectId: string | undefined, query: string) {
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const q = query.trim();
    const t = setTimeout(() => {
      const fetches = [
        fetchIssueSearch(projectId, q),
        fetchTodoSearch(projectId, q),
        fetchIdeaSearch(projectId, q),
        fetchBugSearch(projectId, q),
        fetchFeatureSearch(projectId, q),
      ];
      Promise.allSettled(fetches)
        .then((settled) => {
          const [issuesRes, todosRes, ideasRes, bugsRes, featuresRes] = settled;
          const issues = (
            issuesRes.status === "fulfilled" ? issuesRes.value : []
          ) as Issue[];
          const todos = (
            todosRes.status === "fulfilled" ? todosRes.value : []
          ) as Todo[];
          const ideas = (
            ideasRes.status === "fulfilled" ? ideasRes.value : []
          ) as Idea[];
          const bugs = (
            bugsRes.status === "fulfilled" ? bugsRes.value : []
          ) as Bug[];
          const features = (
            featuresRes.status === "fulfilled" ? featuresRes.value : []
          ) as Feature[];
          if (
            issuesRes.status === "rejected" ||
            todosRes.status === "rejected" ||
            ideasRes.status === "rejected" ||
            bugsRes.status === "rejected" ||
            featuresRes.status === "rejected"
          ) {
            console.warn(
              "[useProjectSearch] Search partial failure:",
              [
                issuesRes.status === "rejected" && "issues",
                todosRes.status === "rejected" && "todos",
                ideasRes.status === "rejected" && "ideas",
                bugsRes.status === "rejected" && "bugs",
                featuresRes.status === "rejected" && "features",
              ]
                .filter(Boolean)
                .join(", ")
            );
          }
          const next: ProjectSearchResult[] = [];
          issues.slice(0, PROJECT_SEARCH_MAX_ISSUES).forEach((i: Issue) => {
            next.push({
              type: "issue",
              id: i.id,
              title: i.title,
              status: i.status ?? undefined,
            });
          });
          todos.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Todo) => {
            next.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/todo",
              pageLabel: "To-Do",
              projectId: item.projectId,
            });
          });
          ideas.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Idea) => {
            next.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/ideas",
              pageLabel: "Ideas",
              projectId: item.projectId,
            });
          });
          bugs.slice(0, PROJECT_SEARCH_MAX_PER_LIST).forEach((item: Bug) => {
            next.push({
              type: "list",
              id: item.id,
              name: item.name,
              page: "/bugs",
              pageLabel: "Bugs",
              projectId: item.projectId,
            });
          });
          features
            .slice(0, PROJECT_SEARCH_MAX_PER_LIST)
            .forEach((item: Feature) => {
              next.push({
                type: "list",
                id: item.id,
                name: item.name,
                page: "/features",
                pageLabel: "Features",
                projectId: item.projectId,
              });
            });
          setResults(next);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, PROJECT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [projectId, query]);

  return { results, setResults, loading };
}
