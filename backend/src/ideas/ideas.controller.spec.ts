import { Test, TestingModule } from "@nestjs/testing";
import { IdeasController } from "./ideas.controller";
import { IdeasService } from "./ideas.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("IdeasController", () => {
  let controller: IdeasController;
  const mockSvc = {
    list: jest.fn(),
    listOpenRouterModels: jest.fn(),
    searchWeb: jest.fn(),
    listElevenLabsVoices: jest.fn(),
    synthesizeElevenLabsSpeech: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    reorder: jest.fn(),
    generatePlan: jest.fn(),
    generateAssistantChat: jest.fn(),
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

  const req = { user: { sub: "u1", email: "u1@example.com" } };

  it("list delegates to service", async () => {
    mockSvc.list.mockResolvedValue([]);
    await controller.list("p1", "search", req as any);
    expect(mockSvc.list).toHaveBeenCalledWith("p1", "u1", "search");
  });

  it("listOpenRouterModels delegates to service", async () => {
    mockSvc.listOpenRouterModels.mockResolvedValue(["openai/gpt-5-mini"]);
    await controller.listOpenRouterModels(req as any);
    expect(mockSvc.listOpenRouterModels).toHaveBeenCalledWith("u1@example.com");
  });

  it("searchWeb delegates to service", async () => {
    mockSvc.searchWeb.mockResolvedValue([]);
    await controller.searchWeb("latest ai news", "3", req as any);
    expect(mockSvc.searchWeb).toHaveBeenCalledWith("latest ai news", 3);
  });

  it("listElevenLabsVoices delegates to service", async () => {
    mockSvc.listElevenLabsVoices.mockResolvedValue([]);
    await controller.listElevenLabsVoices(req as any);
    expect(mockSvc.listElevenLabsVoices).toHaveBeenCalled();
  });

  it("synthesizeTts delegates to service and sends audio", async () => {
    const buffer = Buffer.from("audio");
    mockSvc.synthesizeElevenLabsSpeech.mockResolvedValue(buffer);
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    await controller.synthesizeTts(
      { text: "hello world", voiceId: "voice-1" },
      req as any,
      res as any
    );
    expect(mockSvc.synthesizeElevenLabsSpeech).toHaveBeenCalledWith(
      "hello world",
      "voice-1"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "audio/mpeg");
    expect(res.send).toHaveBeenCalledWith(buffer);
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
    await controller.reorder(
      { projectId: "p1", ideaIds: ["i1", "i2"] },
      req as any
    );
    expect(mockSvc.reorder).toHaveBeenCalledWith("p1", "u1", ["i1", "i2"]);
  });

  it("reorder handles missing body safely", async () => {
    mockSvc.reorder.mockResolvedValue([]);
    await controller.reorder(undefined as any, req as any);
    expect(mockSvc.reorder).toHaveBeenCalledWith(undefined, "u1", undefined);
  });

  it("generatePlan delegates to service", async () => {
    mockSvc.generatePlan.mockResolvedValue({ id: "i1" });
    await controller.generatePlan(
      "i1",
      { context: "mobile-first", model: "openai/gpt-5-mini" },
      req as any
    );
    expect(mockSvc.generatePlan).toHaveBeenCalledWith(
      "i1",
      "u1",
      "mobile-first",
      "openai/gpt-5-mini",
      "u1@example.com"
    );
  });

  it("generateAssistantChat delegates to service", async () => {
    mockSvc.generateAssistantChat.mockResolvedValue({ createdCount: 3 });
    await controller.generateAssistantChat(
      "i1",
      { context: "ship fast", model: "openai/gpt-4o-mini" },
      req as any
    );
    expect(mockSvc.generateAssistantChat).toHaveBeenCalledWith(
      "i1",
      "u1",
      "ship fast",
      "openai/gpt-4o-mini",
      "u1@example.com",
      undefined
    );
  });
});
