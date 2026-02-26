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

  it("returns dev-secret in development/test/unspecified env", () => {
    process.env.NODE_ENV = "development";
    expect(getJwtSecret()).toBe("dev-secret");
    process.env.NODE_ENV = "test";
    expect(getJwtSecret()).toBe("dev-secret");
    delete process.env.NODE_ENV;
    expect(getJwtSecret()).toBe("dev-secret");
  });

  it("throws when JWT_SECRET is missing outside development/test", () => {
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow(
      "JWT_SECRET is required outside development/test"
    );
  });
});
