import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CodeService } from "./code.service";
import { PrismaService } from "../prisma.service";

describe("CodeService", () => {
  let service: CodeService;

  const mockPrisma = {
    project: { findUnique: jest.fn() },
    projectMembership: { findUnique: jest.fn() },
    codeRepository: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    codeAnalysisRun: { findFirst: jest.fn(), create: jest.fn() },
    promptUsageEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "proj1",
      organizationId: "org1",
    });
    mockPrisma.projectMembership.findUnique.mockResolvedValue({ id: "pm1" });

    const module: TestingModule = await Test.createTestingModule({
      providers: [CodeService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CodeService>(CodeService);
  });

  describe("listRepositoriesForProject", () => {
    it("returns repositories for project", async () => {
      mockPrisma.codeRepository.findMany.mockResolvedValue([
        { id: "repo1", repoFullName: "owner/repo" },
      ]);

      const result = await service.listRepositoriesForProject("proj1", "user1");
      expect(result).toEqual([{ id: "repo1", repoFullName: "owner/repo" }]);
      expect(mockPrisma.codeRepository.findMany).toHaveBeenCalledWith({
        where: { projectId: "proj1" },
        orderBy: { createdAt: "asc" },
      });
    });

    it("throws when membership is missing", async () => {
      mockPrisma.projectMembership.findUnique.mockResolvedValue(null);
      await expect(
        service.listRepositoriesForProject("proj1", "user1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createGithubRepositoryForProject", () => {
    it("creates repository with valid repoFullName", async () => {
      mockPrisma.codeRepository.create.mockResolvedValue({
        id: "repo1",
        repoFullName: "owner/repo",
      });
      const result = await service.createGithubRepositoryForProject(
        "proj1",
        "user1",
        { repoFullName: "owner/repo" }
      );
      expect(result.repoFullName).toBe("owner/repo");
      expect(mockPrisma.codeRepository.create).toHaveBeenCalledWith({
        data: {
          projectId: "proj1",
          provider: "github",
          repoFullName: "owner/repo",
          defaultBranch: undefined,
        },
      });
    });

    it("rejects invalid repo name", async () => {
      await expect(
        service.createGithubRepositoryForProject("proj1", "user1", {
          repoFullName: "invalid",
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getLatestAnalysisRun", () => {
    it("returns latest run when repo exists", async () => {
      mockPrisma.codeRepository.findFirst.mockResolvedValue({ id: "repo1" });
      mockPrisma.codeAnalysisRun.findFirst.mockResolvedValue({ id: "run1" });
      const result = await service.getLatestAnalysisRun("proj1", "user1", "repo1");
      expect(result).toEqual({ id: "run1" });
    });

    it("throws when repository is missing", async () => {
      mockPrisma.codeRepository.findFirst.mockResolvedValue(null);
      await expect(
        service.getLatestAnalysisRun("proj1", "user1", "repo1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("saveAnalysisRun", () => {
    it("creates an analysis run", async () => {
      mockPrisma.codeRepository.findFirst.mockResolvedValue({ id: "repo1" });
      mockPrisma.codeAnalysisRun.create.mockResolvedValue({
        id: "run1",
        payload: { score: 80 },
      });
      const result = await service.saveAnalysisRun("proj1", "user1", "repo1", {
        score: 80,
      });
      expect(result.payload).toEqual({ score: 80 });
    });
  });

  describe("recordPromptUsage", () => {
    it("stores computed prompt metrics", async () => {
      mockPrisma.promptUsageEvent.create.mockResolvedValue({ id: "evt1" });
      await service.recordPromptUsage({
        projectId: "proj1",
        userId: "user1",
        source: "gpt-openai",
        promptText: "Fix login bug and return only the patch",
        promptTokens: 24,
        completionTokens: 42,
        totalTokens: 66,
      });

      expect(mockPrisma.promptUsageEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "proj1",
          userId: "user1",
          source: "gpt-openai",
          promptTokens: 24,
          completionTokens: 42,
          totalTokens: 66,
          efficiencyScore: expect.any(Number),
          promptWordCount: expect.any(Number),
        }),
      });
    });

    it("skips zero-token payloads", async () => {
      const result = await service.recordPromptUsage({
        projectId: "proj1",
        userId: "user1",
        source: "gpt-openai",
        promptText: "noop",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
      expect(result).toBeNull();
      expect(mockPrisma.promptUsageEvent.create).not.toHaveBeenCalled();
    });
  });

  describe("prompt usage queries", () => {
    it("returns project trend points without prompt text", async () => {
      mockPrisma.promptUsageEvent.findMany.mockResolvedValue([
        {
          createdAt: new Date("2026-03-07T10:00:00.000Z"),
          totalTokens: 66,
          promptTokens: 24,
          completionTokens: 42,
        },
      ]);
      const result = await service.getProjectPromptUsageTrend(
        "proj1",
        "user1",
        "all"
      );
      expect(result.mode).toBe("project");
      expect(result.points[0]).toEqual({
        timestamp: "2026-03-07T10:00:00.000Z",
        totalTokens: 66,
        promptTokens: 24,
        completionTokens: 42,
        promptCount: 1,
      });
    });

    it("returns current-user prompt details", async () => {
      mockPrisma.promptUsageEvent.findMany.mockResolvedValue([
        {
          id: "evt1",
          createdAt: new Date("2026-03-07T10:00:00.000Z"),
          source: "gpt-openai",
          promptText: "Fix login bug and return only the patch",
          promptTokens: 24,
          completionTokens: 42,
          totalTokens: 66,
          promptWordCount: 8,
          efficiencyScore: 82,
          improvementHints: ["Lead with the exact task."],
          breakdown: {
            brevity: 30,
            outputEfficiency: 24,
            redundancyPenalty: 15,
            instructionDensity: 13,
          },
        },
      ]);
      const result = await service.getMyPromptUsage("proj1", "user1", "all");
      expect(result.entries[0]?.promptText).toContain("Fix login bug");
      expect(result.entries[0]?.improvementHints).toEqual([
        "Lead with the exact task.",
      ]);
    });

    it("clears current-user prompt history", async () => {
      mockPrisma.promptUsageEvent.deleteMany.mockResolvedValue({ count: 2 });
      const result = await service.clearMyPromptUsage("proj1", "user1");
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.promptUsageEvent.deleteMany).toHaveBeenCalledWith({
        where: { projectId: "proj1", userId: "user1" },
      });
    });
  });

  describe("optimizer prompt fallback", () => {
    it("rewrites non-working complaints into outcome-based success criteria", () => {
      const prompt = "Minimizing a section isn't working.";

      const result = (service as any).buildStructuredPromptFallback(prompt);

      expect(result).toContain("Success criteria:");
      expect(result).toContain("- Minimizing a section is working.");
      expect(result).not.toContain("- Minimizing a section isn't working.");
    });

    it("separates complaint-style tasks from success criteria globally", () => {
      const prompt = "Bulby tends to glitch when too much talking.";

      const result = (service as any).buildStructuredPromptFallback(prompt);

      expect(result).toContain("Task: Fix Bulby glitching when too much talking.");
      expect(result).toContain(
        "- Bulby does not glitch when too much talking."
      );
      expect(result).not.toContain(
        "Success criteria:\n- Bulby tends to glitch when too much talking."
      );
    });

    it("rewrites forced-behavior complaints into verifiable success criteria", () => {
      const prompt =
        "When the tracker chart loads, it forces the page to jump to the chart after it loads.";

      const result = (service as any).buildStructuredPromptFallback(prompt);

      expect(result).toContain(
        "Task: Prevent the page from being forced to jump to the chart when the tracker chart loads."
      );
      expect(result).toContain(
        "- The page does not jump to the chart when the tracker chart loads."
      );
      expect(result).not.toContain(
        "- When the tracker chart loads, it forces the page to jump to the chart after it loads."
      );
    });

    it("rewrites neutral update tasks into outcome-based success criteria", () => {
      const prompt =
        "Update the Prompt Coach Prompt to encompass the recent enhancements to the prompt efficiency tool.";

      const result = (service as any).buildStructuredPromptFallback(prompt);

      expect(result).toContain(
        "Task: Update the Prompt Coach Prompt to encompass the recent enhancements to the prompt efficiency tool."
      );
      expect(result).toContain(
        "- The Prompt Coach Prompt is updated to encompass the recent enhancements to the prompt efficiency tool."
      );
      expect(result).not.toContain(
        "- Update the Prompt Coach Prompt to encompass the recent enhancements to the prompt efficiency tool."
      );
    });

    it("keeps first-person feature requests aligned to the original task", () => {
      const prompt =
        "I want to be able to filter the Prompt Efficiency Tracker chart by the last 5 data points.";

      const result = (service as any).buildStructuredPromptFallback(prompt);

      expect(result).toContain(
        "Task: Enable the ability to filter the Prompt Efficiency Tracker chart by the last 5 data points."
      );
      expect(result).toContain("Return the implementation changes and a brief summary of what changed.");
      expect(result).not.toContain("x-axis labels");
    });

    it("rejects unrelated optimized prompts and falls back to the original request", () => {
      const originalPrompt =
        "I want to be able to filter the Prompt Efficiency Tracker chart by the last 5 data points.";
      const unrelatedCandidate = [
        "Task: Align the x-axis labels with the data points.",
        "Constraints:",
        "- Preserve existing behavior unless needed for the requested fix.",
        "Output: Return only a compact Markdown bullet list of the required chart changes in 3 bullets.",
        "Success criteria:",
        "- X-axis labels align with their data points.",
      ].join("\n");

      const result = (service as any).repairOptimizedPrompt(
        originalPrompt,
        unrelatedCandidate
      );

      expect(result).toContain("last 5 data points");
      expect(result).toContain("Prompt Efficiency Tracker chart");
      expect(result).not.toContain("x-axis labels");
    });

    it("dedupes repeated task text across constraints and success criteria", () => {
      const originalPrompt =
        "I want to be able to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points.";
      const repetitiveCandidate = [
        "Task: I want to be able to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points.",
        "Constraints:",
        "- I want to be able to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points.",
        "Output: Return only a compact Markdown bullet list of the required chart changes in 3 bullets.",
        "Success criteria:",
        "- I want to be able to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points.",
      ].join("\n");

      const result = (service as any).repairOptimizedPrompt(
        originalPrompt,
        repetitiveCandidate
      );

      expect(result).toContain(
        "Task: Enable the ability to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points."
      );
      expect(result).toContain(
        "Output: Return the implementation changes and a brief summary of what changed."
      );
      expect(result).toContain(
        "- It is possible to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points."
      );
      expect(result).not.toContain(
        "- I want to be able to filter the Prompt Efficiency Tracker chart to see only the last 5 prompt data points."
      );
    });
  });
});
