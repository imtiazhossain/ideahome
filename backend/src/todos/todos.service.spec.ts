import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { TodosService } from "./todos.service";
import { PrismaService } from "../prisma.service";

describe("TodosService", () => {
  let service: TodosService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    projectMembership: { findUnique: jest.fn() },
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
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm1" });
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

    it("should ignore non-string search", async () => {
      mockPrisma.todo.findMany.mockResolvedValue([]);

      await service.list("p1", "user-1", 123 as unknown as string);
      expect(mockPrisma.todo.findMany).toHaveBeenCalledWith({
        where: { projectId: "p1" },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });
    });

    it("should throw BadRequestException when projectId is not a string", async () => {
      await expect(
        service.list(123 as unknown as string, "user-1")
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.todo.findMany).not.toHaveBeenCalled();
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

    it("should throw BadRequestException when name is blank", async () => {
      await expect(
        service.create("user-1", { projectId: "p1", name: "   " })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when name is not a string", async () => {
      await expect(
        service.create("user-1", {
          projectId: "p1",
          name: 123 as unknown as string,
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when done is not boolean", async () => {
      await expect(
        service.create("user-1", {
          projectId: "p1",
          name: "New",
          done: "true" as unknown as boolean,
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when projectId is blank", async () => {
      await expect(
        service.create("user-1", { projectId: "   ", name: "New" })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update todo", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      mockPrisma.todo.update.mockResolvedValue({ id: "t1", name: "Updated" });

      const result = await service.update("t1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("should throw BadRequestException when updating to blank name", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      await expect(
        service.update("t1", "user-1", { name: "  " })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when update name is not a string", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      await expect(
        service.update("t1", "user-1", { name: 123 as unknown as string })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when done update is not boolean", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      await expect(
        service.update("t1", "user-1", {
          done: "false" as unknown as boolean,
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when order is invalid", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      await expect(
        service.update("t1", "user-1", { order: -1 })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.update).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete todo", async () => {
      mockPrisma.todo.findUnique.mockResolvedValue({
        id: "t1",
        projectId: "p1",
      });
      mockPrisma.todo.delete.mockResolvedValue({ id: "t1" });

      const result = await service.remove("t1", "user-1");
      expect(result).toEqual({ id: "t1" });
    });
  });

  describe("reorder", () => {
    it("should reorder todos", async () => {
      mockPrisma.todo.update.mockResolvedValue({});
      mockPrisma.todo.findMany
        .mockResolvedValueOnce([{ id: "t1" }, { id: "t2" }, { id: "t3" }])
        .mockResolvedValueOnce([{ id: "t2" }, { id: "t1" }, { id: "t3" }])
        .mockResolvedValueOnce([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["t2", "t1", "t3"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException when a todo is outside the project", async () => {
      mockPrisma.todo.findMany
        .mockResolvedValueOnce([{ id: "t1" }, { id: "other" }])
        .mockResolvedValueOnce([{ id: "t1" }]);
      await expect(
        service.reorder("p1", "user-1", ["t1", "other"])
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when reorder contains duplicates", async () => {
      mockPrisma.todo.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }]);
      await expect(
        service.reorder("p1", "user-1", ["t1", "t1"])
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when reorder IDs are not an array", async () => {
      await expect(
        service.reorder("p1", "user-1", "t1" as unknown as string[])
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.findMany).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when reorder includes blank id", async () => {
      await expect(
        service.reorder("p1", "user-1", ["t1", "   "])
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.findMany).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when reorder projectId is invalid", async () => {
      await expect(
        service.reorder(123 as unknown as string, "user-1", ["t1"])
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.todo.findMany).not.toHaveBeenCalled();
    });
  });
});
