import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { StorageService } from "./storage.service";

const mockPut = jest.fn();
const mockDel = jest.fn();
jest.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => mockPut(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

const mockMkdir = jest.fn();
const mockWriteFile = jest.fn();
const mockUnlink = jest.fn();
jest.mock("fs/promises", () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
}));

const mockJoin = jest.fn((...parts: string[]) => parts.join("/"));
jest.mock("path", () => ({
  join: (...args: unknown[]) => mockJoin(...(args as string[])),
}));

describe("StorageService", () => {
  let service: StorageService;
  const origCwd = process.cwd;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.cwd = () => "/app";
    process.env.LOCAL_UPLOADS_DIR = "/app/uploads";
    mockJoin.mockImplementation((...parts: string[]) => parts.join("/"));

    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    process.cwd = origCwd;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.LOCAL_UPLOADS_DIR;
  });

  describe("when BLOB_READ_WRITE_TOKEN is not set (filesystem)", () => {
    beforeEach(() => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    });

    it("should upload to filesystem", async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await service.upload(
        "recordings",
        "test.webm",
        Buffer.from("data")
      );

      expect(result).toEqual({ url: "uploads/recordings/test.webm" });
      expect(mockMkdir).toHaveBeenCalledWith("/app/uploads/recordings", {
        recursive: true,
      });
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/app/uploads/recordings/test.webm",
        Buffer.from("data")
      );
    });

    it("should reject unsafe upload filename", async () => {
      await expect(
        service.upload("recordings", "../x.webm", Buffer.from("data"))
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.upload("recordings", "../x.webm", Buffer.from("data"))
      ).rejects.toThrow("Unsafe filename");
      expect(mockMkdir).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should delete from filesystem", async () => {
      mockUnlink.mockResolvedValue(undefined);

      await service.delete("uploads/recordings/x.webm");

      expect(mockUnlink).toHaveBeenCalledWith("/app/uploads/recordings/x.webm");
    });

    it("should ignore unlink error when file does not exist", async () => {
      mockUnlink.mockRejectedValue(new Error("ENOENT"));

      await expect(service.delete("uploads/x")).resolves.not.toThrow();
    });

    it("should ignore delete for unsafe local paths", async () => {
      await service.delete("../etc/passwd");
      await service.delete("uploads/files/nested/path.bin");
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it("isFullUrl returns false for relative path", () => {
      expect(service.isFullUrl("uploads/recordings/x.webm")).toBe(false);
      expect(service.isFullUrl("httpx://not-valid")).toBe(false);
    });
  });

  describe("when BLOB_READ_WRITE_TOKEN is set (blob)", () => {
    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_xxx";
    });

    it("should upload to blob", async () => {
      mockPut.mockResolvedValue({ url: "https://blob.vercel-storage.com/x" });

      const result = await service.upload(
        "screenshots",
        "img.png",
        Buffer.from("png"),
        "image/png"
      );

      expect(result).toEqual({
        url: "https://blob.vercel-storage.com/x",
      });
      expect(mockPut).toHaveBeenCalledWith(
        "screenshots/img.png",
        Buffer.from("png"),
        { access: "private", contentType: "image/png", addRandomSuffix: true }
      );
    });

    it("should reject unsafe filename before blob upload", async () => {
      await expect(
        service.upload("files", "nested/path.bin", Buffer.from("x"))
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.upload("files", "nested/path.bin", Buffer.from("x"))
      ).rejects.toThrow("Unsafe filename");
      expect(mockPut).not.toHaveBeenCalled();
    });

    it("should delete from blob when url starts with http", async () => {
      mockDel.mockResolvedValue(undefined);

      await service.delete("https://blob.vercel-storage.com/x");

      expect(mockDel).toHaveBeenCalledWith("https://blob.vercel-storage.com/x");
    });

    it("isFullUrl returns true for http url", () => {
      expect(service.isFullUrl("https://blob.vercel-storage.com/x")).toBe(true);
      expect(service.isFullUrl("HTTP://blob.vercel-storage.com/x")).toBe(true);
    });
  });
});
