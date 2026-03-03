import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { verifyProjectForUser } from "../common/org-scope";
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
    if (user.organizationId) {
      await this.authService.ensureOrganizationMembership(
        user.organizationId,
        userId,
        "MEMBER"
      );
      return user.organizationId;
    }
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

  private sanitizeUserId(userId: unknown): string {
    if (typeof userId !== "string" || !userId.trim()) {
      throw new BadRequestException("userId is required");
    }
    return userId.trim();
  }

  async list(userId: string) {
    return this.prisma.project.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async get(id: string, userId: string) {
    await verifyProjectForUser(this.prisma, id, userId);
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async create(userId: string, data: { name: unknown }) {
    const organizationId = await this.getOrgIdForUser(userId);
    const name = this.sanitizeName(data.name, "Project");
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { name, organizationId },
      });
      await tx.projectMembership.create({
        data: {
          projectId: project.id,
          userId,
          role: "OWNER",
          invitedByUserId: userId,
        },
      });
      return project;
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

  async listMembers(projectId: string, userId: string) {
    await this.get(projectId, userId);
    return this.prisma.projectMembership.findMany({
      where: { projectId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async inviteMember(
    projectId: string,
    inviterUserId: string,
    body: { userId?: unknown }
  ) {
    const targetUserId = this.sanitizeUserId(body.userId);
    const project = await verifyProjectForUser(this.prisma, projectId, inviterUserId);

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetUserId,
        OR: [
          { organizationId: project.organizationId },
          {
            organizationMemberships: {
              some: { organizationId: project.organizationId },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!targetUser) {
      throw new BadRequestException(
        "User must be a member of the project's organization"
      );
    }

    await this.prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      create: {
        projectId,
        userId: targetUserId,
        role: "MEMBER",
        invitedByUserId: inviterUserId,
      },
      update: {
        invitedByUserId: inviterUserId,
      },
    });

    return this.listMembers(projectId, inviterUserId);
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
        await tx.taxDocument.deleteMany({ where: { projectId: id } });
        await tx.projectMembership.deleteMany({ where: { projectId: id } });
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
