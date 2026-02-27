import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { IdeasService } from "./ideas.service";
import { PrismaService } from "../prisma.service";
import { IdeaPlanService } from "./idea-plan.service";

describe("IdeasService", () => {
  let service: IdeasService;

  const mockPrisma = {
    user: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    idea: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    todo: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const mockIdeaPlanService = {
    generatePlan: jest.fn(),
    generateActionResponse: jest.fn(),
    listAvailableModels: jest.fn(),
    searchWeb: jest.fn(),
    listElevenLabsVoices: jest.fn(),
    synthesizeElevenLabsSpeech: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "p1",
      organizationId: "o1",
    });
    mockPrisma.idea.aggregate.mockResolvedValue({ _max: { order: 0 } });
    mockIdeaPlanService.generatePlan.mockResolvedValue({
      summary: "summary",
      milestones: ["m1"],
      tasks: ["t1"],
      risks: ["r1"],
      firstSteps: ["s1"],
    });
    mockIdeaPlanService.generateActionResponse.mockResolvedValue({
      message: "Hello!",
    });
    mockIdeaPlanService.listAvailableModels.mockResolvedValue([
      "openai/gpt-5-mini",
    ]);
    mockIdeaPlanService.searchWeb.mockResolvedValue([
      {
        title: "Result",
        url: "https://example.com",
        snippet: "Snippet",
        publishedAt: null,
      },
    ]);
    mockIdeaPlanService.listElevenLabsVoices.mockResolvedValue([
      { id: "voice-1", name: "Rachel" },
    ]);
    mockIdeaPlanService.synthesizeElevenLabsSpeech.mockResolvedValue(
      Buffer.from("audio")
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdeasService,
        { provide: IdeaPlanService, useValue: mockIdeaPlanService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<IdeasService>(IdeasService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return ideas for project", async () => {
      const expected = [{ id: "i1", name: "Idea 1", projectId: "p1" }];
      mockPrisma.idea.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "user-1");
      expect(result).toEqual(expected);
    });
  });

  describe("create", () => {
    it("should create idea", async () => {
      const expected = { id: "i1", name: "New", projectId: "p1", order: 1 };
      mockPrisma.idea.create.mockResolvedValue(expected);

      const result = await service.create("user-1", {
        projectId: "p1",
        name: "New",
      });
      expect(result).toEqual(expected);
    });
  });

  describe("update", () => {
    it("should update idea", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        project: { organizationId: "o1" },
      });
      mockPrisma.idea.update.mockResolvedValue({ id: "i1", name: "Updated" });

      const result = await service.update("i1", "user-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });
  });

  describe("remove", () => {
    it("should delete idea", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        project: { organizationId: "o1" },
      });
      mockPrisma.idea.delete.mockResolvedValue({ id: "i1" });

      const result = await service.remove("i1", "user-1");
      expect(result).toEqual({ id: "i1" });
    });
  });

  describe("reorder", () => {
    it("should reorder ideas", async () => {
      mockPrisma.idea.update.mockResolvedValue({});
      mockPrisma.idea.findMany
        .mockResolvedValueOnce([{ id: "i1" }, { id: "i2" }])
        .mockResolvedValueOnce([{ id: "i2" }, { id: "i1" }])
        .mockResolvedValueOnce([]);
      mockPrisma.$transaction.mockImplementation((ops: Promise<unknown>[]) =>
        Promise.all(ops)
      );

      await service.reorder("p1", "user-1", ["i2", "i1"]);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should throw NotFoundException when an idea is outside the project", async () => {
      mockPrisma.idea.findMany
        .mockResolvedValueOnce([{ id: "i1" }, { id: "other" }])
        .mockResolvedValueOnce([{ id: "i1" }]);
      await expect(service.reorder("p1", "user-1", ["i1", "other"])).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("generatePlan", () => {
    it("should generate and persist an idea plan", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        name: "Idea One",
        project: { name: "Project A", organizationId: "o1" },
      });
      mockPrisma.idea.update.mockResolvedValue({
        id: "i1",
        planJson: { summary: "summary" },
      });

      const result = await service.generatePlan("i1", "user-1", "mobile app");

      expect(mockIdeaPlanService.generatePlan).toHaveBeenCalledWith({
        ideaName: "Idea One",
        projectName: "Project A",
        context: "mobile app",
        preferredModel: undefined,
        requesterEmail: undefined,
      });
      expect(mockPrisma.idea.update).toHaveBeenCalled();
      expect(result).toEqual({ id: "i1", planJson: { summary: "summary" } });
    });
  });

  describe("listOpenRouterModels", () => {
    it("should delegate model lookup to IdeaPlanService", async () => {
      const result = await service.listOpenRouterModels("user@example.com");
      expect(mockIdeaPlanService.listAvailableModels).toHaveBeenCalledWith(
        "user@example.com"
      );
      expect(result).toEqual(["openai/gpt-5-mini"]);
    });
  });

  describe("searchWeb", () => {
    it("delegates to IdeaPlanService web search", async () => {
      const result = await service.searchWeb("latest llm news", 2);
      expect(mockIdeaPlanService.searchWeb).toHaveBeenCalledWith(
        "latest llm news",
        2
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("listElevenLabsVoices", () => {
    it("delegates to IdeaPlanService ElevenLabs voice list", async () => {
      const result = await service.listElevenLabsVoices();
      expect(mockIdeaPlanService.listElevenLabsVoices).toHaveBeenCalled();
      expect(result).toEqual([{ id: "voice-1", name: "Rachel" }]);
    });
  });

  describe("synthesizeElevenLabsSpeech", () => {
    it("delegates to IdeaPlanService ElevenLabs synthesis", async () => {
      const result = await service.synthesizeElevenLabsSpeech("hello", "voice-1");
      expect(mockIdeaPlanService.synthesizeElevenLabsSpeech).toHaveBeenCalledWith(
        "hello",
        "voice-1"
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("generateAssistantChat", () => {
    it("should generate direct action response without creating todos", async () => {
      mockPrisma.idea.findUnique.mockResolvedValue({
        id: "i1",
        name: "Idea One",
        projectId: "p1",
        project: { name: "Project A", organizationId: "o1" },
      });

      const result = await service.generateAssistantChat("i1", "user-1");

      expect(mockIdeaPlanService.generateActionResponse).toHaveBeenCalledWith({
        ideaName: "Idea One",
        projectName: "Project A",
        context: undefined,
        preferredModel: undefined,
        requesterEmail: undefined,
        includeWeb: undefined,
      });
      expect(result.createdCount).toBe(0);
      expect(result.todos).toEqual([]);
      expect(result.message).toBe("Hello!");
    });
  });
});
