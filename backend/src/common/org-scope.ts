import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

export async function getOrgIdForUser(
  prisma: PrismaService,
  userId: string,
  missingOrgError: Error
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!user?.organizationId) {
    throw missingOrgError;
  }
  return user.organizationId;
}

export async function verifyProjectInOrg(
  prisma: PrismaService,
  projectId: string,
  orgId: string
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project || project.organizationId !== orgId) {
    throw new NotFoundException("Project not found");
  }
}
