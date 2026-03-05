import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma.service";

describe("OrganizationsService", () => {
  let service: OrganizationsService;

  const mockPrisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    organizationMembership: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const mockAuthService = {
    ensureUserOrganization: jest.fn(),
    ensureOrganizationMembership: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );
    mockPrisma.organizationMembership.findFirst.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
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
    it("should create an organization and assign user to it", async () => {
      const input = { name: "New Org" };
      const expected = { id: "org-1", ...input };
      mockPrisma.organization.create.mockResolvedValue(expected);

      const result = await service.create("user-1", input);
      expect(result).toEqual(expected);
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: { name: input.name },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.organizationMembership.upsert).toHaveBeenCalled();
    });

    it("should throw BadRequestException when name is blank", async () => {
      await expect(service.create("user-1", { name: "   " })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when name is not a string", async () => {
      await expect(
        service.create("user-1", { name: 123 as unknown as string })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });
  });

  describe("ensureForUser", () => {
    it("should throw when ensureUserOrganization returns user without organizationId", async () => {
      mockAuthService.ensureUserOrganization.mockResolvedValue({
        id: "u1",
        email: "u@x.com",
        name: null,
        organizationId: null,
      });

      await expect(service.ensureForUser("u1")).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.ensureForUser("u1")).rejects.toThrow(
        "Unexpected: no organization after ensure"
      );
    });
    it("should return existing org when user has one", async () => {
      mockAuthService.ensureUserOrganization.mockResolvedValue({
        organizationId: "org-1",
      });
      const org = { id: "org-1", name: "My Workspace" };
      mockPrisma.organization.findUniqueOrThrow.mockResolvedValue(org);

      const result = await service.ensureForUser("user-1");
      expect(result).toEqual(org);
      expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(
        "user-1"
      );
      expect(
        mockAuthService.ensureOrganizationMembership
      ).toHaveBeenCalledWith("org-1", "user-1", "MEMBER");
    });
  });
});
