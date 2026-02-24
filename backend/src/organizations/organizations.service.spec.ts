import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationsService } from "./organizations.service";
import { PrismaService } from "../prisma.service";

describe("OrganizationsService", () => {
  let service: OrganizationsService;

  const mockPrisma = {
    organization: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return all organizations ordered by name", async () => {
      const expected = [
        { id: "1", name: "Org A" },
        { id: "2", name: "Org B" },
      ];
      mockPrisma.organization.findMany.mockResolvedValue(expected);

      const result = await service.list();
      expect(result).toEqual(expected);
      expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
      });
    });
  });

  describe("create", () => {
    it("should create an organization", async () => {
      const input = { name: "New Org" };
      const expected = { id: "1", ...input };
      mockPrisma.organization.create.mockResolvedValue(expected);

      const result = await service.create(input);
      expect(result).toEqual(expected);
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: input,
      });
    });
  });
});
