import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { PrismaService } from "../prisma.service";

describe("ExpensesService", () => {
  let service: ExpensesService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    expense: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      organizationId: "o1",
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return expenses for project", async () => {
      const expected = [{ id: "e1", amount: 100, projectId: "p1" }];
      mockPrisma.expense.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
    });

    it("should throw ForbiddenException when user has no org", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });

      await expect(service.list("p1", "user-1")).rejects.toThrow(
        ForbiddenException
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
    it("should create expense", async () => {
      const expected = {
        id: "e1",
        projectId: "p1",
        amount: 50,
        description: "Lunch",
        date: "2025-01-15",
        category: "Food",
      };
      mockPrisma.expense.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        amount: 50,
        description: "Lunch",
        date: "2025-01-15",
        category: "Food",
      });
      expect(result).toEqual(expected);
      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          projectId: "p1",
          amount: 50,
          description: "Lunch",
          date: "2025-01-15",
          category: "Food",
        },
      });
    });

    it("should use default date and category when not provided", async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: "e1" });

      await service.create("user-1", {
        projectId: "p1",
        amount: 10,
        description: "Misc",
        date: "",
      });
      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          date: expect.any(String),
          category: "Other",
        }),
      });
    });
  });

  describe("update", () => {
    it("should update expense", async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: "e1",
        project: { organizationId: "o1" },
      });
      mockPrisma.expense.update.mockResolvedValue({
        id: "e1",
        amount: 75,
      });

      const result = await service.update("e1", "user-1", { amount: 75 });
      expect(result.amount).toBe(75);
    });
  });

  describe("remove", () => {
    it("should delete expense", async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: "e1",
        project: { organizationId: "o1" },
      });
      mockPrisma.expense.delete.mockResolvedValue({ id: "e1" });

      const result = await service.remove("e1", "user-1");
      expect(result).toEqual({ id: "e1" });
    });
  });
});
