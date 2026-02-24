import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma.service";

describe("ProjectsService", () => {
  let service: ProjectsService;

  const mockPrisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return all projects when orgId is not provided", async () => {
      const expected = [{ id: "1", name: "Project 1", organizationId: "o1" }];
      mockPrisma.project.findMany.mockResolvedValue(expected);

      const result = await service.list();
      expect(result).toEqual(expected);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: undefined,
      });
    });

    it("should filter by orgId when provided", async () => {
      const expected = [{ id: "1", name: "Project 1", organizationId: "o1" }];
      mockPrisma.project.findMany.mockResolvedValue(expected);

      const result = await service.list("o1");
      expect(result).toEqual(expected);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: { organizationId: "o1" },
      });
    });
  });

  describe("get", () => {
    it("should return a project by id", async () => {
      const expected = { id: "1", name: "Project 1", organizationId: "o1" };
      mockPrisma.project.findUnique.mockResolvedValue(expected);

      const result = await service.get("1");
      expect(result).toEqual(expected);
      expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException when project does not exist", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.get("missing")).rejects.toThrow(NotFoundException);
      await expect(service.get("missing")).rejects.toThrow("Project not found");
    });
  });

  describe("create", () => {
    it("should create a project", async () => {
      const input = { name: "New Project", organizationId: "o1" };
      const expected = { id: "1", ...input };
      mockPrisma.project.create.mockResolvedValue(expected);

      const result = await service.create(input);
      expect(result).toEqual(expected);
      expect(mockPrisma.project.create).toHaveBeenCalledWith({ data: input });
    });
  });

  describe("update", () => {
    it("should update a project", async () => {
      const data = { name: "Updated Name" };
      const expected = { id: "1", name: "Updated Name", organizationId: "o1" };
      mockPrisma.project.update.mockResolvedValue(expected);

      const result = await service.update("1", data);
      expect(result).toEqual(expected);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data,
      });
    });
  });

  describe("delete", () => {
    it("should delete a project", async () => {
      const expected = { id: "1", name: "Deleted" };
      mockPrisma.project.delete.mockResolvedValue(expected);

      const result = await service.delete("1");
      expect(result).toEqual(expected);
      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException when record not found (P2025)", async () => {
      const error = new PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "4",
      });
      mockPrisma.project.delete.mockRejectedValue(error);

      await expect(service.delete("missing")).rejects.toThrow(
        NotFoundException
      );
      await expect(service.delete("missing")).rejects.toThrow(
        "Project not found"
      );
    });

    it("should rethrow non-P2025 errors", async () => {
      const error = new Error("Other DB error");
      mockPrisma.project.delete.mockRejectedValue(error);

      await expect(service.delete("1")).rejects.toThrow("Other DB error");
    });
  });
});
