import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { BugsService } from "./bugs.service";
import { PrismaService } from "../prisma.service";

describe("BugsService", () => {
  let service: BugsService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    projectMembership: { findUnique: jest.fn() },
    bug: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      organizationId: "o1",
    });
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm1" });
    mockPrisma.bug.aggregate.mockResolvedValue({ _max: { order: 2 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BugsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BugsService>(BugsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return bugs for project", async () => {
      const expected = [{ id: "b1", name: "Bug 1", projectId: "p1" }];
      mockPrisma.bug.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: { projectId: "p1" },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    });

    it("should filter by search when provided", async () => {
      mockPrisma.bug.findMany.mockResolvedValue([]);

      await service.list("p1", "user-1", "  fix  ");
      expect(mockPrisma.bug.findMany).toHaveBeenCalledWith({
        where: {
          projectId: "p1",
          name: { contains: "fix", mode: "insensitive" },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    });

    it("should throw NotFoundException when user is not in project membership", async () => {
      mockPrisma.projectMembership.findUnique.mockResolvedValueOnce(null);
      await expect(service.list("p1", "user-1")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw NotFoundException when project not found", async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);

      await expect(service.list("p1", "user-1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("create", () => {
    it("should create bug with next order", async () => {
      const expected = { id: "b1", name: "New Bug", projectId: "p1", order: 3 };
      mockPrisma.bug.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        name: "New Bug",
      });
      expect(result).toEqual(expected);
      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: {
          projectId: "p1",
          name: "New Bug",
          done: false,
          order: 3,
        },
      });
    });

    it("should use order 0 when no existing bugs", async () => {
      mockPrisma.bug.aggregate.mockResolvedValue({ _max: { order: null } });
      mockPrisma.bug.create.mockResolvedValue({ id: "b1" });

      await service.create("user-1", {
        projectId: "p1",
        name: "First",
        done: true,
      });
      expect(mockPrisma.bug.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ order: 0, done: true }),
      });
    });
  });

  describe("update", () => {
    it("should update bug", async () => {
      mockPrisma.bug.findUnique.mockResolvedValue({
        id: "b1",
        projectId: "p1",
      });
      mockPrisma.bug.update.mockResolvedValue({
        id: "b1",
        name: "Updated",
      });

      const result = await service.update("b1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("should throw NotFoundException when bug not found", async () => {
      mockPrisma.bug.findUnique.mockResolvedValue(null);

      await expect(
        service.update("b1", "user-1", { name: "x" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should delete bug", async () => {
      mockPrisma.bug.findUnique.mockResolvedValue({
        id: "b1",
        projectId: "p1",
      });
      mockPrisma.bug.delete.mockResolvedValue({ id: "b1" });

      const result = await service.remove("b1", "user-1");
      expect(result).toEqual({ id: "b1" });
    });
  });

  describe("reorder", () => {
    it("should reorder bugs", async () => {
      mockPrisma.bug.update.mockResolvedValue({});
      mockPrisma.bug.findMany
        .mockResolvedValueOnce([{ id: "b1" }, { id: "b2" }, { id: "b3" }])
        .mockResolvedValueOnce([{ id: "b2" }, { id: "b1" }, { id: "b3" }])
        .mockResolvedValueOnce([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["b2", "b1", "b3"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.bug.findMany).toHaveBeenCalled();
    });

    it("should throw NotFoundException when a bug is outside the project", async () => {
      mockPrisma.bug.findMany
        .mockResolvedValueOnce([{ id: "b1" }, { id: "other" }])
        .mockResolvedValueOnce([{ id: "b1" }]);
      await expect(
        service.reorder("p1", "user-1", ["b1", "other"])
      ).rejects.toThrow(NotFoundException);
    });
  });
});
