import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organizationMembership: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return users ordered by email", async () => {
      const users = [
        { id: "1", email: "a@test.com", name: "A" },
        { id: "2", email: "b@test.com", name: "B" },
      ];
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
      mockPrisma.user.findMany.mockResolvedValue(users);

      await expect(service.list("u1")).resolves.toEqual(users);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "u1" },
        select: { organizationId: true },
      });
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { organizationId: "o1" },
            { organizationMemberships: { some: { organizationId: "o1" } } },
          ],
        },
        orderBy: { email: "asc" },
        select: { id: true, email: true, name: true },
      });
    });

    it("should return empty list when user has no organization", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });
      mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);

      await expect(service.list("u1")).resolves.toEqual([]);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe("appearance preferences", () => {
    it("returns defaults when no preference is stored", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ appearancePrefs: null });

      const result = await service.getAppearancePreferences("u1");
      expect(result.version).toBe(1);
      expect(result.lightPreset).toBe("classic");
      expect(result.darkPreset).toBe("classic");
      expect(typeof result.updatedAt).toBe("string");
    });

    it("repairs malformed stored preferences", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        appearancePrefs: {
          lightPreset: "ocean",
          darkPreset: "invalid-value",
          updatedAt: "2026-03-01T00:00:00.000Z",
          version: 99,
        },
      });

      await expect(service.getAppearancePreferences("u1")).resolves.toEqual({
        version: 1,
        lightPreset: "ocean",
        darkPreset: "classic",
        updatedAt: "2026-03-01T00:00:00.000Z",
      });
    });

    it("rejects invalid preset ids", async () => {
      await expect(
        service.updateAppearancePreferences("u1", {
          lightPreset: "invalid",
          darkPreset: "forest",
        })
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("persists validated preferences", async () => {
      const result = await service.updateAppearancePreferences("u1", {
        lightPreset: "ocean",
        darkPreset: "forest",
      });

      expect(result.version).toBe(1);
      expect(result.lightPreset).toBe("ocean");
      expect(result.darkPreset).toBe("forest");
      expect(typeof result.updatedAt).toBe("string");
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: {
          appearancePrefs: {
            version: 1,
            lightPreset: "ocean",
            darkPreset: "forest",
            updatedAt: expect.any(String),
          },
        },
      });
    });
  });
});
