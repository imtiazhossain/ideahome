import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  QUALITY_SCORE_ITEM_IDS,
  computeQualityScorePercent,
  createDefaultQualityScoreConfig,
  isProjectQualityScoreConfig,
  type ProjectQualityScoreConfig,
} from "@ideahome/shared-config";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { verifyProjectForUser } from "../common/org-scope";
import { EmailService, InviteEmailDeliveryError } from "../email/email.service";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService
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

  private sanitizeInviteId(inviteId: unknown): string {
    if (typeof inviteId !== "string" || !inviteId.trim()) {
      throw new BadRequestException("inviteId is required");
    }
    return inviteId.trim();
  }

  private sanitizeEmail(email: unknown): string {
    if (typeof email !== "string" || !email.trim()) {
      throw new BadRequestException("email is required");
    }
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException("email must be a valid email address");
    }
    return normalized;
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

  async update(
    id: string,
    userId: string,
    data: { name?: unknown; qualityScoreConfig?: unknown }
  ) {
    await this.get(id, userId);
    const payload: {
      name?: string;
      qualityScoreConfig?: ProjectQualityScoreConfig;
    } = {};
    if (data.name !== undefined) {
      payload.name = this.sanitizeName(data.name, "Project");
    }
    const qualityScoreConfig = this.normalizeQualityScoreConfig(
      data.qualityScoreConfig
    );
    if (qualityScoreConfig !== undefined) {
      payload.qualityScoreConfig = qualityScoreConfig;
    }
    if (qualityScoreConfig === undefined) {
      return this.prisma.project.update({ where: { id }, data: payload });
    }
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({ where: { id }, data: payload });
      const issues = await tx.issue.findMany({
        where: { projectId: id },
        select: {
          id: true,
          title: true,
          description: true,
          acceptanceCriteria: true,
          database: true,
          api: true,
          testCases: true,
          automatedTest: true,
          assigneeId: true,
          _count: {
            select: {
              comments: true,
              screenshots: true,
              recordings: true,
              files: true,
            },
          },
        },
      });
      await Promise.all(
        issues.map((issue) =>
          tx.issue.update({
            where: { id: issue.id },
            data: {
              qualityScore: computeQualityScorePercent(
                issue as Record<string, unknown>,
                qualityScoreConfig
              ),
            },
          })
        )
      );
      return project;
    });
  }

  private normalizeQualityScoreConfig(
    value: unknown
  ): ProjectQualityScoreConfig | undefined {
    if (value === undefined) return undefined;
    if (value === null) return createDefaultQualityScoreConfig();
    if (typeof value !== "object" || Array.isArray(value) || value === null) {
      throw new BadRequestException("qualityScoreConfig must be an object");
    }
    const raw = value as {
      version?: unknown;
      weights?: Record<string, unknown>;
    };
    if (raw.version !== undefined && raw.version !== 1) {
      throw new BadRequestException("qualityScoreConfig.version must be 1");
    }
    if (
      raw.weights !== undefined &&
      (typeof raw.weights !== "object" ||
        raw.weights === null ||
        Array.isArray(raw.weights))
    ) {
      throw new BadRequestException(
        "qualityScoreConfig.weights must be an object"
      );
    }
    const providedWeights = raw.weights ?? {};
    const validItemIds = new Set<string>(QUALITY_SCORE_ITEM_IDS);
    const unknownKeys = Object.keys(providedWeights).filter(
      (key) => !validItemIds.has(key)
    );
    if (unknownKeys.length) {
      throw new BadRequestException(
        `Unknown qualityScoreConfig weight keys: ${unknownKeys.join(", ")}`
      );
    }
    const weights = Object.fromEntries(
      QUALITY_SCORE_ITEM_IDS.map((itemId) => {
        const rawValue = providedWeights[itemId];
        if (rawValue === undefined) return [itemId, 0];
        if (
          typeof rawValue !== "number" ||
          !Number.isInteger(rawValue) ||
          rawValue < 0 ||
          rawValue > 100
        ) {
          throw new BadRequestException(
            `qualityScoreConfig.weights.${itemId} must be an integer between 0 and 100`
          );
        }
        return [itemId, rawValue];
      })
    ) as ProjectQualityScoreConfig["weights"];
    const config: ProjectQualityScoreConfig = { version: 1, weights };
    if (!isProjectQualityScoreConfig(config)) {
      throw new BadRequestException("qualityScoreConfig total must equal 100");
    }
    return config;
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

  async listInvites(projectId: string, userId: string) {
    await this.get(projectId, userId);
    return this.prisma.projectInvite.findMany({
      where: { projectId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        invitedByUserId: true,
      },
    });
  }

  async inviteMember(
    projectId: string,
    inviterUserId: string,
    body: { userId?: unknown }
  ) {
    const targetUserId = this.sanitizeUserId(body.userId);
    const project = await verifyProjectForUser(
      this.prisma,
      projectId,
      inviterUserId
    );

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

  async removeMember(
    projectId: string,
    requesterUserId: string,
    targetUserIdRaw: unknown
  ) {
    const targetUserId = this.sanitizeUserId(targetUserIdRaw);
    await this.get(projectId, requesterUserId);
    const existing = await this.prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      select: { role: true },
    });
    if (!existing) {
      return this.listMembers(projectId, requesterUserId);
    }
    if (existing.role === "OWNER") {
      const ownerCount = await this.prisma.projectMembership.count({
        where: { projectId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException("Project must have at least one owner");
      }
    }
    await this.prisma.projectMembership.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });
    return this.listMembers(projectId, requesterUserId);
  }

  async inviteByEmail(
    projectId: string,
    inviterUserId: string,
    body: { email?: unknown }
  ) {
    const email = this.sanitizeEmail(body.email);
    const project = await verifyProjectForUser(
      this.prisma,
      projectId,
      inviterUserId
    );
    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterUserId },
      select: { name: true, email: true },
    });
    const projectDetails = await this.prisma.project.findUnique({
      where: { id: project.id },
      select: { name: true },
    });
    if (!projectDetails) {
      throw new NotFoundException("Project not found");
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    await this.prisma.projectInvite.upsert({
      where: { projectId_email: { projectId, email } },
      create: {
        projectId,
        email,
        invitedByUserId: inviterUserId,
      },
      update: {
        invitedByUserId: inviterUserId,
      },
    });

    if (existingUser) {
      await this.authService.ensureOrganizationMembership(
        project.organizationId,
        existingUser.id,
        "MEMBER"
      );
      await this.prisma.projectMembership.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: existingUser.id,
          },
        },
        create: {
          projectId,
          userId: existingUser.id,
          role: "MEMBER",
          invitedByUserId: inviterUserId,
        },
        update: {
          invitedByUserId: inviterUserId,
        },
      });
      await this.prisma.projectInvite.update({
        where: { projectId_email: { projectId, email } },
        data: {
          acceptedByUserId: existingUser.id,
          acceptedAt: new Date(),
        },
      });
    }

    const inviterDisplayName =
      inviter?.name?.trim() || inviter?.email?.trim() || "A teammate";
    try {
      await this.emailService.sendProjectInviteEmail({
        to: email,
        inviterDisplayName,
        projectName: projectDetails.name,
        appUrl: this.emailService.resolveInviteAppUrl(),
      });
    } catch (error) {
      console.error("Failed to send project invite email", {
        projectId,
        inviteEmail: email,
        inviterUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof InviteEmailDeliveryError) {
        throw new ServiceUnavailableException("Failed to send invite email");
      }
      throw error;
    }

    return this.listInvites(projectId, inviterUserId);
  }

  async revokeInvite(
    projectId: string,
    requesterUserId: string,
    inviteIdRaw: unknown
  ) {
    const inviteId = this.sanitizeInviteId(inviteIdRaw);
    await this.get(projectId, requesterUserId);
    await this.prisma.projectInvite.deleteMany({
      where: { id: inviteId, projectId, acceptedAt: null },
    });
    return this.listInvites(projectId, requesterUserId);
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
