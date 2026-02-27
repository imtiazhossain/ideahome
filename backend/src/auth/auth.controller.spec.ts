import { Test, TestingModule } from "@nestjs/testing";
import { __setUserinfoResponse } from "openid-client";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { FirebaseService } from "./firebase.service";

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

function getStateFromRedirect(): string {
  const redirectTo = mockRedirect.mock.calls.at(-1)?.[0] as string | undefined;
  if (!redirectTo) throw new Error("Missing redirect URL");
  return new URL(redirectTo).searchParams.get("state") ?? "";
}

describe("AuthController", () => {
  let controller: AuthController;

  const mockAuthService = {
    createState: jest.fn(),
    consumeState: jest.fn(),
    getRedirectUri: jest.fn(),
    getFrontendCallbackUrl: jest.fn(),
    findOrCreateUserBySso: jest.fn(),
    findOrCreateUserByFirebase: jest.fn(),
    ensureUserOrganization: jest.fn().mockResolvedValue(undefined),
    signToken: jest.fn(),
    exchangeGoogleCode: jest.fn(),
    exchangeGitHubCode: jest.fn(),
    exchangeAppleCode: jest.fn(),
  };

  const mockFirebase = {
    isConfigured: jest.fn().mockReturnValue(false),
    verifyIdToken: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFirebase.isConfigured.mockReturnValue(false);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: FirebaseService, useValue: mockFirebase },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("providers", () => {
    it("should return provider availability from env", () => {
      const prev = {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
        APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
        APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
        APPLE_KEY_ID: process.env.APPLE_KEY_ID,
        APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY,
      };
      try {
        process.env.GOOGLE_CLIENT_ID = "google-id";
        process.env.GOOGLE_CLIENT_SECRET = "google-secret";
        process.env.GITHUB_CLIENT_ID = "github-id";
        process.env.GITHUB_CLIENT_SECRET = "";
        process.env.APPLE_CLIENT_ID = "apple-client-id";
        process.env.APPLE_TEAM_ID = "apple-team-id";
        process.env.APPLE_KEY_ID = "apple-key-id";
        process.env.APPLE_PRIVATE_KEY = "apple-private-key";

        expect(controller.providers()).toEqual({
          google: true,
          github: false,
          apple: true,
        });
      } finally {
        process.env.GOOGLE_CLIENT_ID = prev.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = prev.GOOGLE_CLIENT_SECRET;
        process.env.GITHUB_CLIENT_ID = prev.GITHUB_CLIENT_ID;
        process.env.GITHUB_CLIENT_SECRET = prev.GITHUB_CLIENT_SECRET;
        process.env.APPLE_CLIENT_ID = prev.APPLE_CLIENT_ID;
        process.env.APPLE_TEAM_ID = prev.APPLE_TEAM_ID;
        process.env.APPLE_KEY_ID = prev.APPLE_KEY_ID;
        process.env.APPLE_PRIVATE_KEY = prev.APPLE_PRIVATE_KEY;
      }
    });
  });

  describe("login", () => {
    it("should redirect to authorization URL", async () => {
      const res = mockRes();
      await controller.login(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("https://mock-auth.example/authorize")
      );
    });
  });

  describe("callback", () => {
    it("should return 400 when code or state is missing", async () => {
      const res = mockRes();
      await controller.callback(res as any, {});
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Missing code or state",
      });
    });

    it("should return 400 when code or state is blank", async () => {
      const res = mockRes();
      await controller.callback(res as any, { code: "   ", state: "state" });
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Missing code or state",
      });
    });
    it("should return token and user when userinfo has email", async () => {
      __setUserinfoResponse({
        sub: "oidc-sub-1",
        email: "mock@example.com",
        name: "Mock User",
      });
      const user = {
        id: "user-1",
        email: "mock@example.com",
        name: "Mock User",
      };
      mockAuthService.findOrCreateUserBySso.mockResolvedValue(user);

      const loginRes = mockRes();
      await controller.login(loginRes as any);
      const state = getStateFromRedirect();
      const res = mockRes();
      await controller.callback(res as any, {
        code: "code",
        state,
      });

      expect(mockAuthService.findOrCreateUserBySso).toHaveBeenCalledWith(
        "oidc",
        {
          providerId: "oidc-sub-1",
          email: "mock@example.com",
          name: "Mock User",
        }
      );
      expect(mockAuthService.signToken).toHaveBeenCalledWith({
        id: "user-1",
        email: "mock@example.com",
        name: "Mock User",
      });
      expect(mockJson).toHaveBeenCalled();
      const payload = mockJson.mock.calls[0][0];
      expect(payload).toHaveProperty("token");
      expect(payload).toHaveProperty("user", user);
    });

    it("should pass undefined name when userinfo has email but no name", async () => {
      __setUserinfoResponse({ sub: "oidc-sub-2", email: "nobody@example.com" });
      const user = { id: "user-2", email: "nobody@example.com", name: null };
      mockAuthService.findOrCreateUserBySso.mockResolvedValue(user);

      const loginRes = mockRes();
      await controller.login(loginRes as any);
      const state = getStateFromRedirect();
      const res = mockRes();
      await controller.callback(res as any, {
        code: "code",
        state,
      });

      expect(mockAuthService.findOrCreateUserBySso).toHaveBeenCalledWith(
        "oidc",
        {
          providerId: "oidc-sub-2",
          email: "nobody@example.com",
          name: null,
        }
      );
    });

    it("should coerce non-string userinfo name to null", async () => {
      __setUserinfoResponse({
        sub: "oidc-sub-3",
        email: "n3@example.com",
        name: 123 as unknown as string,
      });
      const user = { id: "user-3", email: "n3@example.com", name: null };
      mockAuthService.findOrCreateUserBySso.mockResolvedValue(user);

      const loginRes = mockRes();
      await controller.login(loginRes as any);
      const state = getStateFromRedirect();
      const res = mockRes();
      await controller.callback(res as any, {
        code: "code",
        state,
      });

      expect(mockAuthService.findOrCreateUserBySso).toHaveBeenCalledWith(
        "oidc",
        {
          providerId: "oidc-sub-3",
          email: "n3@example.com",
          name: null,
        }
      );
    });

    it("should return 400 when userinfo has no email", async () => {
      __setUserinfoResponse({});
      const res = mockRes();
      await controller.login(res as any);
      const state = getStateFromRedirect();
      await controller.callback(res as any, {
        code: "code",
        state,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No email in userinfo" });
      __setUserinfoResponse({
        sub: "oidc-sub",
        email: "mock@example.com",
        name: "Mock User",
      });
    });

    it("should return 400 when userinfo email is not a string", async () => {
      __setUserinfoResponse({
        sub: "oidc-sub",
        email: 123 as unknown as string,
        name: "Mock User",
      });
      const res = mockRes();
      await controller.login(res as any);
      const state = getStateFromRedirect();
      await controller.callback(res as any, {
        code: "code",
        state,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No email in userinfo" });
      __setUserinfoResponse({
        sub: "oidc-sub",
        email: "mock@example.com",
        name: "Mock User",
      });
    });

    it("should return 400 when userinfo has no sub", async () => {
      __setUserinfoResponse({ email: "mock@example.com", name: "Mock User" });
      const res = mockRes();
      await controller.login(res as any);
      const state = getStateFromRedirect();
      await controller.callback(res as any, {
        code: "code",
        state,
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "No sub in userinfo" });
      __setUserinfoResponse({
        sub: "oidc-sub",
        email: "mock@example.com",
        name: "Mock User",
      });
    });

    it("should return 400 when OIDC state is invalid", async () => {
      const res = mockRes();
      await controller.callback(res as any, {
        code: "code",
        state: "invalid",
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Invalid or expired state",
      });
    });

    it("should return 400 when OIDC state iat is too far in the future", async () => {
      const realNow = Date.now;
      try {
        const t0 = 1_700_000_000_000;
        Date.now = jest.fn(() => t0);
        const res = mockRes();
        await controller.login(res as any);
        const state = getStateFromRedirect();
        Date.now = jest.fn(() => t0 - 120_000);
        await controller.callback(res as any, { code: "code", state });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Invalid or expired state",
        });
      } finally {
        Date.now = realNow;
      }
    });
  });

  describe("google", () => {
    it("should redirect to Google when configured", async () => {
      process.env.GOOGLE_CLIENT_ID = "gid";
      process.env.GOOGLE_CLIENT_SECRET = "gsecret";
      mockAuthService.createState.mockReturnValue("state-123");
      mockAuthService.getRedirectUri.mockReturnValue(
        "http://localhost:3001/auth/google/callback"
      );
      const res = mockRes();
      await controller.google(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("accounts.google.com")
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("state=state-123")
      );
    });

    it("should redirect with error when GOOGLE_CLIENT_ID is not set", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const res = mockRes();
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      await controller.google(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("error=")
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("Google%20SSO%20is%20not%20configured")
      );
    });

    it("should redirect with error when GOOGLE_CLIENT_SECRET is not set", async () => {
      process.env.GOOGLE_CLIENT_ID = "gid";
      delete process.env.GOOGLE_CLIENT_SECRET;
      const res = mockRes();
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      await controller.google(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("error=")
      );
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("Google%20SSO%20is%20not%20configured")
      );
    });
  });

  describe("googleCallback", () => {
    it("should redirect with token on success", async () => {
      mockAuthService.consumeState.mockReturnValue("google");
      mockAuthService.exchangeGoogleCode.mockResolvedValue({
        providerId: "g1",
        email: "u@x.com",
        name: "User",
      });
      mockAuthService.findOrCreateUserBySso.mockResolvedValue({
        id: "u1",
        email: "u@x.com",
        name: "User",
      });
      mockAuthService.signToken.mockReturnValue("jwt-token");
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback#token=jwt-token"
      );
      const res = mockRes();
      await controller.googleCallback(res as any, "code", "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        "http://localhost:3000/login/callback#token=jwt-token"
      );
    });

    it("should redirect with error when state invalid", async () => {
      mockAuthService.consumeState.mockReturnValue(null);
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.googleCallback(res as any, "code", "bad-state");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("invalid_callback")
      );
    });

    it("should redirect with error when exchangeCode throws", async () => {
      mockAuthService.consumeState.mockReturnValue("google");
      mockAuthService.exchangeGoogleCode.mockRejectedValue(
        new Error("OAuth failed")
      );
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.googleCallback(res as any, "code", "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("sso_callback_failed")
      );
    });

    it("should redirect with error when code is not a string", async () => {
      mockAuthService.consumeState.mockReturnValue("google");
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.googleCallback(res as any, 123 as any, "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("invalid_callback")
      );
      expect(mockAuthService.exchangeGoogleCode).not.toHaveBeenCalled();
    });
  });

  describe("github", () => {
    it("should redirect to GitHub when configured", async () => {
      process.env.GITHUB_CLIENT_ID = "ghid";
      mockAuthService.createState.mockReturnValue("state-gh");
      mockAuthService.getRedirectUri.mockReturnValue(
        "http://localhost:3001/auth/github/callback"
      );
      const res = mockRes();
      await controller.github(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("github.com")
      );
    });

    it("should redirect with error when GITHUB_CLIENT_ID not set", async () => {
      delete process.env.GITHUB_CLIENT_ID;
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.github(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("GitHub%20SSO")
      );
    });
  });

  describe("githubCallback", () => {
    it("should redirect with token on success", async () => {
      mockAuthService.consumeState.mockReturnValue("github");
      mockAuthService.exchangeGitHubCode.mockResolvedValue({
        providerId: "gh1",
        email: "u@gh.com",
        name: "GH User",
      });
      mockAuthService.findOrCreateUserBySso.mockResolvedValue({
        id: "u1",
        email: "u@gh.com",
        name: "GH User",
      });
      mockAuthService.signToken.mockReturnValue("jwt");
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback#token=jwt"
      );
      const res = mockRes();
      await controller.githubCallback(res as any, "code", "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        "http://localhost:3000/login/callback#token=jwt"
      );
    });

    it("should redirect with error when code is blank", async () => {
      mockAuthService.consumeState.mockReturnValue("github");
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.githubCallback(res as any, "   ", "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("invalid_callback")
      );
      expect(mockAuthService.exchangeGitHubCode).not.toHaveBeenCalled();
    });
  });

  describe("apple", () => {
    it("should redirect to Apple when configured", async () => {
      process.env.APPLE_CLIENT_ID = "aid";
      mockAuthService.createState.mockReturnValue("state-apple");
      mockAuthService.getRedirectUri.mockReturnValue(
        "http://localhost:3001/auth/apple/callback"
      );
      const res = mockRes();
      await controller.apple(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("appleid.apple.com")
      );
    });

    it("should redirect with error when APPLE_CLIENT_ID not set", async () => {
      delete process.env.APPLE_CLIENT_ID;
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.apple(res as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("Apple%20SSO")
      );
    });
  });

  describe("appleCallback", () => {
    it("should redirect with token on success", async () => {
      mockAuthService.consumeState.mockReturnValue("apple");
      mockAuthService.exchangeAppleCode.mockResolvedValue({
        providerId: "apple1",
        email: "u@apple.com",
        name: null,
      });
      mockAuthService.findOrCreateUserBySso.mockResolvedValue({
        id: "u1",
        email: "u@apple.com",
        name: null,
      });
      mockAuthService.signToken.mockReturnValue("jwt");
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback#token=jwt"
      );
      const res = mockRes();
      await controller.appleCallback(res as any, "code", "state");
      expect(mockRedirect).toHaveBeenCalledWith(
        "http://localhost:3000/login/callback#token=jwt"
      );
    });

    it("should redirect with error when state is not a string", async () => {
      mockAuthService.consumeState.mockReturnValue(null);
      mockAuthService.getFrontendCallbackUrl.mockReturnValue(
        "http://localhost:3000/login/callback"
      );
      const res = mockRes();
      await controller.appleCallback(res as any, "code", 123 as any);
      expect(mockRedirect).toHaveBeenCalledWith(
        expect.stringContaining("invalid_callback")
      );
      expect(mockAuthService.exchangeAppleCode).not.toHaveBeenCalled();
    });
  });

  describe("firebase-session", () => {
    it("should return 400 when idToken is missing", async () => {
      const res = mockRes();
      await controller.firebaseSession(res as any, "");
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: "idToken required" });
    });

    it("should return 400 when idToken is whitespace", async () => {
      const res = mockRes();
      await controller.firebaseSession(res as any, "   ");
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: "idToken required" });
      expect(mockFirebase.verifyIdToken).not.toHaveBeenCalled();
    });

    it("should return 503 when Firebase is not configured", async () => {
      mockFirebase.isConfigured.mockReturnValue(false);
      const res = mockRes();
      await controller.firebaseSession(res as any, "firebase-id-token");
      expect(mockStatus).toHaveBeenCalledWith(503);
      expect(mockJson).toHaveBeenCalledWith({
        error:
          "Firebase is not configured. Set FIREBASE_PROJECT_ID and credentials.",
      });
    });

    it("should return 401 when Firebase token is invalid", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue(null);
      const res = mockRes();
      await controller.firebaseSession(res as any, "bad-token");
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid or expired Firebase token",
      });
    });

    it("should return 400 when Firebase token has no email", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue({
        uid: "firebase-uid",
        email: "",
        name: "User",
      });
      const res = mockRes();
      await controller.firebaseSession(res as any, "token");
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Firebase token missing email",
      });
    });

    it("should return 400 when Firebase token email is not a string", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue({
        uid: "firebase-uid",
        email: 123,
        name: "User",
      });
      const res = mockRes();
      await controller.firebaseSession(res as any, "token");
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Firebase token missing email",
      });
    });

    it("should return token and user when Firebase token is valid", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue({
        uid: "firebase-uid-1",
        email: "fire@example.com",
        name: "Fire User",
      });
      const user = {
        id: "our-user-1",
        email: "fire@example.com",
        name: "Fire User",
      };
      mockAuthService.findOrCreateUserByFirebase.mockResolvedValue(user);
      mockAuthService.signToken.mockReturnValue("our-jwt");
      const res = mockRes();
      await controller.firebaseSession(res as any, "valid-firebase-token");
      expect(mockAuthService.findOrCreateUserByFirebase).toHaveBeenCalledWith(
        "firebase-uid-1",
        "fire@example.com",
        "Fire User"
      );
      expect(mockJson).toHaveBeenCalledWith({
        token: "our-jwt",
        user: { id: user.id, email: user.email, name: user.name },
      });
    });

    it("should coerce non-string Firebase name to null", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue({
        uid: "firebase-uid-2",
        email: "fire2@example.com",
        name: 123,
      });
      mockAuthService.findOrCreateUserByFirebase.mockResolvedValue({
        id: "u2",
        email: "fire2@example.com",
        name: null,
      });
      mockAuthService.signToken.mockReturnValue("jwt-2");
      const res = mockRes();

      await controller.firebaseSession(res as any, "valid-firebase-token");
      expect(mockAuthService.findOrCreateUserByFirebase).toHaveBeenCalledWith(
        "firebase-uid-2",
        "fire2@example.com",
        null
      );
    });

    it("should trim idToken before verifying", async () => {
      mockFirebase.isConfigured.mockReturnValue(true);
      mockFirebase.verifyIdToken.mockResolvedValue(null);
      const res = mockRes();
      await controller.firebaseSession(res as any, "  token-with-space  ");
      expect(mockFirebase.verifyIdToken).toHaveBeenCalledWith(
        "token-with-space"
      );
    });
  });
});
