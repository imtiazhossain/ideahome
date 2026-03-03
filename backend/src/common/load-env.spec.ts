import { loadEnvFromFileSystem } from "./load-env";

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const fs = jest.requireMock("fs") as {
  existsSync: jest.Mock;
  readFileSync: jest.Mock;
};

describe("loadEnvFromFileSystem", () => {
  const origEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...origEnv };
  });

  afterAll(() => {
    process.env = origEnv;
  });

  it("does nothing in production when ALLOW_FILE_ENV_IN_PROD is not set", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_FILE_ENV_IN_PROD;
    loadEnvFromFileSystem();
    expect(fs.existsSync).not.toHaveBeenCalled();
  });

  it("loads .env in production when ALLOW_FILE_ENV_IN_PROD is true", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_FILE_ENV_IN_PROD = "true";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("FOO=bar\nBAZ=qux");
    loadEnvFromFileSystem();
    expect(fs.existsSync).toHaveBeenCalled();
    expect(process.env.FOO).toBe("bar");
    expect(process.env.BAZ).toBe("qux");
  });

  it("skips lines that are empty or comments", () => {
    process.env.NODE_ENV = "development";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("\n# comment\n\nKEY=val\n");
    loadEnvFromFileSystem();
    expect(process.env.KEY).toBe("val");
  });

  it("does not override existing env vars", () => {
    process.env.NODE_ENV = "development";
    process.env.EXISTING = "already-set";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("EXISTING=new-value");
    loadEnvFromFileSystem();
    expect(process.env.EXISTING).toBe("already-set");
  });

  it("strips double quotes from values", () => {
    process.env.NODE_ENV = "development";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('QUOTED="hello world"');
    loadEnvFromFileSystem();
    expect(process.env.QUOTED).toBe("hello world");
  });

  it("strips single quotes from values", () => {
    process.env.NODE_ENV = "development";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("SINGLE='hello'");
    loadEnvFromFileSystem();
    expect(process.env.SINGLE).toBe("hello");
  });

  it("skips line when key is empty or env already set", () => {
    process.env.NODE_ENV = "development";
    process.env.EXISTING = "set";
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue("=no_key\nEXISTING=overwrite");
    loadEnvFromFileSystem();
    expect(process.env.EXISTING).toBe("set");
  });

  it("returns early when no candidate path exists", () => {
    process.env.NODE_ENV = "development";
    fs.existsSync.mockReturnValue(false);
    loadEnvFromFileSystem();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });
});
