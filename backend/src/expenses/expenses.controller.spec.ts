import { Test, TestingModule } from "@nestjs/testing";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("ExpensesController", () => {
  let controller: ExpensesController;
  const mockSvc = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExpensesController>(ExpensesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  const req = { user: { sub: "u1" } };

  it("list delegates to service", async () => {
    mockSvc.list.mockResolvedValue([]);
    await controller.list("p1", req as any);
    expect(mockSvc.list).toHaveBeenCalledWith("p1", "u1");
  });

  it("create delegates to service", async () => {
    mockSvc.create.mockResolvedValue({ id: "e1" });
    await controller.create(
      { projectId: "p1", amount: 10, description: "x", date: "2025-01-01" },
      req as any
    );
    expect(mockSvc.create).toHaveBeenCalledWith("u1", {
      projectId: "p1",
      amount: 10,
      description: "x",
      date: "2025-01-01",
    });
  });

  it("update delegates to service", async () => {
    mockSvc.update.mockResolvedValue({});
    await controller.update("e1", { amount: 20 }, req as any);
    expect(mockSvc.update).toHaveBeenCalledWith("e1", "u1", { amount: 20 });
  });

  it("remove delegates to service", async () => {
    mockSvc.remove.mockResolvedValue({});
    await controller.remove("e1", req as any);
    expect(mockSvc.remove).toHaveBeenCalledWith("e1", "u1");
  });
});
