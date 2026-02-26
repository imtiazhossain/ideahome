import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("OrganizationsController", () => {
  let controller: OrganizationsController;
  let service: OrganizationsService;

  const mockOrganizationsService = {
    listForUser: jest.fn(),
    create: jest.fn(),
    ensureForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockOrganizationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.listForUser() with user id", async () => {
      const list = [{ id: "1", name: "Org 1" }];
      mockOrganizationsService.listForUser.mockResolvedValue(list);
      const req = { user: { sub: "user-1" } };

      await expect(controller.list(req as any)).resolves.toEqual(list);
      expect(mockOrganizationsService.listForUser).toHaveBeenCalledWith(
        "user-1"
      );
    });
  });

  describe("create", () => {
    it("should pass user id and body to service.create()", async () => {
      const body = { name: "New Org" };
      const created = { id: "1", ...body };
      mockOrganizationsService.create.mockResolvedValue(created);
      const req = { user: { sub: "user-1" } };

      await expect(controller.create(req as any, body)).resolves.toEqual(
        created
      );
      expect(mockOrganizationsService.create).toHaveBeenCalledWith(
        "user-1",
        body
      );
    });

    it("should handle missing create body safely", async () => {
      mockOrganizationsService.create.mockResolvedValue({ id: "1" });
      const req = { user: { sub: "user-1" } };
      await controller.create(req as any, undefined as any);
      expect(mockOrganizationsService.create).toHaveBeenCalledWith("user-1", {});
    });
  });

  describe("ensure", () => {
    it("should return org from service.ensureForUser()", async () => {
      const org = { id: "org-1", name: "My Workspace" };
      mockOrganizationsService.ensureForUser.mockResolvedValue(org);
      const req = { user: { sub: "user-1" } };

      await expect(controller.ensure(req as any)).resolves.toEqual(org);
      expect(mockOrganizationsService.ensureForUser).toHaveBeenCalledWith(
        "user-1"
      );
    });
  });
});
