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
    if (!me?.organizationId) return [];
    return this.prisma.user.findMany({
      where: { organizationId: me.organizationId },
      orderBy: { email: "asc" },
      select: { id: true, email: true, name: true },
    });
  }
}
