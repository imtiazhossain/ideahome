import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { FeaturesService } from "./features.service";
import { PrismaService } from "../prisma.service";

describe("FeaturesService", () => {
  let service: FeaturesService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    feature: {
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
    mockPrisma.feature.aggregate.mockResolvedValue({ _max: { order: 1 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FeaturesService>(FeaturesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return features for project", async () => {
      const expected = [{ id: "f1", name: "Feature 1", projectId: "p1" }];
      mockPrisma.feature.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
    });

    it("should filter by search when provided", async () => {
      mockPrisma.feature.findMany.mockResolvedValue([]);
      await service.list("p1", "user-1", "  auth  ");
      expect(mockPrisma.feature.findMany).toHaveBeenCalledWith({
        where: {
          projectId: "p1",
          name: { contains: "auth", mode: "insensitive" },
        },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    });
  });

  describe("create", () => {
    it("should create feature", async () => {
      const expected = { id: "f1", name: "New", projectId: "p1", order: 2 };
      mockPrisma.feature.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        name: "New",
      });
      expect(result).toEqual(expected);
    });
  });

  describe("update", () => {
    it("should update feature", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue({
        id: "f1",
        project: { organizationId: "o1" },
      });
      mockPrisma.feature.update.mockResolvedValue({ id: "f1", name: "Updated" });

      const result = await service.update("f1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("should delete feature", async () => {
      mockPrisma.feature.findUnique.mockResolvedValue({
        id: "f1",
        project: { organizationId: "o1" },
      });
      mockPrisma.feature.delete.mockResolvedValue({ id: "f1" });

      const result = await service.remove("f1", "user-1");
      expect(result).toEqual({ id: "f1" });
    });
  });

  describe("reorder", () => {
    it("should reorder features", async () => {
      mockPrisma.feature.update.mockResolvedValue({});
      mockPrisma.feature.findMany
        .mockResolvedValueOnce([{ id: "f1" }, { id: "f2" }])
        .mockResolvedValueOnce([{ id: "f2" }, { id: "f1" }])
        .mockResolvedValueOnce([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["f2", "f1"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException when a feature is outside the project", async () => {
      mockPrisma.feature.findMany
        .mockResolvedValueOnce([{ id: "f1" }, { id: "other" }])
        .mockResolvedValueOnce([{ id: "f1" }]);
      await expect(service.reorder("p1", "user-1", ["f1", "other"])).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
