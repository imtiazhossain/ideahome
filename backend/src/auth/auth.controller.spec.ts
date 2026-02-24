import { Test, TestingModule } from "@nestjs/testing";
import { __setUserinfoResponse } from "openid-client";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma.service";

const mockRedirect = jest.fn();
const mockStatus = jest.fn().mockReturnThis();
const mockJson = jest.fn();

function mockRes() {
  return {
    redirect: mockRedirect,
    status: mockStatus,
    json: mockJson,
  };
}

describe("AuthController", () => {
  let controller: AuthController;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuthService = {
    createState: jest.fn(),
    consumeState: jest.fn(),
    getRedirectUri: jest.fn(),
    getFrontendCallbackUrl: jest.fn(),
    findOrCreateUserBySso: jest.fn(),
    ensureUserOrganization: jest.fn().mockResolvedValue(undefined),
    signToken: jest.fn(),
    exchangeGoogleCode: jest.fn(),
    exchangeGitHubCode: jest.fn(),
    exchangeAppleCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("login", () => {
    it("should redirect to authorization URL", async () => {
      const res = mockRes();
      await controller.login(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        "https://mock-auth.example/authorize"
      );
    });
  });

  describe("callback", () => {
    it("should return token and user when userinfo has email", async () => {
      __setUserinfoResponse({ email: "mock@example.com", name: "Mock User" });
      const user = {
        id: "user-1",
        email: "mock@example.com",
        name: "Mock User",
      };
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);

      const res = mockRes();
      await controller.callback({} as any, res as any, {
        code: "code",
        state: "mock-state",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "mock@example.com" },
        orderBy: { createdAt: "asc" },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { email: "mock@example.com", name: "Mock User" },
      });
      expect(mockJson).toHaveBeenCalled();
      const payload = mockJson.mock.calls[0][0];
      expect(payload).toHaveProperty("token");
      expect(payload).toHaveProperty("user", user);
    });

    it("should pass undefined name when userinfo has email but no name", async () => {
      __setUserinfoResponse({ email: "nobody@example.com" });
      const user = { id: "user-2", email: "nobody@example.com", name: null };
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(user);

      const res = mockRes();
      await controller.callback({} as any, res as any, {
        code: "code",
        state: "mock-state",
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: "nobody@example.com" },
        orderBy: { createdAt: "asc" },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: { email: "nobody@example.com", name: undefined },
      });
    });

    it("should return 400 when userinfo has no email", async () => {
      __setUserinfoResponse({});
      const res = mockRes();
      await controller.login(res as any);
      await controller.callback({} as any, res as any, {
        code: "code",
        state: "mock-state",
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No email in userinfo" });
      __setUserinfoResponse({ email: "mock@example.com", name: "Mock User" });
    });
  });
});
