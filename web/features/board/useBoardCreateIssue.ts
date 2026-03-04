import { useCallback, useEffect, useState } from "react";
import { createIssue } from "../../lib/api/issues";
import { fetchUsers, type User } from "../../lib/api/users";
import { computeQualityScore } from "./scoring";
import type { Project } from "../../lib/api/projects";
import type { Issue } from "../../lib/api/issues";
import type { ProjectQualityScoreConfig } from "../../lib/api";

type UseBoardCreateIssueArgs = {
  selectedProjectId: string;
  projects: Project[];
  setIssues: React.Dispatch<React.SetStateAction<Issue[]>>;
  setSelectedProjectId: (id: string) => void;
  setError: (msg: string | null) => void;
  qualityScoreConfig?: ProjectQualityScoreConfig | null;
};

export function useBoardCreateIssue({
  selectedProjectId,
  projects,
  setIssues,
  setSelectedProjectId,
  setError,
  qualityScoreConfig,
}: UseBoardCreateIssueArgs) {
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createAcceptanceCriteria, setCreateAcceptanceCriteria] = useState("");
  const [createDatabase, setCreateDatabase] = useState("");
  const [createApi, setCreateApi] = useState("");
  const [createTestCases, setCreateTestCases] = useState("");
  const [createAssigneeId, setCreateAssigneeId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      setUsers([]);
    }
  }, []);

  const firstProjectId = projects[0]?.id ?? "";
  useEffect(() => {
    if (!createOpen) return;
    loadUsers();
    setCreateError(null);
    if (firstProjectId && !selectedProjectId) {
      setSelectedProjectId(firstProjectId);
    }
  }, [createOpen, loadUsers, firstProjectId, selectedProjectId, setSelectedProjectId]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreateError(null);
      if (!createTitle.trim()) {
        setCreateError("Please enter a title.");
        return;
      }
      if (!selectedProjectId) {
        setCreateError("Please select a project.");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const qualityScore = computeQualityScore({
          title: createTitle,
          description: createDescription,
          acceptanceCriteria: createAcceptanceCriteria,
          database: createDatabase,
          api: createApi,
          testCases: createTestCases,
          automatedTest: "",
          assigneeId: createAssigneeId || null,
          recordings: [],
          screenshots: [],
          files: [],
        }, qualityScoreConfig);
        const created = await createIssue({
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          acceptanceCriteria: createAcceptanceCriteria.trim() || undefined,
          database: createDatabase.trim() || undefined,
          api: createApi.trim() || undefined,
          testCases: createTestCases || undefined,
          projectId: selectedProjectId,
          assigneeId: createAssigneeId || undefined,
          qualityScore,
        });
        setIssues((prev) => [created, ...prev]);
        setCreateOpen(false);
        setCreateTitle("");
        setCreateDescription("");
        setCreateAcceptanceCriteria("");
        setCreateDatabase("");
        setCreateApi("");
        setCreateTestCases("");
        setCreateAssigneeId("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to create issue";
        setCreateError(msg);
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [
      createTitle,
      createDescription,
      createAcceptanceCriteria,
      createDatabase,
      createApi,
      createTestCases,
      createAssigneeId,
      qualityScoreConfig,
      selectedProjectId,
      setIssues,
      setError,
    ]
  );

  return {
    createOpen,
    setCreateOpen,
    createTitle,
    setCreateTitle,
    createDescription,
    setCreateDescription,
    createAcceptanceCriteria,
    setCreateAcceptanceCriteria,
    createDatabase,
    setCreateDatabase,
    createApi,
    setCreateApi,
    createTestCases,
    setCreateTestCases,
    createAssigneeId,
    setCreateAssigneeId,
    users,
    submitting,
    createError,
    setCreateError,
    handleCreate,
  };
}
