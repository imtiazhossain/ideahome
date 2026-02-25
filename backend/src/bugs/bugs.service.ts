import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class BugsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrgIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      throw new ForbiddenException(
        "User has no organization. Complete login again to create one."
      );
    }
    return user.organizationId;
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    const orgId = await this.getOrgIdForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.organizationId !== orgId) {
      throw new NotFoundException("Project not found");
    }
  }

  async list(projectId: string, userId: string, search?: string) {
    await this.verifyProjectAccess(projectId, userId);
    const where: { projectId: string; name?: { contains: string; mode: "insensitive" } } = {
      projectId,
    };
    if (search?.trim()) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }
    return this.prisma.bug.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(
    userId: string,
    body: { projectId: string; name: string; done?: boolean }
  ) {
    await this.verifyProjectAccess(body.projectId, userId);
    const agg = await this.prisma.bug.aggregate({
      where: { projectId: body.projectId },
      _max: { order: true },
    });
    const maxOrder = agg._max.order ?? -1;
    return this.prisma.bug.create({
      data: {
        projectId: body.projectId,
        name: body.name.trim(),
        done: Boolean(body.done),
        order: maxOrder + 1,
      },
    });
  }

  private async verifyBugAccess(bugId: string, userId: string) {
    const orgId = await this.getOrgIdForUser(userId);
    const bug = await this.prisma.bug.findUnique({
      where: { id: bugId },
      include: { project: true },
    });
    if (!bug || bug.project.organizationId !== orgId) {
      throw new NotFoundException("Bug not found");
    }
    return bug;
  }

  async update(
    id: string,
    userId: string,
    body: { name?: string; done?: boolean; order?: number }
  ) {
    await this.verifyBugAccess(id, userId);
    const data: { name?: string; done?: boolean; order?: number } = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.done !== undefined) data.done = body.done;
    if (body.order !== undefined) data.order = body.order;
    return this.prisma.bug.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.verifyBugAccess(id, userId);
    return this.prisma.bug.delete({ where: { id } });
  }

  async reorder(projectId: string, userId: string, bugIds: string[]) {
    await this.verifyProjectAccess(projectId, userId);
    const updates = bugIds.map((id, index) =>
      this.prisma.bug.update({
        where: { id },
        data: { order: index },
      })
    );
    await this.prisma.$transaction(updates);
    return this.list(projectId, userId);
  }
}
