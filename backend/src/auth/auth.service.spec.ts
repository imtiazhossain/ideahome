import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  const mockPrisma = {
    account: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      create: jest.fn().mockResolvedValue({ id: "org-1" }),
    },
  };

  const origEnv = process.env;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getRedirectUri", () => {
    it("uses BACKEND_URL when set", () => {
      process.env.BACKEND_URL = "https://api.example.com";
      expect(service.getRedirectUri("google")).toBe(
        "https://api.example.com/auth/google/callback"
      );
    });
    it("defaults to localhost:3001", () => {
      delete process.env.BACKEND_URL;
      expect(service.getRedirectUri("github")).toBe(
        "http://localhost:3001/auth/github/callback"
      );
    });
  });

  describe("getFrontendCallbackUrl", () => {
    it("includes token in query when provided", () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      expect(service.getFrontendCallbackUrl("jwt-here")).toBe(
        "https://app.example.com/login/callback?token=jwt-here"
      );
    });
    it("returns base URL without token when empty", () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      expect(service.getFrontendCallbackUrl("")).toBe(
        "https://app.example.com/login/callback"
      );
    });
  });

  describe("createState / consumeState", () => {
    it("returns provider after consumeState", () => {
      const state = service.createState("apple");
      expect(state).toBeTruthy();
      expect(service.consumeState(state)).toBe("apple");
    });
    it("returns null when state already consumed or unknown", () => {
      const state = service.createState("google");
      service.consumeState(state);
      expect(service.consumeState(state)).toBeNull();
      expect(service.consumeState("unknown-state")).toBeNull();
    });
  });

  describe("signToken", () => {
    it("returns a JWT string", () => {
      const token = service.signToken({
        id: "user-1",
        email: "u@example.com",
      });
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });
  });

  describe("findOrCreateUserBySso", () => {
    it("returns existing user when account exists", async () => {
      const existingUser = {
        id: "user-1",
        email: "existing@example.com",
        name: "Existing",
      };
      mockPrisma.account.findUnique.mockResolvedValue({
        userId: existingUser.id,
        user: existingUser,
      });
      mockPrisma.user.update.mockResolvedValue(existingUser);
      mockPrisma.user.findUniqueOrThrow
        .mockResolvedValueOnce({ ...existingUser, organizationId: "org-1" })
        .mockResolvedValueOnce(existingUser);

      const result = await service.findOrCreateUserBySso("google", {
        providerId: "google-123",
        email: "existing@example.com",
        name: "Updated Name",
      });

      expect(result).toEqual({
        id: "user-1",
        email: "existing@example.com",
        name: "Existing",
      });
      expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it("creates user and account when new account", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      const newUser = {
        id: "user-new",
        email: "new@example.com",
        name: "New User",
      };
      mockPrisma.user.create.mockResolvedValue(newUser);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        ...newUser,
        organizationId: "org-1",
      });
      mockPrisma.account.create.mockResolvedValue({});

      const result = await service.findOrCreateUserBySso("github", {
        providerId: "github-456",
        email: "new@example.com",
        name: "New User",
      });

      expect(result).toEqual(newUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          name: "New User",
        },
      });
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          userId: "user-new",
          provider: "github",
          providerId: "github-456",
        },
      });
    });

    it("creates new user per account when same email different provider", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      const newUser = {
        id: "user-apple-new",
        email: "same@example.com",
        name: null,
      };
      mockPrisma.user.create.mockResolvedValue(newUser);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        ...newUser,
        organizationId: "org-2",
      });
      mockPrisma.account.create.mockResolvedValue({});

      const result = await service.findOrCreateUserBySso("apple", {
        providerId: "apple-789",
        email: "same@example.com",
        name: null,
      });

      expect(result).toEqual(newUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "same@example.com",
          name: undefined,
        },
      });
      expect(mockPrisma.account.create).toHaveBeenCalledWith({
        data: {
          userId: "user-apple-new",
          provider: "apple",
          providerId: "apple-789",
        },
      });
    });
  });
});
