import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationsService } from "./organizations.service";
import { PrismaService } from "../prisma.service";

describe("OrganizationsService", () => {
  let service: OrganizationsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
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

  describe("listForUser", () => {
    it("should return user's organization when user has one", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        organizationId: "org-1",
      });
      const org = { id: "org-1", name: "My Workspace" };
      mockPrisma.organization.findUnique.mockResolvedValue(org);

      const result = await service.listForUser("user-1");
      expect(result).toEqual([org]);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { organizationId: true },
      });
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
      });
    });

    it("should return empty array when user has no org", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: null });

      const result = await service.listForUser("user-1");
      expect(result).toEqual([]);
      expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
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
