import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { AuthService } from "../auth/auth.service";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma.service";

describe("ProjectsService", () => {
  let service: ProjectsService;

  const mockPrisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn().mockResolvedValue({ organizationId: "o1" }),
    },
    project: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    todo: {
      deleteMany: jest.fn(),
    },
    idea: {
      deleteMany: jest.fn(),
    },
    bug: {
      deleteMany: jest.fn(),
    },
    feature: {
      deleteMany: jest.fn(),
    },
    expense: {
      deleteMany: jest.fn(),
    },
    issue: {
      deleteMany: jest.fn(),
    },
    issueComment: {
      deleteMany: jest.fn(),
    },
    issueCommentEdit: {
      deleteMany: jest.fn(),
    },
    commentAttachment: {
      deleteMany: jest.fn(),
    },
    issueRecording: {
      deleteMany: jest.fn(),
    },
    issueScreenshot: {
      deleteMany: jest.fn(),
    },
    issueFile: {
      deleteMany: jest.fn(),
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
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma)
    );
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

  describe("getOrgIdForUser", () => {
    it("should throw NotFoundException when user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.list("user-missing")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.list("user-missing")).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("list", () => {
    it("should return projects for user's org", async () => {
      mockPrisma.project.findMany.mockResolvedValue([
        { id: "1", name: "Project 1", organizationId: "o1" },
      ]);
      const expected = [{ id: "1", name: "Project 1", organizationId: "o1" }];

      const result = await service.list("user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { organizationId: true },
      });
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: { organizationId: "o1" },
      });
      expect(mockPrisma.project.createMany).not.toHaveBeenCalled();
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

    it("should throw BadRequestException when name is blank", async () => {
      await expect(service.create("user-1", { name: "   " })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when name is not a string", async () => {
      await expect(
        service.create("user-1", { name: 123 as unknown as string })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.project.create).not.toHaveBeenCalled();
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
        data: { name: "Updated Name" },
      });
    });

    it("should throw BadRequestException when update name is blank", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "1",
        organizationId: "o1",
      });
      await expect(
        service.update("1", "user-1", { name: "   " })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.project.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when update name is not a string", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "1",
        organizationId: "o1",
      });
      await expect(
        service.update("1", "user-1", { name: 123 as unknown as string })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.project.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      const expected = { id: "1", name: "Deleted", organizationId: "o1" };
      mockPrisma.project.findUnique.mockResolvedValue(expected);
      mockPrisma.project.delete.mockResolvedValue(expected);

      const result = await service.delete("1", "user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
      expect(mockPrisma.commentAttachment.deleteMany).toHaveBeenCalledWith({
        where: { comment: { issue: { projectId: "1" } } },
      });
      expect(mockPrisma.issueCommentEdit.deleteMany).toHaveBeenCalledWith({
        where: { comment: { issue: { projectId: "1" } } },
      });
      expect(mockPrisma.issueComment.deleteMany).toHaveBeenCalledWith({
        where: { issue: { projectId: "1" } },
      });
      expect(mockPrisma.issueRecording.deleteMany).toHaveBeenCalledWith({
        where: { issue: { projectId: "1" } },
      });
      expect(mockPrisma.issueScreenshot.deleteMany).toHaveBeenCalledWith({
        where: { issue: { projectId: "1" } },
      });
      expect(mockPrisma.issueFile.deleteMany).toHaveBeenCalledWith({
        where: { issue: { projectId: "1" } },
      });
      expect(mockPrisma.todo.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
      });
      expect(mockPrisma.idea.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
      });
      expect(mockPrisma.bug.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
      });
      expect(mockPrisma.feature.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
      });
      expect(mockPrisma.expense.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
      });
      expect(mockPrisma.issue.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "1" },
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
