import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

describe("ProjectsController", () => {
  let controller: ProjectsController;
  let service: ProjectsService;

  const mockProjectsService = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: mockProjectsService }],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get<ProjectsService>(ProjectsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.list()", async () => {
      const list = [{ id: "1", name: "Project 1" }];
      mockProjectsService.list.mockResolvedValue(list);

      await expect(controller.list()).resolves.toEqual(list);
      expect(mockProjectsService.list).toHaveBeenCalledWith(undefined);
    });

    it("should pass orgId to service.list()", async () => {
      const list = [{ id: "1", name: "Project 1", organizationId: "o1" }];
      mockProjectsService.list.mockResolvedValue(list);

      await expect(controller.list("o1")).resolves.toEqual(list);
      expect(mockProjectsService.list).toHaveBeenCalledWith("o1");
    });
  });

  describe("get", () => {
    it("should return result from service.get()", async () => {
      const project = { id: "1", name: "Project 1" };
      mockProjectsService.get.mockResolvedValue(project);

      await expect(controller.get("1")).resolves.toEqual(project);
      expect(mockProjectsService.get).toHaveBeenCalledWith("1");
    });
  });

  describe("create", () => {
    it("should pass body to service.create()", async () => {
      const body = { name: "New Project", organizationId: "o1" };
      const created = { id: "1", ...body };
      mockProjectsService.create.mockResolvedValue(created);

      await expect(controller.create(body)).resolves.toEqual(created);
      expect(mockProjectsService.create).toHaveBeenCalledWith(body);
    });
  });

  describe("update", () => {
    it("should pass id and body to service.update()", async () => {
      const body = { name: "Updated Name" };
      const updated = { id: "1", ...body };
      mockProjectsService.update.mockResolvedValue(updated);

      await expect(controller.update("1", body)).resolves.toEqual(updated);
      expect(mockProjectsService.update).toHaveBeenCalledWith("1", body);
    });
  });

  describe("remove", () => {
    it("should call service.delete() with id", async () => {
      mockProjectsService.delete.mockResolvedValue({ id: "1" });

      await expect(controller.remove("1")).resolves.toEqual({ id: "1" });
      expect(mockProjectsService.delete).toHaveBeenCalledWith("1");
    });
  });
});
