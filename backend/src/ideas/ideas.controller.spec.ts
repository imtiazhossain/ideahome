import { Test, TestingModule } from "@nestjs/testing";
import { IdeasController } from "./ideas.controller";
import { IdeasService } from "./ideas.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("IdeasController", () => {
  let controller: IdeasController;
  const mockSvc = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdeasController],
      providers: [{ provide: IdeasService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IdeasController>(IdeasController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const req = { user: { sub: "u1" } };

  it("list delegates to service", async () => {
    mockSvc.list.mockResolvedValue([]);
    await controller.list("p1", "search", req as any);
    expect(mockSvc.list).toHaveBeenCalledWith("p1", "u1", "search");
  });

  it("create delegates to service", async () => {
    mockSvc.create.mockResolvedValue({ id: "i1" });
    await controller.create({ projectId: "p1", name: "Idea" }, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {
      projectId: "p1",
      name: "Idea",
    });
  });

  it("create handles missing body safely", async () => {
    mockSvc.create.mockResolvedValue({ id: "i1" });
    await controller.create(undefined as any, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {});
  });

  it("update delegates to service", async () => {
    mockSvc.update.mockResolvedValue({});
    await controller.update("i1", { name: "New" }, req as any);
    expect(mockSvc.update).toHaveBeenCalledWith("i1", "u1", { name: "New" });
  });

  it("remove delegates to service", async () => {
    mockSvc.remove.mockResolvedValue({});
    await controller.remove("i1", req as any);
    expect(mockSvc.remove).toHaveBeenCalledWith("i1", "u1");
  });

  it("reorder delegates to service", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    await controller.reorder({ projectId: "p1", ideaIds: ["i1", "i2"] }, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith("p1", "u1", ["i1", "i2"]);
  });

  it("reorder handles missing body safely", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    await controller.reorder(undefined as any, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith(undefined, "u1", undefined);
  });
});
