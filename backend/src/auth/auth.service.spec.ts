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
      create: jest
        .fn()
        .mockResolvedValue({ id: "org-1", name: "My Workspace" }),
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
    it("includes token in fragment when provided", () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      expect(service.getFrontendCallbackUrl("jwt-here")).toBe(
        "https://app.example.com/login/callback#token=jwt-here"
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
    it("returns null for unknown or invalid state", () => {
      expect(service.consumeState("unknown-state")).toBeNull();
      expect(service.consumeState("")).toBeNull();
      expect(service.consumeState("no-dot")).toBeNull();
    });
    it("returns null for tampered state", () => {
      const state = service.createState("google");
      const tampered = state.slice(0, -2) + "xx";
      expect(service.consumeState(tampered)).toBeNull();
    });

    it("returns null when signature length is invalid", () => {
      const state = service.createState("github");
      const [payload] = state.split(".");
      expect(service.consumeState(`${payload}.x`)).toBeNull();
    });

    it("returns null for state issued too far in the future", () => {
      const realNow = Date.now;
      try {
        const t0 = 1_700_000_000_000;
        Date.now = jest.fn(() => t0);
        const state = service.createState("google");
        Date.now = jest.fn(() => t0 - 120_000);
        expect(service.consumeState(state)).toBeNull();
      } finally {
        Date.now = realNow;
      }
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

  describe("ensureUserOrganization", () => {
    it("returns user when already has organizationId", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "u1",
        email: "u@x.com",
        name: "User",
        organizationId: "org-1",
      });

      const result = await service.ensureUserOrganization("u1");
      expect(result).toEqual({
        id: "u1",
        email: "u@x.com",
        name: "User",
        organizationId: "org-1",
      });
      expect(mockPrisma.organization.create).not.toHaveBeenCalled();
    });

    it("creates org and updates user when organizationId is null", async () => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: "u1",
        email: "u@x.com",
        name: "User",
        organizationId: null,
      });
      mockPrisma.organization.create.mockResolvedValue({
        id: "new-org",
        name: "My Workspace",
      });
      mockPrisma.user.update.mockResolvedValue({
        id: "u1",
        organizationId: "new-org",
      });

      const result = await service.ensureUserOrganization("u1");
      expect(result.organizationId).toBe("new-org");
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: { name: "My Workspace" },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { organizationId: "new-org" },
      });
    });
  });

  describe("exchangeGoogleCode", () => {
    const origFetch = global.fetch;
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = "gid";
      process.env.GOOGLE_CLIENT_SECRET = "gsecret";
    });
    afterEach(() => {
      global.fetch = origFetch;
    });

    it("returns profile when token and userinfo succeed", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "google-123",
              email: "u@example.com",
              name: "User Name",
            }),
        } as Response);

      const result = await service.exchangeGoogleCode("code");
      expect(result).toEqual({
        providerId: "google-123",
        email: "u@example.com",
        name: "User Name",
      });
    });

    it("throws when env vars missing", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      await expect(service.exchangeGoogleCode("code")).rejects.toThrow(
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required"
      );
    });

    it("throws when no access_token from token response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
      await expect(service.exchangeGoogleCode("code")).rejects.toThrow(
        "No access_token from Google"
      );
    });

    it("throws when userinfo fails", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({ ok: false } as Response);
      await expect(service.exchangeGoogleCode("code")).rejects.toThrow(
        "Google userinfo failed"
      );
    });

    it("throws when profile missing email", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "g1", name: "User" }),
        } as Response);
      await expect(service.exchangeGoogleCode("code")).rejects.toThrow(
        "Google profile missing email"
      );
    });
  });

  describe("exchangeGitHubCode", () => {
    const origFetch = global.fetch;
    beforeEach(() => {
      process.env.GITHUB_CLIENT_ID = "ghid";
      process.env.GITHUB_CLIENT_SECRET = "ghsecret";
    });
    afterEach(() => {
      global.fetch = origFetch;
    });

    it("returns profile when user has email", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 456,
              login: "user",
              email: "u@gh.com",
              name: "GitHub User",
            }),
        } as Response);

      const result = await service.exchangeGitHubCode("code");
      expect(result).toEqual({
        providerId: "456",
        email: "u@gh.com",
        name: "GitHub User",
      });
    });

    it("fetches emails when user has no email", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ id: 789, login: "nouser", email: null }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve([
              { email: "primary@gh.com", primary: true },
              { email: "other@gh.com", primary: false },
            ]),
        } as Response);

      const result = await service.exchangeGitHubCode("code");
      expect(result.email).toBe("primary@gh.com");
    });

    it("throws when env vars missing", async () => {
      delete process.env.GITHUB_CLIENT_ID;
      await expect(service.exchangeGitHubCode("code")).rejects.toThrow(
        "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET required"
      );
    });

    it("throws when no access_token", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
      await expect(service.exchangeGitHubCode("code")).rejects.toThrow(
        "No access_token from GitHub"
      );
    });

    it("throws when user API fails", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({ ok: false } as Response);
      await expect(service.exchangeGitHubCode("code")).rejects.toThrow(
        "GitHub user API failed"
      );
    });

    it("throws when profile missing email", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at" }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1, login: "x", email: null }),
        } as Response)
        .mockResolvedValueOnce({ ok: false } as Response);
      await expect(service.exchangeGitHubCode("code")).rejects.toThrow(
        "GitHub profile missing email"
      );
    });
  });

  describe("exchangeAppleCode", () => {
    const origFetch = global.fetch;
    const jwtMod = require("jsonwebtoken");
    beforeEach(() => {
      process.env.APPLE_CLIENT_ID = "aid";
      process.env.APPLE_TEAM_ID = "tid";
      process.env.APPLE_KEY_ID = "kid";
      process.env.APPLE_PRIVATE_KEY = "fake-key";
      jest.spyOn(jwtMod, "sign").mockReturnValue("mock-client-secret" as never);
      jest.spyOn(jwtMod, "verify").mockImplementation((...args: unknown[]) => {
        const cb = args[3];
        if (typeof cb === "function") {
          (cb as (err: unknown, decoded?: unknown) => void)(null, {
            sub: "apple-sub-123",
          });
        }
        return { sub: "apple-sub-123" } as never;
      });
    });
    afterEach(() => {
      global.fetch = origFetch;
      jest.restoreAllMocks();
    });

    it("returns profile with privaterelay email when payload has no email", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id_token: "mock-apple-id-token" }),
      } as Response);

      const result = await service.exchangeAppleCode("code");
      expect(result.providerId).toBe("apple-sub-123");
      expect(result.email).toContain("privaterelay.appleid.com");
      expect(result.name).toBeNull();
    });

    it("throws when Invalid Apple id_token", async () => {
      jest.spyOn(jwtMod, "verify").mockImplementation((...args: unknown[]) => {
        const cb = args[3];
        if (typeof cb === "function") {
          (cb as (err: unknown, decoded?: unknown) => void)(
            new Error("invalid"),
            undefined
          );
        }
        return undefined as never;
      });
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id_token: "bad-token" }),
      } as Response);
      await expect(service.exchangeAppleCode("code")).rejects.toThrow(
        "invalid"
      );
    });

    it("throws when env vars missing", async () => {
      delete process.env.APPLE_CLIENT_ID;
      await expect(service.exchangeAppleCode("code")).rejects.toThrow(
        "APPLE_CLIENT_ID"
      );
    });

    it("throws when no id_token from Apple", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);
      await expect(service.exchangeAppleCode("code")).rejects.toThrow(
        "No id_token from Apple"
      );
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

    it("findOrCreateUserByFirebase delegates to findOrCreateUserBySso", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      const newUser = {
        id: "firebase-user",
        email: "fb@example.com",
        name: "FB User",
      };
      mockPrisma.user.create.mockResolvedValue(newUser);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        ...newUser,
        organizationId: "org-1",
      });
      mockPrisma.account.create.mockResolvedValue({});

      const result = await service.findOrCreateUserByFirebase(
        "firebase-uid",
        "fb@example.com",
        "FB User"
      );

      expect(result).toEqual(newUser);
      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerId: {
            provider: "firebase",
            providerId: "firebase-uid",
          },
        },
        include: { user: true },
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

    it("throws when providerId is missing", async () => {
      await expect(
        service.findOrCreateUserBySso("google", {
          providerId: "   ",
          email: "user@example.com",
        })
      ).rejects.toThrow("SSO profile missing providerId");
      expect(mockPrisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("throws when email is missing", async () => {
      await expect(
        service.findOrCreateUserBySso("google", {
          providerId: "g1",
          email: "   ",
        })
      ).rejects.toThrow("SSO profile missing email");
      expect(mockPrisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("throws when name type is invalid", async () => {
      await expect(
        service.findOrCreateUserBySso("google", {
          providerId: "g1",
          email: "user@example.com",
          name: 123 as unknown as string,
        })
      ).rejects.toThrow("SSO profile name must be a string or null");
      expect(mockPrisma.account.findUnique).not.toHaveBeenCalled();
    });

    it("trims providerId/email and normalizes blank name to null", async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      const newUser = {
        id: "user-new",
        email: "new@example.com",
        name: null,
      };
      mockPrisma.user.create.mockResolvedValue(newUser);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        ...newUser,
        organizationId: "org-1",
      });
      mockPrisma.account.create.mockResolvedValue({});

      await service.findOrCreateUserBySso("github", {
        providerId: "  gh-123  ",
        email: "  new@example.com  ",
        name: "   ",
      });

      expect(mockPrisma.account.findUnique).toHaveBeenCalledWith({
        where: {
          provider_providerId: {
            provider: "github",
            providerId: "gh-123",
          },
        },
        include: { user: true },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          name: undefined,
        },
      });
    });
  });
});
