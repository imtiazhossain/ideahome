import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { verifyProjectForUser } from "../common/org-scope";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeProjectId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException("projectId is required");
    }
    return value.trim();
  }

  private normalizeAmount(amount: unknown): number {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException("amount must be a finite number >= 0");
    }
    return parsed;
  }

  private normalizeDate(value: unknown): string {
    if (value === undefined || value === null) {
      return new Date().toISOString().slice(0, 10);
    }
    if (typeof value !== "string") {
      throw new BadRequestException("date must be in YYYY-MM-DD format");
    }
    const raw = value.trim();
    if (!raw) return new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new BadRequestException("date must be in YYYY-MM-DD format");
    }
    const parsed = new Date(`${raw}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== raw
    ) {
      throw new BadRequestException(
        "date must be a valid calendar date in YYYY-MM-DD format"
      );
    }
    return raw;
  }

  private normalizeDescription(value: unknown): string {
    if (typeof value !== "string") {
      throw new BadRequestException("description is required");
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException("description is required");
    }
    return trimmed;
  }

  private normalizeCategory(value: unknown): string {
    if (value === undefined || value === null) return "Other";
    if (typeof value !== "string") {
      throw new BadRequestException("category must be a string");
    }
    const trimmed = value.trim();
    return trimmed || "Other";
  }

  private async verifyProjectAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    await verifyProjectForUser(this.prisma, projectId, userId);
  }

  async list(projectId: string, userId: string) {
    const safeProjectId = this.normalizeProjectId(projectId);
    await this.verifyProjectAccess(safeProjectId, userId);
    return this.prisma.expense.findMany({
      where: { projectId: safeProjectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    userId: string,
    body: {
      projectId?: unknown;
      amount?: unknown;
      description?: unknown;
      date?: unknown;
      category?: unknown;
    }
  ) {
    const projectId = this.normalizeProjectId(body.projectId);
    await this.verifyProjectAccess(projectId, userId);
    return this.prisma.expense.create({
      data: {
        projectId,
        amount: this.normalizeAmount(body.amount),
        description: this.normalizeDescription(body.description),
        date: this.normalizeDate(body.date),
        category: this.normalizeCategory(body.category),
      },
    });
  }

  private async verifyExpenseAccess(expenseId: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        project: {
          select: {
            id: true,
            memberships: {
              where: { userId },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!expense || expense.project.memberships.length === 0) {
      throw new NotFoundException("Expense not found");
    }
    return expense;
  }

  async update(
    id: string,
    userId: string,
    body: {
      amount?: unknown;
      description?: unknown;
      date?: unknown;
      category?: unknown;
    }
  ) {
    await this.verifyExpenseAccess(id, userId);
    const data: {
      amount?: number;
      description?: string;
      date?: string;
      category?: string;
    } = {};
    if (body.amount !== undefined)
      data.amount = this.normalizeAmount(body.amount);
    if (body.description !== undefined)
      data.description = this.normalizeDescription(body.description);
    if (body.date !== undefined) data.date = this.normalizeDate(body.date);
    if (body.category !== undefined) {
      data.category = this.normalizeCategory(body.category);
    }
    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.verifyExpenseAccess(id, userId);
    return this.prisma.expense.delete({ where: { id } });
  }

  /** Delete all expenses with source "plaid" for the given project. Returns count deleted. */
  async removeAllImported(projectId: string, userId: string): Promise<{ deleted: number }> {
    const safeProjectId = this.normalizeProjectId(projectId);
    await this.verifyProjectAccess(safeProjectId, userId);
    const result = await this.prisma.expense.deleteMany({
      where: { projectId: safeProjectId, source: "plaid" },
    });
    // Reset Plaid sync cursor and last sync time so future syncs can re-import
    // transactions that were previously imported and then deleted.
    await this.prisma.plaidItem.updateMany({
      where: { userId },
      data: { transactionsCursor: null },
    });
    await this.prisma.project.updateMany({
      where: { id: safeProjectId },
      data: { lastPlaidSyncAt: null },
    });
    return { deleted: result.count };
  }
}
