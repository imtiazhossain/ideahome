import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { PlaidService } from "./plaid.service";
import { PrismaService } from "../prisma.service";

describe("PlaidService", () => {
  let service: PlaidService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    projectMembership: {
      findUnique: jest.fn(),
    },
    plaidItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    expense: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const resetOrgAndProject = () => {
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "u1",
      organizationId: "o1",
    });
    (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
      id: "p1",
      organizationId: "o1",
      lastPlaidSyncAt: null,
    });
    (mockPrisma.projectMembership.findUnique as jest.Mock).mockResolvedValue({
      id: "pm1",
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    resetOrgAndProject();
    process.env.PLAID_CLIENT_ID = "test-client";
    process.env.PLAID_SECRET = "test-secret";
    process.env.PLAID_ENV = "sandbox";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaidService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PlaidService>(PlaidService);
  });

  describe("createLinkToken", () => {
    it("throws when PLAID is not configured", async () => {
      delete process.env.PLAID_CLIENT_ID;
      delete process.env.PLAID_SECRET;

      await expect(service.createLinkToken("u1")).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe("listLinkedAccounts", () => {
    it("returns linked accounts for user", async () => {
      (mockPrisma.plaidItem.findMany as jest.Mock).mockResolvedValue([
        {
          id: "pi1",
          itemId: "item-1",
          institutionName: "Bank",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ]);

      const result = await service.listLinkedAccounts("u1");
      expect(result).toEqual([
        {
          id: "pi1",
          itemId: "item-1",
          institutionName: "Bank",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
        },
      ]);
    });

    it("throws ForbiddenException when user has no org", async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "u1",
        organizationId: null,
      });

      await expect(service.listLinkedAccounts("u1")).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe("renameLinkedAccount", () => {
    it("throws NotFoundException when item not found", async () => {
      (mockPrisma.plaidItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.renameLinkedAccount("u1", "missing", "New Name")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeLinkedAccount", () => {
    it("throws NotFoundException when item not found", async () => {
      (mockPrisma.plaidItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.removeLinkedAccount("u1", "missing")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("syncTransactions", () => {
    it("returns existing last sync when no linked accounts", async () => {
      (mockPrisma.plaidItem.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        organizationId: "o1",
        lastPlaidSyncAt: new Date("2025-01-01T12:00:00.000Z"),
      });

      const result = await service.syncTransactions("u1", "p1");
      expect(result.added).toBe(0);
      expect(result.lastSyncedAt).toBe("2025-01-01T12:00:00.000Z");
      expect(mockPrisma.plaidItem.findMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
      });
    });

    it("creates expenses from Plaid added transactions and updates project lastPlaidSyncAt", async () => {
      const plaidItem = {
        id: "pi1",
        userId: "u1",
        accessToken: "at",
        itemId: "item-1",
        transactionsCursor: null,
      };
      (mockPrisma.plaidItem.findMany as jest.Mock).mockResolvedValue([plaidItem]);
      (mockPrisma.expense.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.expense.create as jest.Mock).mockResolvedValue({ id: "e1" });
      (mockPrisma.project.update as jest.Mock).mockResolvedValue({});

      const mockTransactionsSync = jest.fn().mockResolvedValue({
        data: {
          added: [
            {
              transaction_id: "tx-1",
              amount: 25.5,
              date: "2025-01-15",
              merchant_name: "Coffee",
              name: "Coffee Shop",
              personal_finance_category: { primary: "FOOD_AND_DRINK" },
            },
          ],
          next_cursor: null,
          has_more: false,
        },
      });
      (service as unknown as { client: { transactionsSync: jest.Mock } }).client = {
        transactionsSync: mockTransactionsSync,
      };

      const result = await service.syncTransactions("u1", "p1");

      expect(result.added).toBe(1);
      expect(result.lastSyncedAt).toBeDefined();
      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          projectId: "p1",
          amount: 25.5,
          description: "Coffee",
          date: "2025-01-15",
          category: "FOOD_AND_DRINK",
          source: "plaid",
          externalId: "tx-1",
        },
      });
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { lastPlaidSyncAt: expect.any(Date) },
      });
    });

    it("skips transactions that already exist (deduplication by externalId)", async () => {
      const plaidItem = {
        id: "pi1",
        userId: "u1",
        accessToken: "at",
        itemId: "item-1",
        transactionsCursor: null,
      };
      (mockPrisma.plaidItem.findMany as jest.Mock).mockResolvedValue([plaidItem]);
      (mockPrisma.expense.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "e-existing" })
        .mockResolvedValueOnce(null);
      (mockPrisma.expense.create as jest.Mock).mockResolvedValue({ id: "e2" });
      (mockPrisma.project.update as jest.Mock).mockResolvedValue({});

      const mockTransactionsSync = jest.fn().mockResolvedValue({
        data: {
          added: [
            { transaction_id: "tx-1", amount: 10, date: "2025-01-01", merchant_name: "A", name: "A" },
            { transaction_id: "tx-2", amount: 20, date: "2025-01-02", merchant_name: "B", name: "B" },
          ],
          next_cursor: null,
          has_more: false,
        },
      });
      (service as unknown as { client: { transactionsSync: jest.Mock } }).client = {
        transactionsSync: mockTransactionsSync,
      };

      const result = await service.syncTransactions("u1", "p1");

      expect(result.added).toBe(1);
      expect(mockPrisma.expense.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ externalId: "tx-2" }),
      });
    });

    it("paginates with cursor and updates plaidItem.transactionsCursor", async () => {
      const plaidItem = {
        id: "pi1",
        userId: "u1",
        accessToken: "at",
        itemId: "item-1",
        transactionsCursor: null,
      };
      (mockPrisma.plaidItem.findMany as jest.Mock).mockResolvedValue([plaidItem]);
      (mockPrisma.expense.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.expense.create as jest.Mock).mockResolvedValue({ id: "e1" });
      (mockPrisma.plaidItem.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.project.update as jest.Mock).mockResolvedValue({});

      const mockTransactionsSync = jest.fn()
        .mockResolvedValueOnce({
          data: {
            added: [
              { transaction_id: "tx-1", amount: 10, date: "2025-01-01", merchant_name: "A", name: "A" },
            ],
            next_cursor: "cursor-page-2",
            has_more: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            added: [
              { transaction_id: "tx-2", amount: 20, date: "2025-01-02", merchant_name: "B", name: "B" },
            ],
            next_cursor: null,
            has_more: false,
          },
        });
      (service as unknown as { client: { transactionsSync: jest.Mock } }).client = {
        transactionsSync: mockTransactionsSync,
      };

      const result = await service.syncTransactions("u1", "p1");

      expect(result.added).toBe(2);
      expect(mockTransactionsSync).toHaveBeenCalledTimes(2);
      expect(mockTransactionsSync).toHaveBeenNthCalledWith(1, { access_token: "at", cursor: undefined });
      expect(mockTransactionsSync).toHaveBeenNthCalledWith(2, { access_token: "at", cursor: "cursor-page-2" });
      expect(mockPrisma.plaidItem.update).toHaveBeenCalledWith({
        where: { id: "pi1" },
        data: { transactionsCursor: "cursor-page-2" },
      });
    });
  });

  describe("getLastSync", () => {
    it("returns null when project has never synced", async () => {
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        organizationId: "o1",
        lastPlaidSyncAt: null,
      });

      const result = await service.getLastSync("u1", "p1");
      expect(result).toEqual({ lastSyncedAt: null });
    });

    it("returns ISO string when project has lastPlaidSyncAt", async () => {
      const date = new Date("2025-01-02T03:04:05.000Z");
      (mockPrisma.project.findUnique as jest.Mock).mockResolvedValue({
        id: "p1",
        organizationId: "o1",
        lastPlaidSyncAt: date,
      });

      const result = await service.getLastSync("u1", "p1");
      expect(result).toEqual({ lastSyncedAt: date.toISOString() });
    });
  });
});
