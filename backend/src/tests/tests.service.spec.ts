import { Test, TestingModule } from "@nestjs/testing";
import {
  TestsService,
  RunUiTestResult,
  RunApiTestResult,
} from "./tests.service";

const mockSpawn = jest.fn();

jest.mock("child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

jest.mock("fs/promises", () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rm: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock("fs", () => {
  const actual = jest.requireActual<typeof import("fs")>("fs");
  return { ...actual, readFileSync: jest.fn() };
});

const fsPromises =
  jest.requireMock<typeof import("fs/promises")>("fs/promises");
const fsSync = jest.requireMock<typeof import("fs")>("fs");

describe("TestsService", () => {
  let service: TestsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
    (fsPromises.readFile as jest.Mock).mockResolvedValue(Buffer.from("video"));
    (fsPromises.rm as jest.Mock).mockResolvedValue(undefined);
    (fsPromises.unlink as jest.Mock).mockResolvedValue(undefined);
    (fsSync.readFileSync as jest.Mock).mockReturnValue("{}");

    const module: TestingModule = await Test.createTestingModule({
      providers: [TestsService],
    }).compile();

    service = module.get<TestsService>(TestsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("runUiTestStream", () => {
    it("should emit error and complete when grep is empty", (done) => {
      const events: unknown[] = [];
      const sub = service.runUiTestStream("").subscribe({
        next: (e) => events.push(JSON.parse((e as { data: string }).data)),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0]).toEqual({ type: "error", data: "Missing grep" });
          done();
        },
      });
      sub.unsubscribe();
    });

    it("should emit error when grep is only whitespace", (done) => {
      const events: unknown[] = [];
      service.runUiTestStream("   ").subscribe({
        next: (e) => events.push(JSON.parse((e as { data: string }).data)),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0]).toEqual({ type: "error", data: "Missing grep" });
          done();
        },
      });
    });

    it("should emit error when grep exceeds max length", (done) => {
      const events: unknown[] = [];
      service.runUiTestStream("x".repeat(301)).subscribe({
        next: (e) => events.push(JSON.parse((e as { data: string }).data)),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0]).toEqual({
            type: "error",
            data: "grep exceeds 300 characters",
          });
          done();
        },
      });
    });

    it("should spawn, then emit result on close with success and video when code 0", (done) => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => {
        const child = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn(
            (
              ev: string,
              fn: (code: number | null, signal: string | null) => void
            ) => {
              if (ev === "close") closeHandler = fn;
            }
          ),
          kill: jest.fn(),
        };
        return child;
      });

      (fsPromises.readdir as jest.Mock).mockResolvedValue([
        { name: "run.webm", isDirectory: () => false },
      ]);
      (fsSync.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          suites: [
            {
              specs: [
                {
                  tests: [
                    {
                      results: [{ steps: [{ title: "step1", duration: 100 }] }],
                    },
                  ],
                },
              ],
            },
          ],
        })
      );

      const events: unknown[] = [];
      service.runUiTestStream("some test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          events.push(parsed);
          if (parsed.type === "result") {
            expect(parsed.data.success).toBe(true);
            expect(parsed.data.exitCode).toBe(0);
            expect(parsed.data.videoBase64).toBe(
              Buffer.from("video").toString("base64")
            );
            expect(parsed.data.steps).toEqual([
              { title: "step1", duration: 100 },
            ]);
            done();
          }
        },
        complete: () => {},
      });

      setImmediate(() => {
        closeHandler!(0, null);
      });
    });

    it("should call cleanup on unsubscribe", (done) => {
      const killFn = jest.fn();
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: killFn,
      }));

      const sub = service.runUiTestStream("test").subscribe();
      setImmediate(() => {
        sub.unsubscribe();
        expect(killFn).toHaveBeenCalledWith("SIGTERM");
        done();
      });
    });

    it("should emit log events for stdout and stderr data and include in result", (done) => {
      let stdoutDataFn: (d: Buffer) => void;
      let stderrDataFn: (d: Buffer) => void;
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((ev: string, fn: (d: Buffer) => void) => {
            if (ev === "data") stdoutDataFn = fn;
          }),
        },
        stderr: {
          on: jest.fn((ev: string, fn: (d: Buffer) => void) => {
            if (ev === "data") stderrDataFn = fn;
          }),
        },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));

      (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
      const events: unknown[] = [];
      service.runUiTestStream("test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          events.push(parsed);
          if (parsed.type === "result") {
            expect(parsed.data.output).toBe("stdout line\n");
            expect(parsed.data.errorOutput).toBe("stderr line\n");
            done();
          }
        },
        complete: () => {},
      });

      setImmediate(() => {
        stdoutDataFn(Buffer.from("stdout line\n"));
        stderrDataFn(Buffer.from("stderr line\n"));
        closeHandler!(0, null);
      });
    });

    it("should emit error when writeFile throws before spawn", (done) => {
      (fsPromises.writeFile as jest.Mock).mockRejectedValue(
        new Error("write failed")
      );
      const events: unknown[] = [];
      service.runUiTestStream("test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          expect(parsed.type).toBe("error");
          expect(parsed.data).toContain("write failed");
          done();
        },
        complete: () => {},
      });
    });

    it("should include result without video when findFirstWebm returns path but readFile fails", (done) => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock).mockResolvedValue([
        { name: "x.webm", isDirectory: () => false },
      ]);
      (fsPromises.readFile as jest.Mock).mockRejectedValue(
        new Error("read failed")
      );

      service.runUiTestStream("test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          if (parsed.type === "result") {
            expect(parsed.data.success).toBe(true);
            expect(parsed.data.videoBase64).toBeUndefined();
            done();
          }
        },
        complete: () => {},
      });
      setImmediate(() => closeHandler!(0, null));
    });

    it("should use nested steps from report when present", (done) => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
      (fsSync.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          suites: [
            {
              specs: [
                {
                  tests: [
                    {
                      results: [
                        {
                          steps: [
                            {
                              title: "outer",
                              duration: 10,
                              steps: [{ title: "inner", duration: 5 }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        })
      );

      service.runUiTestStream("test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          if (parsed.type === "result") {
            expect(parsed.data.steps).toEqual([
              { title: "outer", duration: 10 },
              { title: "inner", duration: 5 },
            ]);
            done();
          }
        },
        complete: () => {},
      });
      setImmediate(() => closeHandler!(0, null));
    });

    it("should return empty steps when report JSON is invalid", (done) => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock).mockResolvedValue([]);
      (fsSync.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      service.runUiTestStream("test").subscribe({
        next: (e) => {
          const parsed = JSON.parse((e as { data: string }).data);
          if (parsed.type === "result") {
            expect(parsed.data.steps).toBeUndefined();
            done();
          }
        },
        complete: () => {},
      });
      setImmediate(() => closeHandler!(0, null));
    });
  });

  describe("runUiTest", () => {
    it("should return error when grep is empty", async () => {
      const result = await service.runUiTest("");
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing grep",
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should return error when grep is only whitespace", async () => {
      const result = await service.runUiTest("   ");
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe("Missing grep");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should return error when grep is not a string", async () => {
      const result = await service.runUiTest(123 as unknown as string);
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe("Missing grep");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should return error when grep exceeds max length", async () => {
      const result = await service.runUiTest("x".repeat(301));
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe("grep exceeds 300 characters");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should resolve with success and video when child exits 0", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));

      (fsPromises.readdir as jest.Mock).mockResolvedValue([
        { name: "out.webm", isDirectory: () => false },
      ]);
      (fsSync.readFileSync as jest.Mock).mockReturnValue("{}");

      const promise = service.runUiTest("my test");
      setImmediate(() => closeHandler!(0, null));

      const result = await promise;
      expect(result).toMatchObject({
        success: true,
        exitCode: 0,
        videoBase64: Buffer.from("video").toString("base64"),
      } as Partial<RunUiTestResult>);
    });

    it("should resolve with failure when child exits non-zero", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));

      const promise = service.runUiTest("my test");
      setImmediate(() => closeHandler!(1, null));

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("should resolve with error when config write fails", async () => {
      (fsPromises.writeFile as jest.Mock).mockRejectedValue(
        new Error("disk full")
      );
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      }));

      const promise = service.runUiTest("my test");
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(null);
      expect(result.errorOutput).toContain("Failed to write config");
      expect(result.errorOutput).toContain("disk full");
    });

    it("should find video in defaultTestResultsDir when not in outputDir", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { name: "fallback.webm", isDirectory: () => false },
        ]);
      (fsSync.readFileSync as jest.Mock).mockReturnValue("{}");

      const promise = service.runUiTest("my test");
      setImmediate(() => closeHandler!(0, null));

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.videoBase64).toBe(Buffer.from("video").toString("base64"));
    });

    it("should resolve without video and not throw when readFile fails after findFirstWebm", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock).mockResolvedValue([
        { name: "x.webm", isDirectory: () => false },
      ]);
      (fsPromises.readFile as jest.Mock).mockRejectedValue(
        new Error("read error")
      );
      (fsSync.readFileSync as jest.Mock).mockReturnValue("{}");

      const promise = service.runUiTest("my test");
      setImmediate(() => closeHandler!(0, null));

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.videoBase64).toBeUndefined();
    });

    it("should include stdout and stderr in output and errorOutput", async () => {
      let stdoutDataFn: (d: Buffer) => void;
      let stderrDataFn: (d: Buffer) => void;
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: {
          on: jest.fn((ev: string, fn: (d: Buffer) => void) => {
            if (ev === "data") stdoutDataFn = fn;
          }),
        },
        stderr: {
          on: jest.fn((ev: string, fn: (d: Buffer) => void) => {
            if (ev === "data") stderrDataFn = fn;
          }),
        },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock).mockResolvedValue([]);

      const promise = service.runUiTest("my test");
      setImmediate(() => {
        stdoutDataFn(Buffer.from("out"));
        stderrDataFn(Buffer.from("err"));
        closeHandler!(0, null);
      });

      const result = await promise;
      expect(result.output).toBe("out");
      expect(result.errorOutput).toBe("err");
    });

    it("should find video in subdirectory via findFirstWebm recursion", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));
      (fsPromises.readdir as jest.Mock)
        .mockResolvedValueOnce([{ name: "sub", isDirectory: () => true }])
        .mockResolvedValueOnce([
          { name: "nested.webm", isDirectory: () => false },
        ]);
      (fsSync.readFileSync as jest.Mock).mockReturnValue("{}");

      const promise = service.runUiTest("my test");
      setImmediate(() => closeHandler!(0, null));

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.videoBase64).toBe(Buffer.from("video").toString("base64"));
    });
  });

  describe("runApiTest", () => {
    it("should return error when pattern is empty", async () => {
      const result = await service.runApiTest("");
      expect(result).toEqual({
        success: false,
        exitCode: 1,
        output: "",
        errorOutput: "Missing test name pattern",
      });
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should return error when pattern is only whitespace", async () => {
      const result = await service.runApiTest("   ");
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe("Missing test name pattern");
    });

    it("should return error when pattern is not a string", async () => {
      const result = await service.runApiTest(123 as unknown as string);
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe("Missing test name pattern");
    });

    it("should return error when pattern exceeds max length", async () => {
      const result = await service.runApiTest("x".repeat(301));
      expect(result.success).toBe(false);
      expect(result.errorOutput).toBe(
        "test name pattern exceeds 300 characters"
      );
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should resolve with success when child exits 0", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));

      const promise = service.runApiTest("Projects");
      setImmediate(() => closeHandler!(0, null));

      const result = await promise;
      expect(result).toMatchObject({
        success: true,
        exitCode: 0,
      } as Partial<RunApiTestResult>);
    });

    it("should resolve with failure when child exits non-zero", async () => {
      let closeHandler: (code: number | null, signal: string | null) => void;
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(
          (
            ev: string,
            fn: (code: number | null, signal: string | null) => void
          ) => {
            if (ev === "close") closeHandler = fn;
          }
        ),
        kill: jest.fn(),
      }));

      const promise = service.runApiTest("Projects");
      setImmediate(() => closeHandler!(1, null));

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it("should resolve with timeout message when child does not close within API_TEST_TIMEOUT_MS", async () => {
      jest.useFakeTimers();
      const killFn = jest.fn();
      mockSpawn.mockImplementation(() => ({
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: killFn,
      }));

      const promise = service.runApiTest("Projects");
      jest.advanceTimersByTime(60_000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(null);
      expect(result.errorOutput).toContain("Timed out after 60");
      expect(killFn).toHaveBeenCalledWith("SIGTERM");
      jest.useRealTimers();
    });
  });
});
