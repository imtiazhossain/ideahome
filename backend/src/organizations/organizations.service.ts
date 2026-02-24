import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.organization.findMany({ orderBy: { name: "asc" } });
  }

  async create(data: { name: string }) {
    return this.prisma.organization.create({ data });
  }
}
