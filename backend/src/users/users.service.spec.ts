import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { PrismaService } from "../prisma.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
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
      mockPrisma.user.findMany.mockResolvedValue(users);

      await expect(service.list()).resolves.toEqual(users);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { email: "asc" },
        select: { id: true, email: true, name: true },
      });
    });
  });
});
