import { ServiceUnavailableException, NotFoundException } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { EmailService, InviteEmailDeliveryError } from "../email/email.service";
import { PrismaService } from "../prisma.service";
import { ProjectsService } from "./projects.service";
import { verifyProjectForUser } from "../common/org-scope";

jest.mock("../common/org-scope", () => ({
  verifyProjectForUser: jest.fn(),
}));

const verifyProjectForUserMock = verifyProjectForUser as jest.MockedFunction<
  typeof verifyProjectForUser
>;

describe("ProjectsService inviteByEmail", () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    projectInvite: {
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    projectMembership: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockAuthService = {
    ensureOrganizationMembership: jest.fn(),
  };

  const mockEmailService = {
    sendProjectInviteEmail: jest.fn(),
    resolveInviteAppUrl: jest
      .fn()
      .mockReturnValue("https://ideahome.vercel.app/"),
  };

  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyProjectForUserMock.mockResolvedValue({
      id: "project-1",
      organizationId: "org-1",
    });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      name: "Rocky",
      organizationId: "org-1",
    });
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "m1" });
    mockPrisma.user.findUnique.mockResolvedValue({
      name: "Imtiaz",
      email: "imtiaz@example.com",
    });
    mockPrisma.projectInvite.findMany.mockResolvedValue([
      {
        id: "inv-1",
        email: "new@example.com",
        createdAt: new Date(),
        invitedByUserId: "inviter-1",
      },
    ]);
    service = new ProjectsService(
      mockPrisma as unknown as PrismaService,
      mockAuthService as unknown as AuthService,
      mockEmailService as unknown as EmailService
    );
  });

  it("sends invite email for a new user invite", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await service.inviteByEmail("project-1", "inviter-1", {
      email: "new@example.com",
    });

    expect(mockPrisma.projectInvite.upsert).toHaveBeenCalled();
    expect(mockEmailService.sendProjectInviteEmail).toHaveBeenCalledWith({
      to: "new@example.com",
      inviterDisplayName: "Imtiaz",
      projectName: "Rocky",
      appUrl: "https://ideahome.vercel.app/",
    });
    expect(result).toEqual([
      {
        id: "inv-1",
        email: "new@example.com",
        createdAt: expect.any(Date),
        invitedByUserId: "inviter-1",
      },
    ]);
  });

  it("auto-accepts existing users and still sends invite email", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "existing-user-1" });

    await service.inviteByEmail("project-1", "inviter-1", {
      email: "existing@example.com",
    });

    expect(mockAuthService.ensureOrganizationMembership).toHaveBeenCalledWith(
      "org-1",
      "existing-user-1",
      "MEMBER"
    );
    expect(mockPrisma.projectMembership.upsert).toHaveBeenCalled();
    expect(mockPrisma.projectInvite.update).toHaveBeenCalledWith({
      where: {
        projectId_email: {
          projectId: "project-1",
          email: "existing@example.com",
        },
      },
      data: {
        acceptedByUserId: "existing-user-1",
        acceptedAt: expect.any(Date),
      },
    });
    expect(mockEmailService.sendProjectInviteEmail).toHaveBeenCalled();
  });

  it("returns 503 when invite email delivery fails after upsert", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockEmailService.sendProjectInviteEmail.mockRejectedValue(
      new InviteEmailDeliveryError("Provider failed")
    );

    await expect(
      service.inviteByEmail("project-1", "inviter-1", {
        email: "new@example.com",
      })
    ).rejects.toThrow(ServiceUnavailableException);
    expect(mockPrisma.projectInvite.upsert).toHaveBeenCalledTimes(1);
  });

  it("throws not found when project lookup fails after membership verification", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.project.findUnique.mockResolvedValue(null);

    await expect(
      service.inviteByEmail("project-1", "inviter-1", {
        email: "new@example.com",
      })
    ).rejects.toThrow(NotFoundException);
  });
});
