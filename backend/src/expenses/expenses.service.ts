import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ExpensesService {
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

  async list(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);
    return this.prisma.expense.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    userId: string,
    body: {
      projectId: string;
      amount: number;
      description: string;
      date: string;
      category?: string;
    }
  ) {
    await this.verifyProjectAccess(body.projectId, userId);
    return this.prisma.expense.create({
      data: {
        projectId: body.projectId,
        amount: Number(body.amount),
        description: body.description.trim(),
        date: body.date || new Date().toISOString().slice(0, 10),
        category: body.category?.trim() || "Other",
      },
    });
  }

  private async verifyExpenseAccess(expenseId: string, userId: string) {
    const orgId = await this.getOrgIdForUser(userId);
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { project: true },
    });
    if (!expense || expense.project.organizationId !== orgId) {
      throw new NotFoundException("Expense not found");
    }
    return expense;
  }

  async update(
    id: string,
    userId: string,
    body: {
      amount?: number;
      description?: string;
      date?: string;
      category?: string;
    }
  ) {
    await this.verifyExpenseAccess(id, userId);
    const data: {
      amount?: number;
      description?: string;
      date?: string;
      category?: string;
    } = {};
    if (body.amount !== undefined) data.amount = Number(body.amount);
    if (body.description !== undefined)
      data.description = body.description.trim();
    if (body.date !== undefined) data.date = body.date;
    if (body.category !== undefined)
      data.category = body.category?.trim() || "Other";
    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.verifyExpenseAccess(id, userId);
    return this.prisma.expense.delete({ where: { id } });
  }
}
