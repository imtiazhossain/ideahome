import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    let orgId = me?.organizationId ?? null;
    if (!orgId) {
      const membership = await this.prisma.organizationMembership.findFirst({
        where: { userId },
        select: { organizationId: true },
        orderBy: { createdAt: "asc" },
      });
      orgId = membership?.organizationId ?? null;
    }
    if (!orgId) return [];
    return this.prisma.user.findMany({
      where: {
        OR: [
          { organizationId: orgId },
          { organizationMemberships: { some: { organizationId: orgId } } },
        ],
      },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    });
  }
}
