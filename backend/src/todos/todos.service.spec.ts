import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { TodosService } from "./todos.service";
import { PrismaService } from "../prisma.service";

describe("TodosService", () => {
  let service: TodosService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    todo: {
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
    mockPrisma.todo.aggregate.mockResolvedValue({ _max: { order: 2 } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return todos for project", async () => {
      const expected = [{ id: "t1", name: "Todo 1", projectId: "p1" }];
      mockPrisma.todo.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
    });
  });

  describe("create", () => {
    it("should create todo", async () => {
      const expected = { id: "t1", name: "New", projectId: "p1", order: 3 };
      mockPrisma.todo.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        name: "New",
      });
      expect(result).toEqual(expected);
    });
  });

  describe("update", () => {
    it("should update todo", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        project: { organizationId: "o1" },
      });
      mockPrisma.todo.update.mockResolvedValue({ id: "t1", name: "Updated" });

      const result = await service.update("t1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("should delete todo", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        project: { organizationId: "o1" },
      });
      mockPrisma.todo.delete.mockResolvedValue({ id: "t1" });

      const result = await service.remove("t1", "user-1");
      expect(result).toEqual({ id: "t1" });
    });
  });

  describe("reorder", () => {
    it("should reorder todos", async () => {
      mockPrisma.todo.update.mockResolvedValue({});
      mockPrisma.todo.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["t2", "t1", "t3"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });
});
