import { Test, TestingModule } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { TestsController } from "./tests.controller";
import { TestsService } from "./tests.service";

describe("TestsController", () => {
  let controller: TestsController;
  let service: TestsService;
  const originalEnableTestEndpoints = process.env.ENABLE_TEST_ENDPOINTS;
  const originalNodeEnv = process.env.NODE_ENV;

  const mockTestsService = {
    runUiTest: jest.fn(),
    runUiTestStream: jest.fn(),
    runApiTest: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.ENABLE_TEST_ENDPOINTS = "true";
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestsController],
      providers: [{ provide: TestsService, useValue: mockTestsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TestsController>(TestsController);
    service = module.get<TestsService>(TestsService);
  });

  afterEach(() => {
    process.env.ENABLE_TEST_ENDPOINTS = originalEnableTestEndpoints;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("runUi (POST)", () => {
    it("should throw when test execution endpoints are disabled", async () => {
      delete process.env.ENABLE_TEST_ENDPOINTS;
      await expect(controller.runUi({ grep: "home" })).rejects.toThrow(
        "Test execution endpoints are disabled"
      );
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should throw in production even when enabled", async () => {
      process.env.NODE_ENV = "production";
      process.env.ENABLE_TEST_ENDPOINTS = "true";
      await expect(controller.runUi({ grep: "home" })).rejects.toThrow(
        "Test execution endpoints are disabled in production."
      );
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should return error when grep is missing", async () => {
      const result = await controller.runUi({} as { grep: string });
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      });
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should return error when body or grep is not a string", async () => {
      const result = await controller.runUi({ grep: 123 } as any);
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      });
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should return error when body is undefined", async () => {
      const result = await controller.runUi(undefined as any);
      expect(result.errorOutput).toBe("Missing grep");
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should return error when grep is empty string", async () => {
      const result = await controller.runUi({ grep: "   " });
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      });
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should delegate to service when grep is provided", async () => {
      const runResult = {
        success: true,
        exitCode: 0,
        output: "ok",
        errorOutput: "",
      };
      mockTestsService.runUiTest.mockResolvedValue(runResult);

      await expect(controller.runUi({ grep: "home" })).resolves.toEqual(
        runResult
      );
      expect(mockTestsService.runUiTest).toHaveBeenCalledWith("home");
    });
  });

  describe("runUiStream (SSE)", () => {
    it("should return observable from service.runUiTestStream", () => {
      const { Observable } = require("rxjs");
      const obs = new Observable((sub: (x: unknown) => void) => {
        sub({ data: "event" });
      });
      mockTestsService.runUiTestStream.mockReturnValue(obs);

      const result = controller.runUiStream("smoke");
      expect(result).toBe(obs);
      expect(mockTestsService.runUiTestStream).toHaveBeenCalledWith("smoke");
    });

    it("should pass empty string when grep query is undefined", () => {
      mockTestsService.runUiTestStream.mockReturnValue({ subscribe: () => {} });

      controller.runUiStream(undefined as unknown as string);
      expect(mockTestsService.runUiTestStream).toHaveBeenCalledWith("");
    });
  });

  describe("runUi (POST) when VERCEL or USE_BUILTIN_API", () => {
    const origEnv = process.env;
    afterEach(() => {
      process.env = origEnv;
    });

    it("should return error when VERCEL is set", async () => {
      process.env.VERCEL = "1";
      const result = await controller.runUi({ grep: "home" });
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput:
          "UI tests (Playwright) are not available on Vercel. Run them locally with pnpm dev:backend.",
      });
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });

    it("should return error when USE_BUILTIN_API is set", async () => {
      process.env.USE_BUILTIN_API = "1";
      const result = await controller.runUi({ grep: "home" });
      expect(result.errorOutput).toContain("not available");
      expect(mockTestsService.runUiTest).not.toHaveBeenCalled();
    });
  });

  describe("runUiStream when VERCEL or USE_BUILTIN_API", () => {
    const origEnv = process.env;
    afterEach(() => {
      process.env = origEnv;
    });

    it("should emit error event when VERCEL is set", (done) => {
      process.env.VERCEL = "1";
      const obs = controller.runUiStream("test");
      const events: unknown[] = [];
      obs.subscribe({
        next: (e) => {
          events.push(JSON.parse((e as { data: string }).data));
          if (events.length === 1) {
            expect(events[0]).toMatchObject({
              type: "error",
              data: expect.stringContaining("not available"),
            });
            done();
          }
        },
      });
    });
  });

  describe("runApi (POST)", () => {
    const origVercel = process.env.VERCEL;
    const origBuiltin = process.env.USE_BUILTIN_API;

    beforeEach(() => {
      delete process.env.VERCEL;
      delete process.env.USE_BUILTIN_API;
    });
    afterEach(() => {
      process.env.VERCEL = origVercel;
      process.env.USE_BUILTIN_API = origBuiltin;
    });

    it("should delegate to service when testNamePattern is provided", async () => {
      const runResult = {
        success: true,
        exitCode: 0,
        output: "PASS",
        errorOutput: "",
      };
      mockTestsService.runApiTest.mockResolvedValue(runResult);

      await expect(
        controller.runApi({ testNamePattern: "GET / returns health status" })
      ).resolves.toEqual(runResult);
      expect(mockTestsService.runApiTest).toHaveBeenCalledWith(
        "GET / returns health status"
      );
    });

    it("should return error when VERCEL is set", async () => {
      const orig = process.env.VERCEL;
      process.env.VERCEL = "1";
      const result = await controller.runApi({
        testNamePattern: "GET /",
      });
      process.env.VERCEL = orig;
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput:
          "API tests are not available on Vercel. Run them locally with pnpm test:e2e.",
      });
      expect(mockTestsService.runApiTest).not.toHaveBeenCalled();
    });

    it("should call service with empty string when testNamePattern is not a string", async () => {
      mockTestsService.runApiTest.mockResolvedValue({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing test name pattern",
      });

      await controller.runApi({ testNamePattern: 123 } as any);
      expect(mockTestsService.runApiTest).toHaveBeenCalledWith("");
    });
  });
});
