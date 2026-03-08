import {
  pathProjectMyPromptUsage,
  pathProjectMyPromptUsageClear,
  pathProjectPromptUsageTrend,
  pathOrganizations,
  pathOrganizationsEnsure,
  pathProjectById,
  pathProjectInvites,
  pathProjectMembers,
  pathProjects,
} from "@ideahome/shared";
import type {
  CreateProjectInput,
  Organization as SharedOrganization,
  PromptUsageDetailEntry,
  PromptUsageSource,
  PromptUsageTrendPoint,
  PromptUsageMineResponse,
  PromptUsageTrendResponse,
  Project as SharedProject,
  UpdateProjectInput,
  User as SharedUser,
} from "@ideahome/shared";
import { apiFetch, requestJson, requestVoid, readResponseMessage } from "./http";

export type User = SharedUser;
export type Organization = SharedOrganization;
export type Project = SharedProject;

export type ProjectMember = {
  userId: string;
  role: string;
  createdAt: string;
  user: User;
};

export type ProjectInvite = {
  id: string;
  email: string;
  createdAt: string;
  invitedByUserId: string | null;
};

export type ProjectCodeRepository = {
  id: string;
  projectId: string;
  provider: string;
  repoFullName: string;
  defaultBranch: string | null;
  createdAt: string;
};

export type ProjectCodeAnalysisRun = {
  id: string;
  codeRepositoryId: string;
  payload: unknown;
  createdAt: string;
};

export type CodexPromptUsageResponse = {
  entries: PromptUsageDetailEntry[];
  points: PromptUsageTrendPoint[];
  importedSessions: number;
};

export type PromptOptimizationResponse = {
  structuredPrompt?: string;
  optimizedPrompt: string;
  notes: string[];
  tokenUsage:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | null;
  source: PromptUsageSource;
};

export async function fetchProjectPromptUsageTrend(
  projectId: string,
  source: "all" | PromptUsageSource = "all"
): Promise<PromptUsageTrendResponse> {
  const normalizedSource = source === "codex-estimated" ? "all" : source;
  const path = `${pathProjectPromptUsageTrend(projectId)}?source=${encodeURIComponent(normalizedSource)}`;
  return requestJson<PromptUsageTrendResponse>(path, {
    errorMessage: "Failed to load prompt usage trend",
  });
}

export async function fetchMyPromptUsage(
  projectId: string,
  source: "all" | PromptUsageSource = "all"
): Promise<PromptUsageMineResponse> {
  const normalizedSource = source === "codex-estimated" ? "all" : source;
  const path = `${pathProjectMyPromptUsage(projectId)}?source=${encodeURIComponent(normalizedSource)}`;
  return requestJson<PromptUsageMineResponse>(path, {
    errorMessage: "Failed to load your prompt usage",
  });
}

export async function clearMyPromptUsage(projectId: string): Promise<void> {
  return requestVoid(pathProjectMyPromptUsageClear(projectId), {
    method: "DELETE",
    errorMessage: "Failed to clear your prompt history",
  });
}

export async function fetchCodexPromptUsage(): Promise<CodexPromptUsageResponse> {
  const response = await apiFetch("/api/codex-prompt-usage", {
    method: "GET",
  });
  if (!response.ok) {
    const message =
      (await readResponseMessage(response)) ?? "Failed to load Codex prompt usage";
    throw new Error(message);
  }
  return response.json();
}

export async function optimizeProjectPrompt(
  projectId: string,
  prompt: string
): Promise<PromptOptimizationResponse> {
  return requestJson<PromptOptimizationResponse>(
    `/code/projects/${encodeURIComponent(projectId)}/prompt-optimize`,
    {
      method: "POST",
      body: { prompt },
      errorMessage: "Failed to optimize prompt",
    }
  );
}

export async function fetchProjectCodeRepositories(
  projectId: string
): Promise<ProjectCodeRepository[]> {
  return requestJson<ProjectCodeRepository[]>(
    `/code/projects/${encodeURIComponent(projectId)}/repositories`,
    {
      errorMessage: "Failed to load project repositories",
    }
  );
}

export async function createGithubRepositoryForProject(
  projectId: string,
  body: { repoFullName: string; defaultBranch?: string }
): Promise<ProjectCodeRepository> {
  return requestJson<ProjectCodeRepository>(
    `/code/projects/${encodeURIComponent(projectId)}/repositories/github`,
    {
      method: "POST",
      body,
      errorMessage: "Failed to connect repository",
    }
  );
}

export async function fetchOrganizations(): Promise<Organization[]> {
  return requestJson<Organization[]>(pathOrganizations(), {
    errorMessage: "Failed to fetch organizations",
  });
}

export async function createOrganization(body: {
  name: string;
}): Promise<Organization> {
  return requestJson<Organization>(pathOrganizations(), {
    method: "POST",
    body,
    errorMessage: "Failed to create organization",
  });
}

export async function ensureOrganization(): Promise<Organization> {
  return requestJson<Organization>(pathOrganizationsEnsure(), {
    method: "POST",
    errorMessage: "Failed to ensure organization",
  });
}

export async function fetchProjects(): Promise<Project[]> {
  return requestJson<Project[]>(pathProjects(), {
    errorMessage: "Failed to fetch projects",
  });
}

export async function createProject(
  body: CreateProjectInput
): Promise<Project> {
  return requestJson<Project>(pathProjects(), {
    method: "POST",
    body,
    errorMessage: "Failed to create project",
  });
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<Project> {
  return requestJson<Project>(pathProjectById(id), {
    method: "PUT",
    body: data,
    errorMessage: "Failed to update project",
  });
}

export async function deleteProject(id: string): Promise<void> {
  return requestVoid(pathProjectById(id), {
    method: "DELETE",
    errorMessage: "Failed to delete project",
  });
}

export async function fetchProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(pathProjectMembers(projectId), {
    errorMessage: "Failed to fetch project members",
  });
}

export async function inviteProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(pathProjectMembers(projectId), {
    method: "POST",
    body: { userId },
    errorMessage: "Failed to invite project member",
  });
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ProjectMember[]> {
  return requestJson<ProjectMember[]>(
    `${pathProjectMembers(projectId)}/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to remove project member",
    }
  );
}

export async function fetchProjectInvites(
  projectId: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(pathProjectInvites(projectId), {
    errorMessage: "Failed to fetch project invites",
  });
}

export async function inviteProjectByEmail(
  projectId: string,
  email: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(pathProjectInvites(projectId), {
    method: "POST",
    body: { email },
    errorMessage: "Failed to send project invite",
  });
}

export async function revokeProjectInvite(
  projectId: string,
  inviteId: string
): Promise<ProjectInvite[]> {
  return requestJson<ProjectInvite[]>(
    `${pathProjectInvites(projectId)}/${encodeURIComponent(inviteId)}`,
    {
      method: "DELETE",
      errorMessage: "Failed to revoke project invite",
    }
  );
}
