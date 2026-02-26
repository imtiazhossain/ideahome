import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
        where: { organizationId: "o1" },
        orderBy: { email: "asc" },
        select: { id: true, email: true, name: true },
      });
    });

    it("should return empty list when user has no organization", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });

      await expect(service.list("u1")).resolves.toEqual([]);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
