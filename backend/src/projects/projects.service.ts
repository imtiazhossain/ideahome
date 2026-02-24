import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId?: string) {
    return this.prisma.project.findMany({
      where: orgId ? { organizationId: orgId } : undefined,
    });
  }

  async get(id: string) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }

  async create(data: { name: string; organizationId: string }) {
    return this.prisma.project.create({ data });
  }

  async update(id: string, data: { name?: string }) {
    return this.prisma.project.update({ where: { id }, data });
  }

  async delete(id: string) {
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
