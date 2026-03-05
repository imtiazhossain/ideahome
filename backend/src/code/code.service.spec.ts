import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CodeService } from "./code.service";
import { PrismaService } from "../prisma.service";
import { AuthService } from "../auth/auth.service";

describe("CodeService", () => {
  let service: CodeService;
  let prisma: PrismaService;
  let authService: AuthService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    projectMembership: { findUnique: jest.fn() },
    codeRepository: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    codeAnalysisRun: { findFirst: jest.fn(), create: jest.fn() },
  };

  const mockAuthService = {
    ensureUserOrganization: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm1" });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<CodeService>(CodeService);
    prisma = module.get<PrismaService>(PrismaService);
    authService = module.get<AuthService>(AuthService);
  });

  describe("listRepositoriesForProject", () => {
    it("returns repositories for project", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: "org1",
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findMany.mockResolvedValue([
        { id: "repo1", repoFullName: "owner/repo" },
      ]);

      const result = await service.listRepositoriesForProject("proj1", "user1");
      expect(result).toEqual([{ id: "repo1", repoFullName: "owner/repo" }]);
      expect(mockPrisma.codeRepository.findMany).toHaveBeenCalledWith({
        where: { projectId: "proj1" },
        orderBy: { createdAt: "asc" },
      });
    });

    it("throws when user not found", async () => {
      mockPrisma.projectMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.listRepositoriesForProject("proj1", "user1")
      ).rejects.toThrow(NotFoundException);
    });

    it("calls ensureUserOrganization when user has no organizationId", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findMany.mockResolvedValue([]);

      await service.listRepositoriesForProject("proj1", "user1");
      expect(mockAuthService.ensureUserOrganization).not.toHaveBeenCalled();
    });

    it("throws when ensureUserOrganization returns no organizationId", async () => {
      mockPrisma.projectMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.listRepositoriesForProject("proj1", "user1")
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when project not found or wrong org", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.listRepositoriesForProject("proj1", "user1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createGithubRepositoryForProject", () => {
    beforeEach(() => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
    });

    it("creates repository with valid repoFullName", async () => {
      mockPrisma.codeRepository.create.mockResolvedValue({
        id: "repo1",
        repoFullName: "owner/repo",
      });
      const result = await service.createGithubRepositoryForProject(
        "proj1",
        "user1",
        { repoFullName: "owner/repo" }
      );
      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: {
          projectId: "proj1",
          provider: "github",
          repoFullName: "owner/repo",
          defaultBranch: undefined,
        },
      });
      expect(result.repoFullName).toBe("owner/repo");
    });

    it("rejects non-string repoFullName", async () => {
      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: 123,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects empty or whitespace repoFullName", async () => {
      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: "   ",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects repoFullName without slash", async () => {
      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: "invalid",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects repoFullName over 200 chars", async () => {
      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: "a/" + "x".repeat(200),
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts defaultBranch and rejects over 200 chars", async () => {
      mockPrisma.codeRepository.create.mockResolvedValue({});
      await service.createGithubRepositoryForProject("proj1", "user1", {
        repoFullName: "o/r",
        defaultBranch: "main",
      });
      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ defaultBranch: "main" }),
      });

      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: "o/r",
          defaultBranch: "x".repeat(201),
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getLatestAnalysisRun", () => {
    it("returns latest run when repo exists", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findFirst.mockResolvedValue({
        id: "repo1",
      });
      mockPrisma.codeAnalysisRun.findFirst.mockResolvedValue({
        id: "run1",
        createdAt: new Date(),
      });

      const result = await service.getLatestAnalysisRun(
        "proj1",
        "user1",
        "repo1"
      );
      expect(result?.id).toBe("run1");
    });

    it("throws when code repository not found", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findFirst.mockResolvedValue(null);
      await expect(
        service.getLatestAnalysisRun("proj1", "user1", "repo1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("saveAnalysisRun", () => {
    it("creates analysis run when repo exists", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findFirst.mockResolvedValue({ id: "repo1" });
      mockPrisma.codeAnalysisRun.create.mockResolvedValue({
        id: "run1",
        payload: { score: 80 },
      });

      const result = await service.saveAnalysisRun(
        "proj1",
        "user1",
        "repo1",
        { score: 80 }
      );
      expect(result.payload).toEqual({ score: 80 });
    });

    it("throws when code repository not found", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "proj1",
        organizationId: "org1",
      });
      mockPrisma.codeRepository.findFirst.mockResolvedValue(null);
      await expect(
        service.saveAnalysisRun("proj1", "user1", "repo1", {})
      ).rejects.toThrow(NotFoundException);
    });
  });
});
