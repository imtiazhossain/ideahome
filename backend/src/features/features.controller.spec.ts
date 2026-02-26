import { Test, TestingModule } from "@nestjs/testing";
import { FeaturesController } from "./features.controller";
import { FeaturesService } from "./features.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("FeaturesController", () => {
  let controller: FeaturesController;
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
      controllers: [FeaturesController],
      providers: [{ provide: FeaturesService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FeaturesController>(FeaturesController);
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
    mockSvc.create.mockResolvedValue({ id: "f1" });
    await controller.create({ projectId: "p1", name: "Feature" }, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {
      projectId: "p1",
      name: "Feature",
    });
  });

  it("create handles missing body safely", async () => {
    mockSvc.create.mockResolvedValue({ id: "f1" });
    await controller.create(undefined as any, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {});
  });

  it("update delegates to service", async () => {
    mockSvc.update.mockResolvedValue({});
    await controller.update("f1", { name: "New" }, req as any);
    expect(mockSvc.update).toHaveBeenCalledWith("f1", "u1", { name: "New" });
  });

  it("remove delegates to service", async () => {
    mockSvc.remove.mockResolvedValue({});
    await controller.remove("f1", req as any);
    expect(mockSvc.remove).toHaveBeenCalledWith("f1", "u1");
  });

  it("reorder delegates to service", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    await controller.reorder({ projectId: "p1", featureIds: ["f1", "f2"] }, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith("p1", "u1", ["f1", "f2"]);
  });

  it("reorder handles missing body safely", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    await controller.reorder(undefined as any, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith(undefined, "u1", undefined);
  });
});
