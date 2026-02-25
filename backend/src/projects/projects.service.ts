import { Injectable, NotFoundException } from "@nestjs/common";
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

  async create(userId: string, data: { name: string }) {
    const organizationId = await this.getOrgIdForUser(userId);
    return this.prisma.project.create({
      data: { name: data.name, organizationId },
    });
  }

  async update(id: string, userId: string, data: { name?: string }) {
    await this.get(id, userId);
    return this.prisma.project.update({ where: { id }, data });
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
