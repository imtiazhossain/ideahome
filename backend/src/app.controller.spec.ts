import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { MalwareScannerService } from "./malware-scanner.service";

describe("AppController", () => {
  let controller: AppController;
  const mockScanner = {
    healthCheck: jest.fn().mockResolvedValue({
      mode: "off",
      enabled: false,
      ready: true,
      failOpen: false,
      detail: "Malware scanning disabled",
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: MalwareScannerService, useValue: mockScanner },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getHealth", () => {
    it("should return status ok", () => {
      expect(controller.getHealth()).toEqual({ status: "ok" });
    });
  });

  describe("getMalwareScannerHealth", () => {
    it("should return malware scanner health status", async () => {
      await expect(controller.getMalwareScannerHealth()).resolves.toEqual({
        mode: "off",
        enabled: false,
        ready: true,
        failOpen: false,
        detail: "Malware scanning disabled",
      });
      expect(mockScanner.healthCheck).toHaveBeenCalled();
    });
  });
});
