import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  /** Resolves the user's organization id, ensuring one exists (creates "My Workspace" if missing). */
  private async getOrgIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) throw new NotFoundException("User not found");
    if (user.organizationId) return user.organizationId;
    const withOrg = await this.authService.ensureUserOrganization(userId);
    return withOrg.organizationId!;
  }

  private sanitizeName(name: unknown, entity: string): string {
    if (typeof name !== "string") {
      throw new BadRequestException(`${entity} name is required`);
    }
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException(`${entity} name is required`);
    if (trimmed.length > 120) {
      throw new BadRequestException(
        `${entity} name must be 120 characters or fewer`
      );
    }
    return trimmed;
  }

  async list(userId: string) {
    const organizationId = await this.getOrgIdForUser(userId);
    return this.prisma.project.findMany({
      where: { organizationId },
    });
  }

  async get(id: string, userId: string) {
    const organizationId = await this.getOrgIdForUser(userId);
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    if (project.organizationId !== organizationId) {
      throw new NotFoundException("Project not found");
    }
    return project;
  }

  async create(userId: string, data: { name: unknown }) {
    const organizationId = await this.getOrgIdForUser(userId);
    const name = this.sanitizeName(data.name, "Project");
    return this.prisma.project.create({
      data: { name, organizationId },
    });
  }

  async update(id: string, userId: string, data: { name?: unknown }) {
    await this.get(id, userId);
    const payload: { name?: string } = {};
    if (data.name !== undefined) {
      payload.name = this.sanitizeName(data.name, "Project");
    }
    return this.prisma.project.update({ where: { id }, data: payload });
  }

  async delete(id: string, userId: string) {
    await this.get(id, userId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.commentAttachment.deleteMany({
          where: { comment: { issue: { projectId: id } } },
        });
        await tx.issueCommentEdit.deleteMany({
          where: { comment: { issue: { projectId: id } } },
        });
        await tx.issueComment.deleteMany({
          where: { issue: { projectId: id } },
        });
        await tx.issueRecording.deleteMany({
          where: { issue: { projectId: id } },
        });
        await tx.issueScreenshot.deleteMany({
          where: { issue: { projectId: id } },
        });
        await tx.issueFile.deleteMany({ where: { issue: { projectId: id } } });
        await tx.issue.deleteMany({ where: { projectId: id } });
        await tx.todo.deleteMany({ where: { projectId: id } });
        await tx.idea.deleteMany({ where: { projectId: id } });
        await tx.bug.deleteMany({ where: { projectId: id } });
        await tx.feature.deleteMany({ where: { projectId: id } });
        await tx.expense.deleteMany({ where: { projectId: id } });
        return tx.project.delete({ where: { id } });
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundException("Project not found");
      }
      throw e;
    }
  }
}
