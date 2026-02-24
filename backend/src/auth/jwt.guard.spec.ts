import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt.guard";
import * as jwt from "jsonwebtoken";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
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
    guard = new JwtAuthGuard();
    jest.clearAllMocks();
    delete process.env.JWT_SECRET;
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should throw when Authorization header is missing", () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Missing Authorization header"
    );
  });

  it("should use lowercase authorization header", () => {
    const ctx = createMockContext({ authorization: "Bearer token" });
    mockVerify.mockReturnValue({ sub: "user1" } as never);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("token", "dev-secret");
  });

  it("should use capitalized Authorization header", () => {
    const ctx = createMockContext({ Authorization: "Bearer token2" });
    mockVerify.mockReturnValue({ sub: "user2" } as never);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("token2", "dev-secret");
  });

  it("should use first element when authorization is an array", () => {
    const ctx = createMockContext({ authorization: ["Bearer array-token"] });
    mockVerify.mockReturnValue({ sub: "user3" } as never);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(mockVerify).toHaveBeenCalledWith("array-token", "dev-secret");
  });

  it("should throw when format has wrong number of parts", () => {
    const ctx = createMockContext({ authorization: "Bearer" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Invalid Authorization format"
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("should throw when scheme is not Bearer", () => {
    const ctx = createMockContext({ authorization: "Basic token" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Invalid Authorization format"
    );
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("should set req.user and return true when token is valid", () => {
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: "Bearer valid-token" },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const payload = { sub: "user-id", email: "u@example.com" };
    mockVerify.mockReturnValue(payload as never);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toEqual(payload);
    expect(mockVerify).toHaveBeenCalledWith("valid-token", "dev-secret");
  });

  it("should use JWT_SECRET from env when set", () => {
    process.env.JWT_SECRET = "custom-secret";
    const ctx = createMockContext({ authorization: "Bearer t" });
    mockVerify.mockReturnValue({} as never);
    guard.canActivate(ctx);
    expect(mockVerify).toHaveBeenCalledWith("t", "custom-secret");
  });

  it("should throw when token is invalid or expired", () => {
    const ctx = createMockContext({ authorization: "Bearer bad-token" });
    mockVerify.mockImplementation(() => {
      throw new Error("invalid token");
    });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow("Invalid or expired token");
  });
});
