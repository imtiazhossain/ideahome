import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { verifyProjectForUser } from "./org-scope";
import { PrismaService } from "../prisma.service";

type ListEntityDelegate = {
  findMany: (args: unknown) => Prisma.PrismaPromise<unknown[]>;
  findUnique: (args: unknown) => Prisma.PrismaPromise<unknown>;
  create: (args: unknown) => Prisma.PrismaPromise<unknown>;
  update: (args: unknown) => Prisma.PrismaPromise<unknown>;
  delete: (args: unknown) => Prisma.PrismaPromise<unknown>;
  aggregate: (
    args: unknown
  ) => Prisma.PrismaPromise<{ _max: { order: number | null } }>;
};

type UpdateBody = { name?: unknown; done?: unknown; order?: unknown };
type CreateBody = { projectId?: unknown; name?: unknown; done?: unknown };

export class ProjectScopedListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelKey: "todo" | "idea" | "bug" | "feature",
    private readonly entityName: string
  ) {}

  private get delegate(): ListEntityDelegate {
    const delegate = (
      this.prisma as unknown as Record<string, ListEntityDelegate>
    )[this.modelKey];
    if (!delegate) {
      throw new InternalServerErrorException(
        `Unsupported list model key: ${this.modelKey}`
      );
    }
    return delegate;
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  private async verifyItemAccess(
    itemId: string,
    userId: string
  ): Promise<void> {
    const item = (await this.delegate.findUnique({
      where: { id: itemId },
      select: { projectId: true },
    })) as { projectId?: string } | null;
    if (!item?.projectId) {
      throw new NotFoundException(`${this.entityName} not found`);
    }
    await this.verifyProjectAccess(item.projectId, userId);
  }

  private normalizeName(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException(`${this.entityName} name is required`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${this.entityName} name is required`);
    }
    return trimmed;
  }

  private normalizeProjectId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return value.trim();
  }

  private normalizeOrder(value: unknown): number {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw new BadRequestException(
        `${this.entityName} order must be a non-negative integer`
      );
    }
    return value;
  }

  private normalizeReorderIds(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException(
        `${this.entityName} reorder payload must include all item IDs`
      );
    }
    const ids: string[] = [];
    for (const raw of value) {
      if (typeof raw !== "string" || !raw.trim()) {
        throw new BadRequestException(
          `${this.entityName} reorder payload must contain only non-empty string IDs`
        );
      }
      ids.push(raw.trim());
    }
    return ids;
  }

  private isPrismaRecordNotFoundError(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return true;
    }
    // In some runtime layouts (multiple prisma bundles), instanceof can fail.
    // Fall back to code-based detection so we still map stale-record races to 404.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return true;
    }
    return false;
  }

  async list(
    projectId: string,
    userId: string,
    search?: string
  ): Promise<any[]> {
    const safeProjectId = this.normalizeProjectId(projectId);
    await this.verifyProjectAccess(safeProjectId, userId);
    const where: {
      projectId: string;
      name?: { contains: string; mode: "insensitive" };
    } = {
      projectId: safeProjectId,
    };
    if (typeof search === "string" && search.trim()) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }
    return this.delegate.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
  }

  async create(userId: string, body: CreateBody): Promise<any> {
    const projectId = this.normalizeProjectId(body.projectId);
    await this.verifyProjectAccess(projectId, userId);
    const name = this.normalizeName(body.name);
    const agg = await this.delegate.aggregate({
      where: { projectId },
      _max: { order: true },
    });
    const maxOrder = agg._max.order ?? -1;
    const done =
      body.done === undefined
        ? false
        : typeof body.done === "boolean"
          ? body.done
          : (() => {
              throw new BadRequestException(
                `${this.entityName} done must be a boolean`
              );
            })();
    return this.delegate.create({
      data: {
        projectId,
        name,
        done,
        order: maxOrder + 1,
      },
    });
  }

  async update(id: string, userId: string, body: UpdateBody): Promise<any> {
    await this.verifyItemAccess(id, userId);
    const data: UpdateBody = {};
    if (body.name !== undefined) {
      data.name = this.normalizeName(body.name);
    }
    if (body.done !== undefined) {
      if (typeof body.done !== "boolean") {
        throw new BadRequestException(
          `${this.entityName} done must be a boolean`
        );
      }
      data.done = body.done;
    }
    if (body.order !== undefined) data.order = this.normalizeOrder(body.order);
    try {
      return await this.delegate.update({ where: { id }, data });
    } catch (error) {
      if (this.isPrismaRecordNotFoundError(error)) {
        throw new NotFoundException(`${this.entityName} not found`);
      }
      throw error;
    }
  }

  async remove(id: string, userId: string): Promise<any> {
    await this.verifyItemAccess(id, userId);
    try {
      return await this.delegate.delete({ where: { id } });
    } catch (error) {
      if (this.isPrismaRecordNotFoundError(error)) {
        throw new NotFoundException(`${this.entityName} not found`);
      }
      throw error;
    }
  }

  async reorder(
    projectId: string,
    userId: string,
    itemIds: string[]
  ): Promise<any[]> {
    const safeProjectId = this.normalizeProjectId(projectId);
    await this.verifyProjectAccess(safeProjectId, userId);
    const normalizedIds = this.normalizeReorderIds(itemIds);
    const allProjectItems = (await this.delegate.findMany({
      where: { projectId: safeProjectId },
      select: { id: true },
    })) as Array<{ id: string }>;
    if (allProjectItems.length === 0) return [];
    if (normalizedIds.length !== allProjectItems.length) {
      throw new BadRequestException(
        `${this.entityName} reorder payload must include all item IDs exactly once`
      );
    }
    const uniqueIds = new Set(normalizedIds);
    if (uniqueIds.size !== normalizedIds.length) {
      throw new BadRequestException(
        `${this.entityName} reorder payload contains duplicate IDs`
      );
    }

    const items = (await this.delegate.findMany({
      where: { projectId: safeProjectId, id: { in: normalizedIds } },
      select: { id: true },
    })) as Array<{ id: string }>;
    const itemIdSet = new Set(items.map((i) => i.id));
    const missingId = normalizedIds.find((id) => !itemIdSet.has(id));
    if (missingId) {
      throw new NotFoundException(`${this.entityName} not found`);
    }

    const updates = normalizedIds.map((id, index) =>
      this.delegate.update({
        where: { id },
        data: { order: index },
      })
    );
    try {
      await this.prisma.$transaction(updates);
    } catch (error) {
      if (this.isPrismaRecordNotFoundError(error)) {
        throw new NotFoundException(`${this.entityName} not found`);
      }
      throw error;
    }
    return this.list(safeProjectId, userId);
  }
}
