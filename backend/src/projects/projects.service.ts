import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma.service";

const DEFAULT_PROJECT_NAMES = ["Work", "Life"] as const;

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
      throw new BadRequestException(`${entity} name must be 120 characters or fewer`);
    }
    return trimmed;
  }

  private async ensureDefaultProjectsForOrganization(
    organizationId: string
  ): Promise<void> {
    const existing = await this.prisma.project.findMany({
      where: { organizationId },
      select: { name: true },
    });
    const existingLower = new Set(
      existing.map((project) => project.name.trim().toLowerCase())
    );
    const missing = DEFAULT_PROJECT_NAMES.filter(
      (name) => !existingLower.has(name.toLowerCase())
    );
    if (missing.length === 0) return;
    await this.prisma.project.createMany({
      data: missing.map((name) => ({ name, organizationId })),
    });
  }

  async list(userId: string) {
    const organizationId = await this.getOrgIdForUser(userId);
    await this.ensureDefaultProjectsForOrganization(organizationId);
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
      return await this.prisma.project.delete({ where: { id } });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundException("Project not found");
      }
      throw e;
    }
  }
}
