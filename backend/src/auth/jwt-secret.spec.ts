import { getJwtSecret } from "./jwt-secret";

describe("getJwtSecret", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns JWT_SECRET when configured", () => {
    process.env.JWT_SECRET = "custom-secret";
    process.env.NODE_ENV = "production";
    expect(getJwtSecret()).toBe("custom-secret");
  });

  it("returns test-jwt-secret in test env", () => {
    process.env.NODE_ENV = "test";
    expect(getJwtSecret()).toBe("test-jwt-secret");
  });

  it("returns dev-secret only when insecure dev fallback is enabled", () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_INSECURE_JWT_SECRET_DEV = "true";
    expect(getJwtSecret()).toBe("dev-secret");

    delete process.env.NODE_ENV;
    expect(getJwtSecret()).toBe("dev-secret");
  });

  it("throws when JWT_SECRET is missing and no fallback is allowed", () => {
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow("JWT_SECRET is required");
  });
});
