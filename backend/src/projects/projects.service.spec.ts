import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma.service";

describe("ProjectsService", () => {
  let service: ProjectsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ organizationId: "o1" }),
    },
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuthService = {
    ensureUserOrganization: jest
      .fn()
      .mockResolvedValue({ organizationId: "o1" }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return projects for user's org", async () => {
      const expected = [{ id: "1", name: "Project 1", organizationId: "o1" }];
      mockPrisma.project.findMany.mockResolvedValue(expected);

      const result = await service.list("user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { organizationId: true },
      });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: { organizationId: "o1" },
      });
    });
  });

  describe("get", () => {
    it("should return a project by id when it belongs to user's org", async () => {
      const expected = { id: "1", name: "Project 1", organizationId: "o1" };
      mockPrisma.project.findUnique.mockResolvedValue(expected);

      const result = await service.get("1", "user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.get("missing", "user-1")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.get("missing", "user-1")).rejects.toThrow(
        "Project not found"
      );
    });

    it("should throw NotFoundException when project is in another org", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "1",
        organizationId: "other-org",
      });

      await expect(service.get("1", "user-1")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.get("1", "user-1")).rejects.toThrow(
        "Project not found"
      );
    });
  });

  describe("create", () => {
    it("should create a project in user's org", async () => {
      const input = { name: "New Project" };
      const expected = { id: "1", ...input, organizationId: "o1" };
      mockPrisma.project.create.mockResolvedValue(expected);

      const result = await service.create("user-1", input);
      expect(result).toEqual(expected);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: { name: input.name, organizationId: "o1" },
      });
      expect(mockAuthService.ensureUserOrganization).not.toHaveBeenCalled();
    });

    it("should ensure user org when missing then create project", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
      mockAuthService.ensureUserOrganization.mockResolvedValue({
        organizationId: "new-org",
      });
      const input = { name: "New Project" };
      const expected = { id: "1", ...input, organizationId: "new-org" };
      mockPrisma.project.create.mockResolvedValue(expected);

      const result = await service.create("user-1", input);
      expect(result).toEqual(expected);
      expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(
        "user-1"
      );
      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: { name: input.name, organizationId: "new-org" },
      });
    });
  });

  describe("update", () => {
    it("should update a project", async () => {
      const data = { name: "Updated Name" };
      const expected = { id: "1", name: "Updated Name", organizationId: "o1" };
      mockPrisma.project.findUnique.mockResolvedValue(expected);
      mockPrisma.project.update.mockResolvedValue(expected);

      const result = await service.update("1", "user-1", data);
      expect(result).toEqual(expected);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data,
      });
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      const expected = { id: "1", name: "Deleted", organizationId: "o1" };
      mockPrisma.project.findUnique.mockResolvedValue(expected);
      mockPrisma.project.delete.mockResolvedValue(expected);

      const result = await service.delete("1", "user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException when record not found (P2025)", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "missing",
        organizationId: "o1",
      });
      const error = new PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "4",
      });
      mockPrisma.project.delete.mockRejectedValue(error);

      await expect(service.delete("missing", "user-1")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.delete("missing", "user-1")).rejects.toThrow(
        "Project not found"
      );
    });

    it("should rethrow non-P2025 errors", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "1",
        organizationId: "o1",
      });
      const error = new Error("Other DB error");
      mockPrisma.project.delete.mockRejectedValue(error);

      await expect(service.delete("1", "user-1")).rejects.toThrow(
        "Other DB error"
      );
    });
  });
});
