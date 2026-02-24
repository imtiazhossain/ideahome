import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** List organizations the user belongs to (for now, only their personal org). */
  async listForUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) return [];
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    return org ? [org] : [];
  }

  async create(data: { name: string }) {
    return this.prisma.organization.create({ data });
  }
}
