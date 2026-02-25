import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

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

  /** Create an organization and assign the current user to it. */
  async create(userId: string, data: { name: string }) {
    const org = await this.prisma.organization.create({
      data: { name: data.name },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { organizationId: org.id },
    });
    return org;
  }

  /** Ensure the user has an organization (creates "My Workspace" if none). Returns the org. */
  async ensureForUser(userId: string) {
    const user = await this.authService.ensureUserOrganization(userId);
    if (!user.organizationId)
      throw new Error("Unexpected: no organization after ensure");
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: user.organizationId },
    });
    return org;
  }
}
