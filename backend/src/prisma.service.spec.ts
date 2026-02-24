import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

describe("PrismaService", () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    service.$connect = jest.fn().mockResolvedValue(undefined);
    service.$on = jest.fn();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should call $connect", async () => {
      await service.onModuleInit();
      expect(service.$connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("enableShutdownHooks", () => {
    it("should register beforeExit handler that closes app", async () => {
      const mockApp = {
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as INestApplication;
      service.enableShutdownHooks(mockApp);
      expect(service.$on).toHaveBeenCalledWith(
        "beforeExit",
        expect.any(Function)
      );
      const handler = (service.$on as jest.Mock).mock.calls[0][1];
      await handler();
      expect(mockApp.close).toHaveBeenCalledTimes(1);
    });
  });
});
