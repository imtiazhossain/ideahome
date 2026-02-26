import { Injectable } from "@nestjs/common";
import { ProjectScopedListService } from "../common/project-scoped-list.service";
import { PrismaService } from "../prisma.service";

@Injectable()
export class TodosService {
  private readonly listService: ProjectScopedListService;

  constructor(private readonly prisma: PrismaService) {
    this.listService = new ProjectScopedListService(prisma, "todo", "Todo");
  }

  async list(projectId: string, userId: string, search?: string) {
    return this.listService.list(projectId, userId, search);
  }

  async create(
    userId: string,
    body: { projectId?: unknown; name?: unknown; done?: unknown }
  ) {
    return this.listService.create(userId, body);
  }

  async update(
    id: string,
    userId: string,
    body: { name?: unknown; done?: unknown; order?: unknown }
  ) {
    return this.listService.update(id, userId, body);
  }

  async remove(id: string, userId: string) {
    return this.listService.remove(id, userId);
  }

  async reorder(projectId: string, userId: string, todoIds: string[]) {
    return this.listService.reorder(projectId, userId, todoIds);
  }
}
