import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ProjectScopedListService } from "../common/project-scoped-list.service";
import { PrismaService } from "../prisma.service";
import { IdeaPlanService } from "./idea-plan.service";

@Injectable()
export class IdeasService {
  private readonly listService: ProjectScopedListService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ideaPlanService: IdeaPlanService
  ) {
    this.listService = new ProjectScopedListService(prisma, "idea", "Idea");
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

  async reorder(projectId: string, userId: string, ideaIds: string[]) {
    return this.listService.reorder(projectId, userId, ideaIds);
  }

  async listOpenRouterModels(userEmail?: string) {
    return this.ideaPlanService.listAvailableModels(userEmail);
  }

  async searchWeb(query: string, limit?: number) {
    return this.ideaPlanService.searchWeb(query, limit);
  }

  async listElevenLabsVoices() {
    return this.ideaPlanService.listElevenLabsVoices();
  }

  async synthesizeElevenLabsSpeech(text: string, voiceId?: string) {
    return this.ideaPlanService.synthesizeElevenLabsSpeech(text, voiceId);
  }

  async generatePlan(
    id: string,
    userId: string,
    context?: string,
    preferredModel?: string,
    requesterEmail?: string
  ) {
    const orgId = await this.getOrgIdForUser(userId);
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: { project: { select: { name: true, organizationId: true } } },
    });

    if (!idea || idea.project.organizationId !== orgId) {
      throw new NotFoundException("Idea not found");
    }

    const plan = await this.ideaPlanService.generatePlan({
      ideaName: idea.name,
      projectName: idea.project.name,
      context,
      preferredModel,
      requesterEmail,
    });

    return this.prisma.idea.update({
      where: { id },
      data: {
        planJson: plan as Prisma.InputJsonValue,
        planGeneratedAt: new Date(),
      },
    });
  }

  async generateAssistantChat(
    id: string,
    userId: string,
    context?: string,
    preferredModel?: string,
    requesterEmail?: string,
    includeWeb?: boolean
  ) {
    const orgId = await this.getOrgIdForUser(userId);
    const idea = await this.prisma.idea.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, organizationId: true } },
      },
    });

    if (!idea || idea.project.organizationId !== orgId) {
      throw new NotFoundException("Idea not found");
    }

    const action = await this.ideaPlanService.generateActionResponse({
      ideaName: idea.name,
      projectName: idea.project.name,
      context,
      preferredModel,
      requesterEmail,
      includeWeb,
    });
    const previewGifUrl = this.resolvePreviewGifUrl(idea.name, context);

    return {
      ideaId: id,
      createdCount: 0,
      todos: [],
      previewGifUrl,
      message: action.message,
    };
  }

  async generateListAssistantChat(
    projectId: string,
    userId: string,
    itemName: string,
    context?: string,
    preferredModel?: string,
    requesterEmail?: string,
    includeWeb?: boolean
  ) {
    if (!projectId) {
      throw new BadRequestException("Project is required");
    }
    if (!itemName.trim()) {
      throw new BadRequestException("Item name is required");
    }
    const orgId = await this.getOrgIdForUser(userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, organizationId: true },
    });

    if (!project || project.organizationId !== orgId) {
      throw new NotFoundException("Project not found");
    }

    const action = await this.ideaPlanService.generateActionResponse({
      ideaName: itemName,
      projectName: project.name,
      context,
      preferredModel,
      requesterEmail,
      includeWeb,
    });
    const previewGifUrl = this.resolvePreviewGifUrl(itemName, context);

    return {
      ideaId: `list-item:${projectId}`,
      createdCount: 0,
      todos: [],
      previewGifUrl,
      message: action.message,
    };
  }

  private resolvePreviewGifUrl(
    ideaName: string,
    context?: string
  ): string | null {
    const text = `${ideaName} ${context ?? ""}`.toLowerCase();
    const requestsGif = text.includes("gif");
    const requestsCat = text.includes("cat");
    const requestsDancing = text.includes("dance") || text.includes("dancing");
    if (requestsGif && requestsCat && requestsDancing) {
      return "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif";
    }
    if (requestsGif && requestsCat) {
      return "https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif";
    }
    return null;
  }

  private async getOrgIdForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    return user?.organizationId ?? "";
  }
}
