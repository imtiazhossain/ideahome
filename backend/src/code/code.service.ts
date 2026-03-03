import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";

@Injectable()
export class CodeService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProjectAccess(projectId: string, userId: string) {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  private sanitizeRepoFullName(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("Repository full name is required");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException("Repository full name is required");
    }
    if (!trimmed.includes("/")) {
      throw new BadRequestException(
        "Repository full name must be in the form owner/name"
      );
    }
    if (trimmed.length > 200) {
      throw new BadRequestException(
        "Repository full name must be 200 characters or fewer"
      );
    }
    return trimmed;
  }

  async listRepositoriesForProject(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);
    return this.prisma.codeRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createGithubRepositoryForProject(
    projectId: string,
    userId: string,
    data: { repoFullName: unknown; defaultBranch?: unknown }
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repoFullName = this.sanitizeRepoFullName(data.repoFullName);
    let defaultBranch: string | undefined;
    if (typeof data.defaultBranch === "string") {
      const trimmed = data.defaultBranch.trim();
      if (trimmed.length > 0) {
        if (trimmed.length > 200) {
          throw new BadRequestException(
            "Default branch must be 200 characters or fewer"
          );
        }
        defaultBranch = trimmed;
      }
    }
    return this.prisma.codeRepository.create({
      data: {
        projectId,
        provider: "github",
        repoFullName,
        defaultBranch,
      },
    });
  }

  async getLatestAnalysisRun(
    projectId: string,
    userId: string,
    codeRepositoryId: string
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repo = await this.prisma.codeRepository.findFirst({
      where: { id: codeRepositoryId, projectId },
    });
    if (!repo) {
      throw new NotFoundException("Code repository not found");
    }
    return this.prisma.codeAnalysisRun.findFirst({
      where: { codeRepositoryId },
      orderBy: { createdAt: "desc" },
    });
  }

  async saveAnalysisRun(
    projectId: string,
    userId: string,
    codeRepositoryId: string,
    payload: unknown
  ) {
    await this.ensureProjectAccess(projectId, userId);
    const repo = await this.prisma.codeRepository.findFirst({
      where: { id: codeRepositoryId, projectId },
    });
    if (!repo) {
      throw new NotFoundException("Code repository not found");
    }
    return this.prisma.codeAnalysisRun.create({
      data: {
        codeRepositoryId,
        payload: payload as any,
      },
    });
  }
}
