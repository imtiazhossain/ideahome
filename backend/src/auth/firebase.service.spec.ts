import { Test, TestingModule } from "@nestjs/testing";
import { FirebaseService } from "./firebase.service";

describe("FirebaseService", () => {
  let service: FirebaseService;
  const origEnv = process.env;

  beforeEach(async () => {
    process.env = { ...origEnv };
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [FirebaseService],
    }).compile();

    service = module.get<FirebaseService>(FirebaseService);
    service.onModuleInit();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("when no Firebase env vars", () => {
    it("isConfigured returns false", () => {
      expect(service.isConfigured()).toBe(false);
    });

    it("verifyIdToken returns null", async () => {
      const result = await service.verifyIdToken("token");
      expect(result).toBeNull();
    });
  });
});
