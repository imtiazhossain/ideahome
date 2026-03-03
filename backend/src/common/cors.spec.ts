import { getCorsOptions } from "./cors";

describe("getCorsOptions", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...origEnv };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it("returns options with origin function and credentials true", () => {
    const opts = getCorsOptions();
    expect(opts.credentials).toBe(true);
    expect(typeof opts.origin).toBe("function");
  });

  it("allows request when origin is undefined (same-origin/non-browser)", (done) => {
    const opts = getCorsOptions();
    (opts.origin as (o: undefined, cb: (e: Error | null, allow?: boolean) => void) => void)(
      undefined,
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      }
    );
  });

  it("allows localhost:3000 in non-production", (done) => {
    process.env.NODE_ENV = "development";
    const opts = getCorsOptions();
    (opts.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void)(
      "http://localhost:3000",
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      }
    );
  });

  it("allows origin from CORS_ORIGIN env", (done) => {
    process.env.NODE_ENV = "test";
    process.env.CORS_ORIGIN = "https://app.example.com, https://other.example.com";
    const opts = getCorsOptions();
    (opts.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void)(
      "https://app.example.com",
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      }
    );
  });

  it("allows LAN origin in non-production", (done) => {
    process.env.NODE_ENV = "development";
    const opts = getCorsOptions();
    (opts.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void)(
      "http://192.168.1.100:3000",
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      }
    );
  });

  it("denies unknown origin", (done) => {
    process.env.NODE_ENV = "test";
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const opts = getCorsOptions();
    (opts.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void)(
      "https://evil.com",
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(false);
        done();
      }
    );
  });

  it("in production returns origins without LAN regex", (done) => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGIN = "https://app.example.com";
    const opts = getCorsOptions();
    (opts.origin as (o: string, cb: (e: Error | null, allow?: boolean) => void) => void)(
      "https://app.example.com",
      (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      }
    );
  });
});
