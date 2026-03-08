import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { CodeController } from "./code.controller";
import { CodeService } from "./code.service";

describe("CodeController", () => {
  let controller: CodeController;
  let svc: CodeService;

  const mockSvc = {
    listRepositoriesForProject: jest.fn(),
    createGithubRepositoryForProject: jest.fn(),
    getLatestAnalysisRun: jest.fn(),
    saveAnalysisRun: jest.fn(),
    getProjectPromptUsageTrend: jest.fn(),
    getMyPromptUsage: jest.fn(),
    clearMyPromptUsage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeController],
      providers: [{ provide: CodeService, useValue: mockSvc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CodeController>(CodeController);
    svc = module.get<CodeService>(CodeService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("listRepositories delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.listRepositoriesForProject.mockResolvedValue([{ id: "r1" }]);
    const result = await controller.listRepositories("proj1", req);
    expect(result).toEqual([{ id: "r1" }]);
    expect(mockSvc.listRepositoriesForProject).toHaveBeenCalledWith(
      "proj1",
      "user1"
    );
  });

  it("createGithubRepository delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.createGithubRepositoryForProject.mockResolvedValue({
      id: "r1",
      repoFullName: "o/r",
    });
    const result = await controller.createGithubRepository(
      "proj1",
      { repoFullName: "o/r", defaultBranch: "main" },
      req
    );
    expect(result.repoFullName).toBe("o/r");
    expect(mockSvc.createGithubRepositoryForProject).toHaveBeenCalledWith(
      "proj1",
      "user1",
      { repoFullName: "o/r", defaultBranch: "main" }
    );
  });

  it("createGithubRepository passes undefined when body or fields missing", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.createGithubRepositoryForProject.mockResolvedValue({});
    await controller.createGithubRepository("proj1", undefined as any, req);
    expect(mockSvc.createGithubRepositoryForProject).toHaveBeenCalledWith(
      "proj1",
      "user1",
      { repoFullName: undefined, defaultBranch: undefined }
    );
  });

  it("getLatestAnalysis delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.getLatestAnalysisRun.mockResolvedValue({ id: "run1" });
    const result = await controller.getLatestAnalysis(
      "proj1",
      "repo1",
      req
    );
    expect(result).toBeTruthy();
    expect(result!.id).toBe("run1");
    expect(mockSvc.getLatestAnalysisRun).toHaveBeenCalledWith(
      "proj1",
      "user1",
      "repo1"
    );
  });

  it("saveAnalysis delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.saveAnalysisRun.mockResolvedValue({ id: "run1", payload: {} });
    const result = await controller.saveAnalysis(
      "proj1",
      "repo1",
      { score: 90 },
      req
    );
    expect(mockSvc.saveAnalysisRun).toHaveBeenCalledWith(
      "proj1",
      "user1",
      "repo1",
      { score: 90 }
    );
  });

  it("getProjectPromptUsageTrend delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.getProjectPromptUsageTrend.mockResolvedValue({ points: [] });
    const result = await controller.getProjectPromptUsageTrend(
      "proj1",
      "all",
      req
    );
    expect(result).toEqual({ points: [] });
    expect(mockSvc.getProjectPromptUsageTrend).toHaveBeenCalledWith(
      "proj1",
      "user1",
      "all"
    );
  });

  it("getMyPromptUsage delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.getMyPromptUsage.mockResolvedValue({ entries: [] });
    const result = await controller.getMyPromptUsage("proj1", "all", req);
    expect(result).toEqual({ entries: [] });
    expect(mockSvc.getMyPromptUsage).toHaveBeenCalledWith(
      "proj1",
      "user1",
      "all"
    );
  });

  it("clearMyPromptUsage delegates to service", async () => {
    const req = { user: { sub: "user1" } } as any;
    mockSvc.clearMyPromptUsage.mockResolvedValue({ ok: true });
    const result = await controller.clearMyPromptUsage("proj1", req);
    expect(result).toEqual({ ok: true });
    expect(mockSvc.clearMyPromptUsage).toHaveBeenCalledWith("proj1", "user1");
  });
});
