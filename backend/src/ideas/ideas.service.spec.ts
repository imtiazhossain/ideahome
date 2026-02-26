import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IdeasService } from "./ideas.service";
import { PrismaService } from "../prisma.service";

describe("IdeasService", () => {
  let service: IdeasService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    idea: {
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
    mockPrisma.idea.aggregate.mockResolvedValue({ _max: { order: 0 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdeasService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IdeasService>(IdeasService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return ideas for project", async () => {
      const expected = [{ id: "i1", name: "Idea 1", projectId: "p1" }];
      mockPrisma.idea.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
    });
  });

  describe("create", () => {
    it("should create idea", async () => {
      const expected = { id: "i1", name: "New", projectId: "p1", order: 1 };
      mockPrisma.idea.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        name: "New",
      });
      expect(result).toEqual(expected);
    });
  });

  describe("update", () => {
    it("should update idea", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        project: { organizationId: "o1" },
      });
      mockPrisma.idea.update.mockResolvedValue({ id: "i1", name: "Updated" });

      const result = await service.update("i1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("should delete idea", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        project: { organizationId: "o1" },
      });
      mockPrisma.idea.delete.mockResolvedValue({ id: "i1" });

      const result = await service.remove("i1", "user-1");
      expect(result).toEqual({ id: "i1" });
    });
  });

  describe("reorder", () => {
    it("should reorder ideas", async () => {
      mockPrisma.idea.update.mockResolvedValue({});
      mockPrisma.idea.findMany
        .mockResolvedValueOnce([{ id: "i1" }, { id: "i2" }])
        .mockResolvedValueOnce([{ id: "i2" }, { id: "i1" }])
        .mockResolvedValueOnce([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["i2", "i1"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException when an idea is outside the project", async () => {
      mockPrisma.idea.findMany
        .mockResolvedValueOnce([{ id: "i1" }, { id: "other" }])
        .mockResolvedValueOnce([{ id: "i1" }]);
      await expect(service.reorder("p1", "user-1", ["i1", "other"])).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
