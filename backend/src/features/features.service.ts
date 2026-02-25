import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class FeaturesService {
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
    return this.prisma.feature.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(
    userId: string,
    body: { projectId: string; name: string; done?: boolean }
  ) {
    await this.verifyProjectAccess(body.projectId, userId);
    const maxOrder = await this.prisma.feature
      .aggregate({
        where: { projectId: body.projectId },
        _max: { order: true },
      })
      .then((r) => r._max.order ?? -1);
    return this.prisma.feature.create({
      data: {
        projectId: body.projectId,
        name: body.name.trim(),
        done: Boolean(body.done),
        order: maxOrder + 1,
      },
    });
  }

  private async verifyFeatureAccess(featureId: string, userId: string) {
    const orgId = await this.getOrgIdForUser(userId);
    const feature = await this.prisma.feature.findUnique({
      where: { id: featureId },
      include: { project: true },
    });
    if (!feature || feature.project.organizationId !== orgId) {
      throw new NotFoundException("Feature not found");
    }
    return feature;
  }

  async update(
    id: string,
    userId: string,
    body: { name?: string; done?: boolean; order?: number }
  ) {
    await this.verifyFeatureAccess(id, userId);
    const data: { name?: string; done?: boolean; order?: number } = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.done !== undefined) data.done = body.done;
    if (body.order !== undefined) data.order = body.order;
    return this.prisma.feature.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.verifyFeatureAccess(id, userId);
    return this.prisma.feature.delete({ where: { id } });
  }

  async reorder(projectId: string, userId: string, featureIds: string[]) {
    await this.verifyProjectAccess(projectId, userId);
    const updates = featureIds.map((id, index) =>
      this.prisma.feature.update({
        where: { id },
        data: { order: index },
      })
    );
    await this.prisma.$transaction(updates);
    return this.list(projectId, userId);
  }
}
