import { Test, TestingModule } from "@nestjs/testing";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectsController>(ProjectsController);
    service = module.get<ProjectsService>(ProjectsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const req = { user: { sub: "user-1" } };

  describe("list", () => {
    it("should return result from service.list() with user id", async () => {
      const list = [{ id: "1", name: "Project 1" }];
      mockProjectsService.list.mockResolvedValue(list);

      await expect(controller.list(req as any)).resolves.toEqual(list);
      expect(mockProjectsService.list).toHaveBeenCalledWith("user-1");
    });
  });

  describe("get", () => {
    it("should return result from service.get() with user id", async () => {
      const project = { id: "1", name: "Project 1" };
      mockProjectsService.get.mockResolvedValue(project);

      await expect(controller.get("1", req as any)).resolves.toEqual(project);
      expect(mockProjectsService.get).toHaveBeenCalledWith("1", "user-1");
    });
  });

  describe("create", () => {
    it("should pass userId and name to service.create()", async () => {
      const body = { name: "New Project" };
      const created = { id: "1", ...body };
      mockProjectsService.create.mockResolvedValue(created);

      await expect(controller.create(body, req as any)).resolves.toEqual(
        created
      );
      expect(mockProjectsService.create).toHaveBeenCalledWith("user-1", {
        name: "New Project",
      });
    });

    it("should handle missing create body safely", async () => {
      mockProjectsService.create.mockResolvedValue({ id: "1" });
      await controller.create(undefined as any, req as any);
      expect(mockProjectsService.create).toHaveBeenCalledWith("user-1", {
        name: undefined,
      });
    });
  });

  describe("update", () => {
    it("should pass id, userId and body to service.update()", async () => {
      const body = { name: "Updated Name" };
      const updated = { id: "1", ...body };
      mockProjectsService.update.mockResolvedValue(updated);

      await expect(controller.update("1", body, req as any)).resolves.toEqual(
        updated
      );
      expect(mockProjectsService.update).toHaveBeenCalledWith(
        "1",
        "user-1",
        body
      );
    });

    it("should handle missing update body safely", async () => {
      mockProjectsService.update.mockResolvedValue({ id: "1" });
      await controller.update("1", undefined as any, req as any);
      expect(mockProjectsService.update).toHaveBeenCalledWith(
        "1",
        "user-1",
        {}
      );
    });
  });

  describe("remove", () => {
    it("should call service.delete() with id and user id", async () => {
      mockProjectsService.delete.mockResolvedValue({ id: "1" });

      await expect(controller.remove("1", req as any)).resolves.toEqual({
        id: "1",
      });
      expect(mockProjectsService.delete).toHaveBeenCalledWith("1", "user-1");
    });
  });
});
