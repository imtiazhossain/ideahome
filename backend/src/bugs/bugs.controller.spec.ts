import { Test, TestingModule } from "@nestjs/testing";
import { BugsController } from "./bugs.controller";
import { BugsService } from "./bugs.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("BugsController", () => {
  let controller: BugsController;
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
      controllers: [BugsController],
      providers: [{ provide: BugsService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BugsController>(BugsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("list delegates to service", async () => {
    mockSvc.list.mockResolvedValue([]);
    const req = { user: { sub: "u1" } };

    await controller.list("p1", "search", req as any);
    expect(mockSvc.list).toHaveBeenCalledWith("p1", "u1", "search");
  });

  it("create delegates to service", async () => {
    mockSvc.create.mockResolvedValue({ id: "b1" });
    const req = { user: { sub: "u1" } };

    await controller.create({ projectId: "p1", name: "Bug" }, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {
      projectId: "p1",
      name: "Bug",
    });
  });

  it("create handles missing body safely", async () => {
    mockSvc.create.mockResolvedValue({ id: "b1" });
    const req = { user: { sub: "u1" } };
    await controller.create(undefined as any, req as any);
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {});
  });

  it("update delegates to service", async () => {
    mockSvc.update.mockResolvedValue({});
    const req = { user: { sub: "u1" } };

    await controller.update("b1", { name: "New" }, req as any);
    expect(mockSvc.update).toHaveBeenCalledWith("b1", "u1", { name: "New" });
  });

  it("remove delegates to service", async () => {
    mockSvc.remove.mockResolvedValue({});
    const req = { user: { sub: "u1" } };

    await controller.remove("b1", req as any);
    expect(mockSvc.remove).toHaveBeenCalledWith("b1", "u1");
  });

  it("reorder delegates to service", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    const req = { user: { sub: "u1" } };

    await controller.reorder({ projectId: "p1", bugIds: ["b1", "b2"] }, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith("p1", "u1", ["b1", "b2"]);
  });

  it("reorder handles missing body safely", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    const req = { user: { sub: "u1" } };
    await controller.reorder(undefined as any, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith(undefined, "u1", undefined);
  });
});
