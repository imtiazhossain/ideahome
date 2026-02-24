import { Test, TestingModule } from "@nestjs/testing";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsController", () => {
  let controller: OrganizationsController;
  let service: OrganizationsService;

  const mockOrganizationsService = {
    list: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockOrganizationsService },
      ],
    }).compile();

    controller = module.get<OrganizationsController>(OrganizationsController);
    service = module.get<OrganizationsService>(OrganizationsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.list()", async () => {
      const list = [{ id: "1", name: "Org 1" }];
      mockOrganizationsService.list.mockResolvedValue(list);

      await expect(controller.list()).resolves.toEqual(list);
      expect(mockOrganizationsService.list).toHaveBeenCalledWith();
    });
  });

  describe("create", () => {
    it("should pass body to service.create()", async () => {
      const body = { name: "New Org" };
      const created = { id: "1", ...body };
      mockOrganizationsService.create.mockResolvedValue(created);

      await expect(controller.create(body)).resolves.toEqual(created);
      expect(mockOrganizationsService.create).toHaveBeenCalledWith(body);
    });
  });
});
