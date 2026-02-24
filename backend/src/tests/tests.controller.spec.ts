import { Test, TestingModule } from "@nestjs/testing";
import { TestsController } from "./tests.controller";
import { TestsService } from "./tests.service";

describe("TestsController", () => {
  let controller: TestsController;
  let service: TestsService;

  const mockTestsService = {
    runUiTest: jest.fn(),
    runUiTestStream: jest.fn(),
    runApiTest: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestsController],
      providers: [{ provide: TestsService, useValue: mockTestsService }],
    }).compile();

    controller = module.get<TestsController>(TestsController);
    service = module.get<TestsService>(TestsService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("runUi (POST)", () => {
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

  describe("runApi (POST)", () => {
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
