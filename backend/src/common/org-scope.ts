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

export async function verifyProjectForUser(
  prisma: PrismaService,
  projectId: string,
  userId: string
): Promise<{ id: string; organizationId: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, organizationId: true },
  });
  if (!project) {
    throw new NotFoundException("Project not found");
  }
  const member = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (!member) {
    throw new NotFoundException("Project not found");
  }
  return project;
}
