import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt.guard";
import { PrismaService } from "../prisma.service";
import { FirebaseService } from "./firebase.service";
import { AuthService } from "./auth.service";
import * as jwt from "jsonwebtoken";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let mockPrisma: { user: { findUnique: jest.Mock; findFirst: jest.Mock } };
  let mockFirebase: { isConfigured: jest.Mock; verifyIdToken: jest.Mock };
  let mockAuthService: {
    findOrCreateUserByFirebase: jest.Mock;
    ensureUserOrganization: jest.Mock;
  };
  const mockVerify = jwt.verify as jest.MockedFunction<typeof jwt.verify>;

  function createMockContext(
    headers: Record<string, string | string[]>
  ): ExecutionContext {
    const req = { headers: { ...headers } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    mockFirebase = {
      isConfigured: jest.fn().mockReturnValue(false),
      verifyIdToken: jest.fn().mockResolvedValue(null),
    };
    mockAuthService = {
      findOrCreateUserByFirebase: jest.fn(),
      ensureUserOrganization: jest.fn().mockResolvedValue(undefined),
    };
    guard = new JwtAuthGuard(
      mockPrisma as unknown as PrismaService,
      mockFirebase as unknown as FirebaseService,
      mockAuthService as unknown as AuthService
    );
    jest.clearAllMocks();
    mockFirebase.isConfigured.mockReturnValue(false);
    delete process.env.JWT_SECRET;
    delete process.env.SKIP_AUTH_DEV;
    delete process.env.DEV_USER_ID;
  });

  async function canActivate(ctx: ExecutionContext): Promise<boolean> {
    return guard.canActivate(ctx);
  }

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should throw when Authorization header is missing", async () => {
    const ctx = createMockContext({});
    await expect(canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(canActivate(ctx)).rejects.toThrow(
      "Missing Authorization header"
    );
  });

  it("should use lowercase authorization header", async () => {
    const ctx = createMockContext({ authorization: "Bearer token" });
    mockVerify.mockReturnValue({ sub: "user1" } as never);
    expect(await canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("token", "dev-secret");
  });

  it("should use capitalized Authorization header", async () => {
    const ctx = createMockContext({ Authorization: "Bearer token2" });
    mockVerify.mockReturnValue({ sub: "user2" } as never);
    expect(await canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("token2", "dev-secret");
  });

  it("should use first element when authorization is an array", async () => {
    const ctx = createMockContext({ authorization: ["Bearer array-token"] });
    mockVerify.mockReturnValue({ sub: "user3" } as never);
    expect(await canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("array-token", "dev-secret");
  });

  it("should throw when format has wrong number of parts", async () => {
    const ctx = createMockContext({ authorization: "Bearer" });
    await expect(canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(canActivate(ctx)).rejects.toThrow(
      "Invalid Authorization format"
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("should throw when scheme is not Bearer", async () => {
    const ctx = createMockContext({ authorization: "Basic token" });
    await expect(canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(canActivate(ctx)).rejects.toThrow(
      "Invalid Authorization format"
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("should set req.user and return true when token is valid", async () => {
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: "Bearer valid-token" },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const payload = { sub: "user-id", email: "u@example.com" };
    mockVerify.mockReturnValue(payload as never);

    expect(await canActivate(ctx)).toBe(true);
    expect(req.user).toEqual(payload);
    expect(mockVerify).toHaveBeenCalledWith("valid-token", "dev-secret");
  });

  it("should use JWT_SECRET from env when set", async () => {
    process.env.JWT_SECRET = "custom-secret";
    const ctx = createMockContext({ authorization: "Bearer t" });
    mockVerify.mockReturnValue({} as never);
    await canActivate(ctx);
    expect(mockVerify).toHaveBeenCalledWith("t", "custom-secret");
  });

  it("should throw when token is invalid or expired", async () => {
    const ctx = createMockContext({ authorization: "Bearer bad-token" });
    mockVerify.mockImplementation(() => {
      throw new Error("invalid token");
    });
    await expect(canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(canActivate(ctx)).rejects.toThrow("Invalid or expired token");
  });

  it("should ensure user organization when Firebase token is valid", async () => {
    mockFirebase.isConfigured.mockReturnValue(true);
    mockFirebase.verifyIdToken.mockResolvedValue({
      uid: "firebase-uid",
      email: "firebase@example.com",
      name: "Firebase User",
    });
    const createdUser = { id: "db-user-id", email: "firebase@example.com", name: "Firebase User" };
    mockAuthService.findOrCreateUserByFirebase.mockResolvedValue(createdUser);
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: "Bearer firebase-id-token" },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    mockVerify.mockImplementation(() => {
      throw new Error("jwt invalid");
    });

    expect(await canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({ sub: createdUser.id, email: createdUser.email });
    expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(createdUser.id);
  });

  describe("SKIP_AUTH_DEV", () => {
    const devUser = { id: "dev-user-id", email: "dev@localhost" };

    it("should allow no token and set req.user when SKIP_AUTH_DEV and first user exists", async () => {
      process.env.SKIP_AUTH_DEV = "true";
      mockPrisma.user.findFirst.mockResolvedValue(devUser);
      const req: { headers: Record<string, string>; user?: unknown } = {
        headers: {},
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(await canActivate(ctx)).toBe(true);
      expect(req.user).toEqual({ sub: devUser.id, email: devUser.email });
      expect(mockVerify).not.toHaveBeenCalled();
      expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(
        devUser.id
      );
    });

    it("should allow invalid token and set req.user when SKIP_AUTH_DEV and user exists", async () => {
      process.env.SKIP_AUTH_DEV = "true";
      mockPrisma.user.findFirst.mockResolvedValue(devUser);
      mockVerify.mockImplementation(() => {
        throw new Error("invalid token");
      });
      const req: { headers: { authorization: string }; user?: unknown } = {
        headers: { authorization: "Bearer bad" },
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(await canActivate(ctx)).toBe(true);
      expect(req.user).toEqual({ sub: devUser.id, email: devUser.email });
      expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(
        devUser.id
      );
    });

    it("should use DEV_USER_ID when set", async () => {
      process.env.SKIP_AUTH_DEV = "true";
      process.env.DEV_USER_ID = "custom-dev-id";
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "custom-dev-id",
        email: "custom@dev.local",
      });
      const req: { headers: Record<string, string>; user?: unknown } = {
        headers: {},
      };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;

      expect(await canActivate(ctx)).toBe(true);
      expect(req.user).toEqual({
        sub: "custom-dev-id",
        email: "custom@dev.local",
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "custom-dev-id" },
        select: { id: true, email: true },
      });
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockAuthService.ensureUserOrganization).toHaveBeenCalledWith(
        "custom-dev-id"
      );
    });

    it("should throw when SKIP_AUTH_DEV but no user in DB", async () => {
      process.env.SKIP_AUTH_DEV = "true";
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const ctx = createMockContext({});

      await expect(canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      await expect(canActivate(ctx)).rejects.toThrow(
        "Missing Authorization header"
      );
    });
  });
});
