import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { IssuesService } from "./issues.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

const mockStorageService = {
  upload: jest.fn().mockResolvedValue({ url: "uploads/test/file" }),
  delete: jest.fn().mockResolvedValue(undefined),
  isFullUrl: jest.fn().mockReturnValue(false),
  download: jest.fn().mockResolvedValue({
    buffer: Buffer.from("mock"),
    contentType: "application/octet-stream",
  }),
};

jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  createReadStream: jest
    .fn()
    .mockReturnValue({ pipe: jest.fn(), on: jest.fn() }),
}));

const ISSUE_INCLUDE = {
  assignee: true,
  project: true,
  recordings: { orderBy: { createdAt: "asc" as const } },
  screenshots: { orderBy: { createdAt: "asc" as const } },
  files: { orderBy: { createdAt: "asc" as const } },
};

describe("IssuesService", () => {
  let service: IssuesService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ organizationId: "o1" }),
    },
    project: {
      findUnique: jest.fn(),
    },
    issue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    issueRecording: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    issueScreenshot: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    issueFile: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockStorageService.upload.mockResolvedValue({ url: "uploads/test/file" });
    mockStorageService.delete.mockResolvedValue(undefined);
    mockStorageService.isFullUrl.mockReturnValue(false);
    mockStorageService.download.mockResolvedValue({
      buffer: Buffer.from("mock"),
      contentType: "application/octet-stream",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
    const fs = require("fs");
    fs.existsSync.mockReturnValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<IssuesService>(IssuesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return all issues when projectId is not provided", async () => {
      const expected = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockPrisma.issue.findMany.mockResolvedValue(expected);

      const result = await service.list();
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by projectId when provided", async () => {
      const expected = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockPrisma.issue.findMany.mockResolvedValue(expected);

      const result = await service.list("p1");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: { projectId: "p1" },
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by search term when provided", async () => {
      const expected = [{ id: "1", title: "Bug fix", projectId: "p1" }];
      mockPrisma.issue.findMany.mockResolvedValue(expected);

      const result = await service.list(undefined, "  bug  ");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { title: { contains: "bug", mode: "insensitive" } },
            { description: { contains: "bug", mode: "insensitive" } },
            { acceptanceCriteria: { contains: "bug", mode: "insensitive" } },
            { database: { contains: "bug", mode: "insensitive" } },
            { api: { contains: "bug", mode: "insensitive" } },
            { testCases: { contains: "bug", mode: "insensitive" } },
            { automatedTest: { contains: "bug", mode: "insensitive" } },
          ],
        },
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by userId org when userId provided", async () => {
      const expected = [{ id: "1", title: "Issue", projectId: "p1" }];
      mockPrisma.issue.findMany.mockResolvedValue(expected);

      const result = await service.list(undefined, undefined, "user-1");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: { project: { organizationId: "o1" } },
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should combine projectId and search when both provided", async () => {
      const expected = [{ id: "1", title: "Bug", projectId: "p1" }];
      mockPrisma.issue.findMany.mockResolvedValue(expected);

      const result = await service.list("p1", "bug");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: {
          projectId: "p1",
          OR: expect.any(Array),
        },
        include: ISSUE_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should ignore non-string search", async () => {
      await expect(
        service.list(123 as unknown as string, undefined)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findMany).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for whitespace projectId", async () => {
      await expect(service.list("   " as string, undefined)).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findMany).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("should return an issue by id", async () => {
      const expected = { id: "1", title: "Issue 1", projectId: "p1" };
      mockPrisma.issue.findUnique.mockResolvedValue(expected);

      const result = await service.get("1");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw NotFoundException when issue does not exist", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);

      await expect(service.get("missing")).rejects.toThrow(NotFoundException);
      await expect(service.get("missing")).rejects.toThrow("Issue not found");
    });
  });

  describe("create", () => {
    it("should create an issue", async () => {
      const input = { title: "New", description: "Desc", projectId: "p1" };
      const expected = { id: "1", ...input };
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Project 1",
        organizationId: "o1",
      });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.create.mockResolvedValue(expected);

      const result = await service.create(input);
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.create).toHaveBeenCalledWith({
        data: { ...input, key: "P1-1" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should create issue with single-word project name (acronym first 3 chars)", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Ab",
        organizationId: "o1",
      });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.create.mockResolvedValue({
        id: "1",
        title: "New",
        projectId: "p1",
        key: "AB-1",
      });

      const result = await service.create({
        title: "New",
        description: "Desc",
        projectId: "p1",
      });
      expect(result.key).toBe("AB-1");
      expect(mockPrisma.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ key: "AB-1" }),
        include: ISSUE_INCLUDE,
      });
    });

    it("should create an issue with automatedTest", async () => {
      const tests = JSON.stringify(["test A", "test B"]);
      const input = { title: "New", projectId: "p1", automatedTest: tests };
      const expected = { id: "2", ...input };
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Project 1",
        organizationId: "o1",
      });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.create.mockResolvedValue(expected);

      const result = await service.create(input);
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.create).toHaveBeenCalledWith({
        data: { ...input, key: "P1-1" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw BadRequestException when assignee is outside project org", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Project 1",
        organizationId: "o1",
      });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        organizationId: "o2",
      });

      await expect(
        service.create({
          title: "New",
          projectId: "p1",
          assigneeId: "u-other",
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid status on create", async () => {
      await expect(
        service.create({
          title: "New",
          projectId: "p1",
          status: "invalid",
        } as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for out-of-range qualityScore on create", async () => {
      await expect(
        service.create({
          title: "New",
          projectId: "p1",
          qualityScore: 101,
        } as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for blank title on create", async () => {
      await expect(
        service.create({ title: "   ", projectId: "p1" } as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should trim title on create", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Project 1",
        organizationId: "o1",
      });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.create.mockResolvedValue({
        id: "1",
        title: "New",
        projectId: "p1",
      });

      await service.create({ title: "  New  ", projectId: "p1" });
      expect(mockPrisma.issue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: "New", key: "P1-1" }),
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw BadRequestException for non-string optional text fields on create", async () => {
      await expect(
        service.create({
          title: "New",
          projectId: "p1",
          description: 123 as any,
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for non-string assigneeId on create", async () => {
      await expect(
        service.create({
          title: "New",
          projectId: "p1",
          assigneeId: 123 as any,
        })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid projectId on create", async () => {
      await expect(
        service.create({ title: "New", projectId: 123 as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.create).not.toHaveBeenCalled();
    });

    it("should throw InternalServerErrorException when key allocation repeatedly conflicts", async () => {
      const conflict = new PrismaClientKnownRequestError("Unique conflict", {
        code: "P2002",
        clientVersion: "4",
      });
      mockPrisma.project.findUnique.mockResolvedValue({
        id: "p1",
        name: "Project 1",
        organizationId: "o1",
      });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.create.mockRejectedValue(conflict);

      await expect(
        service.create({ title: "New", projectId: "p1" })
      ).rejects.toThrow(InternalServerErrorException);
      expect(mockPrisma.issue.create).toHaveBeenCalledTimes(5);
    });
  });

  describe("updateStatus", () => {
    it("should update only status", async () => {
      const expected = { id: "1", title: "Issue", status: "done" };
      mockPrisma.issue.update.mockResolvedValue(expected);

      const result = await service.updateStatus("1", "done");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { status: "done" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw BadRequestException when status is invalid", async () => {
      await expect(service.updateStatus("1", "invalid")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when status is blank", async () => {
      await expect(service.updateStatus("1", "   ")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when status is not a string", async () => {
      await expect(
        service.updateStatus("1", 123 as unknown as string)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update an issue", async () => {
      const data = { title: "Updated", status: "in_progress" };
      const expected = { id: "1", ...data };
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue(expected);

      const result = await service.update("1", data);
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data,
        include: ISSUE_INCLUDE,
      });
    });

    it("should update automatedTest field", async () => {
      const tests = JSON.stringify(["test A", "test B"]);
      const data = { automatedTest: tests };
      const expected = { id: "1", automatedTest: tests };
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue(expected);

      const result = await service.update("1", data);
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { automatedTest: tests },
        include: ISSUE_INCLUDE,
      });
    });

    it("should strip disallowed fields", async () => {
      const data = { title: "OK", hackerField: "bad" };
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue({ id: "1", title: "OK" });

      await service.update("1", data);
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: "OK" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should omit allowed keys with undefined value", async () => {
      const data = { title: "OK", description: undefined };
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue({ id: "1", title: "OK" });

      await service.update("1", data);
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: "OK" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw NotFoundException when updating missing issue", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);
      await expect(service.update("missing", { title: "x" })).rejects.toThrow(
        NotFoundException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when assigning user outside issue org", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: "o1" });
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        organizationId: "o2",
      });

      await expect(
        service.update("1", { assigneeId: "u-other" })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid status on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      await expect(service.update("1", { status: "invalid" })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid qualityScore on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      await expect(service.update("1", { qualityScore: -1 })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for blank title on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      await expect(service.update("1", { title: "   " })).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should trim title on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue({ id: "1", title: "Updated" });

      await service.update("1", { title: "  Updated  " });
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { title: "Updated" },
        include: ISSUE_INCLUDE,
      });
    });

    it("should throw BadRequestException for non-string optional text fields on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      await expect(
        service.update("1", { description: 123 as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for non-string assigneeId on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      await expect(
        service.update("1", { assigneeId: 123 as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.update).not.toHaveBeenCalled();
    });

    it("should normalize blank assigneeId to null on update", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ projectId: "p1" });
      mockPrisma.issue.update.mockResolvedValue({ id: "1" });

      await service.update("1", { assigneeId: "   " });
      expect(mockPrisma.issue.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: { assigneeId: null },
        include: ISSUE_INCLUDE,
      });
    });
  });

  describe("delete", () => {
    it("should delete an issue", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({
        id: "1",
        recordings: [],
        screenshots: [],
        files: [],
      });
      const expected = { id: "1", title: "Deleted" };
      mockPrisma.issue.delete.mockResolvedValue(expected);

      const result = await service.delete("1");
      expect(result).toEqual(expected);
      expect(mockPrisma.issue.findUnique).toHaveBeenCalledWith({
        where: { id: "1" },
        include: { recordings: true, screenshots: true, files: true },
      });
      expect(mockPrisma.issue.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should delete recording/screenshot/file paths when they exist", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({
        id: "1",
        recordings: [{ videoUrl: "uploads/recordings/a.webm" }],
        screenshots: [{ imageUrl: "uploads/screenshots/b.png" }],
        files: [{ fileUrl: "uploads/files/c.bin" }],
      });
      mockPrisma.issue.delete.mockResolvedValue({ id: "1" });

      await service.delete("1");
      expect(mockStorageService.delete).toHaveBeenCalledTimes(3);
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/recordings/a.webm"
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/screenshots/b.png"
      );
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/files/c.bin"
      );
    });
  });

  describe("deleteMany", () => {
    it("should delete all issues when projectId is provided", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
      mockPrisma.issue.findMany.mockResolvedValue([
        { id: "1", recordings: [], screenshots: [], files: [] },
        { id: "2", recordings: [], screenshots: [], files: [] },
      ]);
      mockPrisma.issue.deleteMany.mockResolvedValue({ count: 2 });

      await service.deleteMany("project-1", "user-1");
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: {
          project: { organizationId: "o1" },
          projectId: "project-1",
        },
        include: { recordings: true, screenshots: true, files: true },
      });
      expect(mockPrisma.issue.deleteMany).toHaveBeenCalledWith({
        where: {
          project: { organizationId: "o1" },
          projectId: "project-1",
        },
      });
    });

    it("should delete all issues when projectId is undefined", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ organizationId: "o1" });
      mockPrisma.issue.findMany.mockResolvedValue([]);
      mockPrisma.issue.deleteMany.mockResolvedValue({ count: 0 });

      await service.deleteMany(undefined, "user-1");
      expect(mockPrisma.issue.findMany).toHaveBeenCalledWith({
        where: { project: { organizationId: "o1" } },
        include: { recordings: true, screenshots: true, files: true },
      });
      expect(mockPrisma.issue.deleteMany).toHaveBeenCalledWith({
        where: { project: { organizationId: "o1" } },
      });
    });

    it("should throw BadRequestException when projectId is invalid", async () => {
      await expect(
        service.deleteMany(123 as unknown as string, "user-1")
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.issue.deleteMany).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when projectId is whitespace", async () => {
      await expect(service.deleteMany("   ", "user-1")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.issue.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("streamRecording", () => {
    it("should stream blob content when recording has full URL (Blob)", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        videoUrl: "https://blob.vercel-storage.com/x.webm",
        issue: { project: { organizationId: "o1" } },
      });
      mockStorageService.isFullUrl.mockReturnValue(true);
      mockStorageService.download.mockResolvedValue({
        buffer: Buffer.from("video"),
        contentType: "video/webm",
      });
      const setHeader = jest.fn();
      const send = jest.fn();
      const res = { setHeader, send };

      await service.streamRecording("x.webm", res as any);
      expect(mockStorageService.download).toHaveBeenCalledWith(
        "https://blob.vercel-storage.com/x.webm"
      );
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "video/webm");
      expect(send).toHaveBeenCalledWith(Buffer.from("video"));
    });

    it("should throw on invalid filename", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        videoUrl: "uploads/recordings/x",
        issue: { project: { organizationId: "o1" } },
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      const res = { setHeader: jest.fn(), pipe: jest.fn() };
      await expect(
        service.streamRecording("../../../etc/passwd", res as any)
      ).rejects.toThrow(NotFoundException);
      await expect(service.streamRecording("x", res as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw when file does not exist", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        videoUrl: "uploads/recordings/valid.webm",
        issue: { project: { organizationId: "o1" } },
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      require("fs").existsSync.mockReturnValue(false);
      const res = { setHeader: jest.fn(), pipe: jest.fn() };
      await expect(
        service.streamRecording("valid.webm", res as any)
      ).rejects.toThrow(NotFoundException);
    });

    it("should set headers and pipe stream when file exists", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        videoUrl: "uploads/recordings/video.webm",
        issue: { project: { organizationId: "o1" } },
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      require("fs").existsSync.mockReturnValue(true);
      const setHeader = jest.fn();
      const pipe = jest.fn();
      const res = { setHeader, pipe };
      const { createReadStream } = require("fs");
      createReadStream.mockReturnValue({ pipe, on: jest.fn() });

      await service.streamRecording("video.webm", res as any);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "video/webm");
      expect(setHeader).toHaveBeenCalledWith("Accept-Ranges", "bytes");
      expect(pipe).toHaveBeenCalledWith(res);
    });

    it("should return 500 when recording stream errors before headers are sent", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        videoUrl: "uploads/recordings/video.webm",
        issue: { project: { organizationId: "o1" } },
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      require("fs").existsSync.mockReturnValue(true);
      const setHeader = jest.fn();
      const status = jest.fn().mockReturnThis();
      const end = jest.fn();
      const pipe = jest.fn();
      const on = jest.fn((event: string, cb: (err: Error) => void) => {
        if (event === "error") cb(new Error("stream failed"));
      });
      const res = { setHeader, status, end, pipe, headersSent: false };
      const { createReadStream } = require("fs");
      createReadStream.mockReturnValue({ pipe, on });

      await service.streamRecording("video.webm", res as any);
      expect(status).toHaveBeenCalledWith(500);
      expect(end).toHaveBeenCalled();
    });
  });

  describe("addRecording", () => {
    it("should add recording with default filename", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });
      mockPrisma.issueRecording.create.mockResolvedValue({});
      mockPrisma.issue.findUnique
        .mockResolvedValueOnce({ id: "i1" })
        .mockResolvedValueOnce({ id: "i1", title: "Issue" });

      const result = await service.addRecording(
        "i1",
        "ZGF0YQ==",
        "video",
        "screen"
      );
      expect(mockPrisma.issueRecording.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "i1", title: "Issue" });
    });

    it("should throw when issue not found", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);
      await expect(service.addRecording("missing", "ZGF0YQ==")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should use custom filename and displayName when fileName has valid extension", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });
      mockPrisma.issueRecording.create.mockResolvedValue({});
      mockPrisma.issue.findUnique
        .mockResolvedValueOnce({ id: "i1" })
        .mockResolvedValueOnce({ id: "i1", title: "Issue" });

      await service.addRecording(
        "i1",
        "ZGF0YQ==",
        "video",
        "screen",
        "My Recording.mp4"
      );
      expect(mockPrisma.issueRecording.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          issueId: "i1",
          mediaType: "video",
          recordingType: "screen",
          name: "My Recording.mp4",
        }),
      });
    });

    it("should throw for blank videoBase64", async () => {
      await expect(service.addRecording("i1", "   ")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueRecording.create).not.toHaveBeenCalled();
    });

    it("should throw for invalid mediaType", async () => {
      await expect(
        service.addRecording("i1", "ZGF0YQ==", "invalid" as any, "screen")
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueRecording.create).not.toHaveBeenCalled();
    });

    it("should throw for invalid recordingType", async () => {
      await expect(
        service.addRecording("i1", "ZGF0YQ==", "video", "invalid" as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueRecording.create).not.toHaveBeenCalled();
    });

    it("should throw for invalid videoBase64 payload", async () => {
      await expect(service.addRecording("i1", "not-base64")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueRecording.create).not.toHaveBeenCalled();
    });
  });

  describe("updateRecording", () => {
    it("should update recording and return issue", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      mockPrisma.issueRecording.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateRecording("i1", "r1", { name: "New" });
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueRecording.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { name: "New" },
      });
    });

    it("should return issue without update when payload empty", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateRecording("i1", "r1", {});
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueRecording.update).not.toHaveBeenCalled();
    });

    it("should throw when recording not found", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue(null);
      await expect(
        service.updateRecording("i1", "r1", { name: "x" })
      ).rejects.toThrow(NotFoundException);
    });

    it("should set name to null when empty string", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      mockPrisma.issueRecording.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateRecording("i1", "r1", { name: "" });
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueRecording.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { name: null },
      });
    });

    it("should trim recording name", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      mockPrisma.issueRecording.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      await service.updateRecording("i1", "r1", { name: "  New  " });
      expect(mockPrisma.issueRecording.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { name: "New" },
      });
    });

    it("should update only mediaType and recordingType when provided", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      mockPrisma.issueRecording.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateRecording("i1", "r1", {
        mediaType: "audio",
        recordingType: "camera",
      });
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueRecording.update).toHaveBeenCalledWith({
        where: { id: "r1" },
        data: { mediaType: "audio", recordingType: "camera" },
      });
    });

    it("should throw for invalid mediaType on update", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      await expect(
        service.updateRecording("i1", "r1", { mediaType: "invalid" as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issueRecording.update).not.toHaveBeenCalled();
    });

    it("should throw for invalid recordingType on update", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      await expect(
        service.updateRecording("i1", "r1", { recordingType: "invalid" as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issueRecording.update).not.toHaveBeenCalled();
    });

    it("should throw for non-string recording name", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        issueId: "i1",
      });
      await expect(
        service.updateRecording("i1", "r1", { name: 123 as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issueRecording.update).not.toHaveBeenCalled();
    });
  });

  describe("removeRecording", () => {
    it("should delete recording and unlink file when exists", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue({
        id: "r1",
        videoUrl: "uploads/recordings/x.webm",
      });
      mockPrisma.issueRecording.delete.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.removeRecording("i1", "r1");
      expect(result).toEqual({ id: "i1" });
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/recordings/x.webm"
      );
      expect(mockPrisma.issueRecording.delete).toHaveBeenCalledWith({
        where: { id: "r1" },
      });
    });

    it("should throw when recording not found", async () => {
      mockPrisma.issueRecording.findFirst.mockResolvedValue(null);
      await expect(service.removeRecording("i1", "r1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("addScreenshot", () => {
    it("should add screenshot and return issue", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });
      mockPrisma.issueScreenshot.create.mockResolvedValue({});
      mockPrisma.issue.findUnique
        .mockResolvedValueOnce({ id: "i1" })
        .mockResolvedValueOnce({ id: "i1" });

      const result = await service.addScreenshot("i1", "ZGF0YQ==");
      expect(mockPrisma.issueScreenshot.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "i1" });
    });

    it("should throw when issue not found", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);
      await expect(
        service.addScreenshot("missing", "ZGF0YQ==")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw when imageBase64 is blank", async () => {
      await expect(service.addScreenshot("i1", "   ")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueScreenshot.create).not.toHaveBeenCalled();
    });

    it("should throw when imageBase64 is invalid", async () => {
      await expect(service.addScreenshot("i1", "not-base64")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueScreenshot.create).not.toHaveBeenCalled();
    });
  });

  describe("updateScreenshot", () => {
    it("should update name and return issue", async () => {
      mockPrisma.issueScreenshot.findUnique.mockResolvedValue({
        id: "s1",
        issueId: "i1",
      });
      mockPrisma.issueScreenshot.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateScreenshot("i1", "s1", "New name");
      expect(mockPrisma.issueScreenshot.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { name: "New name" },
      });
      expect(result).toEqual({ id: "i1" });
    });

    it("should throw when screenshot not found", async () => {
      mockPrisma.issueScreenshot.findUnique.mockResolvedValue(null);
      await expect(service.updateScreenshot("i1", "s1", "x")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw when screenshot belongs to another issue", async () => {
      mockPrisma.issueScreenshot.findUnique.mockResolvedValue({
        id: "s1",
        issueId: "other",
      });
      await expect(service.updateScreenshot("i1", "s1", "x")).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw when screenshot name is not a string/null", async () => {
      mockPrisma.issueScreenshot.findUnique.mockResolvedValue({
        id: "s1",
        issueId: "i1",
      });
      await expect(
        service.updateScreenshot("i1", "s1", 123 as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issueScreenshot.update).not.toHaveBeenCalled();
    });
  });

  describe("removeScreenshot", () => {
    it("should delete screenshot and unlink when exists", async () => {
      mockPrisma.issueScreenshot.findFirst.mockResolvedValue({
        id: "s1",
        imageUrl: "uploads/screenshots/x.png",
      });
      require("fs").existsSync.mockReturnValue(true);
      mockPrisma.issueScreenshot.delete.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.removeScreenshot("i1", "s1");
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueScreenshot.delete).toHaveBeenCalledWith({
        where: { id: "s1" },
      });
    });

    it("should throw when screenshot not found", async () => {
      mockPrisma.issueScreenshot.findFirst.mockResolvedValue(null);
      await expect(service.removeScreenshot("i1", "s1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("addFile", () => {
    it("should add file and return issue", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });
      mockPrisma.issueFile.create.mockResolvedValue({});
      mockPrisma.issue.findUnique
        .mockResolvedValueOnce({ id: "i1" })
        .mockResolvedValueOnce({ id: "i1" });

      const result = await service.addFile("i1", "ZGF0YQ==", "doc.pdf");
      expect(mockPrisma.issueFile.create).toHaveBeenCalled();
      expect(result).toEqual({ id: "i1" });
    });

    it("should throw when issue not found", async () => {
      mockPrisma.issue.findUnique.mockResolvedValue(null);
      await expect(
        service.addFile("missing", "ZGF0YQ==", "x.pdf")
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw when fileName is blank", async () => {
      await expect(service.addFile("i1", "ZGF0YQ==", "   ")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueFile.create).not.toHaveBeenCalled();
    });

    it("should throw when fileBase64 is blank", async () => {
      await expect(service.addFile("i1", "   ", "doc.pdf")).rejects.toThrow(
        BadRequestException
      );
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueFile.create).not.toHaveBeenCalled();
    });

    it("should throw when fileBase64 is invalid", async () => {
      await expect(
        service.addFile("i1", "not-base64", "doc.pdf")
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueFile.create).not.toHaveBeenCalled();
    });

    it("should throw when file payload types are invalid", async () => {
      await expect(
        service.addFile("i1", 123 as any, "doc.pdf")
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addFile("i1", "ZGF0YQ==", 123 as any)
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issue.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.issueFile.create).not.toHaveBeenCalled();
    });
  });

  describe("updateFile", () => {
    it("should update fileName and return issue", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
      });
      mockPrisma.issueFile.update.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateFile("i1", "f1", {
        fileName: "new.pdf",
      });
      expect(mockPrisma.issueFile.update).toHaveBeenCalledWith({
        where: { id: "f1" },
        data: { fileName: "new.pdf" },
      });
      expect(result).toEqual({ id: "i1" });
    });

    it("should return issue without update when fileName empty", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
      });
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.updateFile("i1", "f1", { fileName: "   " });
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueFile.update).not.toHaveBeenCalled();
    });

    it("should throw when file not found", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue(null);
      await expect(
        service.updateFile("i1", "f1", { fileName: "x" })
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw when fileName is not a string", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
      });
      await expect(
        service.updateFile("i1", "f1", { fileName: 123 as any })
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.issueFile.update).not.toHaveBeenCalled();
    });
  });

  describe("removeFile", () => {
    it("should delete file and unlink when exists", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        fileUrl: "uploads/files/x.bin",
      });
      require("fs").existsSync.mockReturnValue(true);
      mockPrisma.issueFile.delete.mockResolvedValue({});
      mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1" });

      const result = await service.removeFile("i1", "f1");
      expect(result).toEqual({ id: "i1" });
      expect(mockPrisma.issueFile.delete).toHaveBeenCalledWith({
        where: { id: "f1" },
      });
    });

    it("should throw when file not found", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue(null);
      await expect(service.removeFile("i1", "f1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("streamFile", () => {
    it("should set Content-Disposition inline for PDF and pipe stream", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "uploads/files/x",
        fileName: "doc.pdf",
      });
      require("fs").existsSync.mockReturnValue(true);
      const setHeader = jest.fn();
      const pipe = jest.fn();
      const res = { setHeader, pipe };
      const { createReadStream } = require("fs");
      createReadStream.mockReturnValue({ pipe, on: jest.fn() });

      await service.streamFile("i1", "f1", res as any);
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'inline; filename="doc.pdf"'
      );
      expect(pipe).toHaveBeenCalledWith(res);
    });

    it("should set attachment for non-PDF", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "uploads/files/x",
        fileName: "data.bin",
      });
      require("fs").existsSync.mockReturnValue(true);
      const setHeader = jest.fn();
      const pipe = jest.fn();
      const res = { setHeader, pipe };
      const { createReadStream } = require("fs");
      createReadStream.mockReturnValue({ pipe, on: jest.fn() });

      await service.streamFile("i1", "f1", res as any);
      expect(setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="data.bin"'
      );
    });

    it("should throw when file not found in DB", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue(null);
      await expect(service.streamFile("i1", "f1", {} as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should stream blob content when file has full URL (Blob)", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "https://blob.vercel-storage.com/doc.pdf",
        fileName: "doc.pdf",
      });
      mockStorageService.isFullUrl.mockReturnValue(true);
      mockStorageService.download.mockResolvedValue({
        buffer: Buffer.from("pdf"),
        contentType: "application/pdf",
      });
      const setHeader = jest.fn();
      const send = jest.fn();
      const res = { setHeader, send };

      await service.streamFile("i1", "f1", res as any);
      expect(mockStorageService.download).toHaveBeenCalledWith(
        "https://blob.vercel-storage.com/doc.pdf"
      );
      expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(send).toHaveBeenCalledWith(Buffer.from("pdf"));
    });

    it("should throw when file path does not exist on disk", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "uploads/files/x",
        fileName: "x",
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      require("fs").existsSync.mockReturnValue(false);
      await expect(service.streamFile("i1", "f1", {} as any)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should throw when fileUrl is not an allowed local uploads path", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "../../../etc/passwd",
        fileName: "x",
      });
      mockStorageService.isFullUrl.mockReturnValue(false);

      await expect(service.streamFile("i1", "f1", {} as any)).rejects.toThrow(
        NotFoundException
      );
      expect(require("fs").existsSync).not.toHaveBeenCalled();
    });

    it("should end response when file stream errors after headers are sent", async () => {
      mockPrisma.issueFile.findFirst.mockResolvedValue({
        id: "f1",
        issueId: "i1",
        fileUrl: "uploads/files/x",
        fileName: "doc.pdf",
      });
      mockStorageService.isFullUrl.mockReturnValue(false);
      require("fs").existsSync.mockReturnValue(true);
      const setHeader = jest.fn();
      const status = jest.fn().mockReturnThis();
      const end = jest.fn();
      const pipe = jest.fn();
      const on = jest.fn((event: string, cb: (err: Error) => void) => {
        if (event === "error") cb(new Error("stream failed"));
      });
      const res = { setHeader, status, end, pipe, headersSent: true };
      const { createReadStream } = require("fs");
      createReadStream.mockReturnValue({ pipe, on });

      await service.streamFile("i1", "f1", res as any);
      expect(status).not.toHaveBeenCalled();
      expect(end).toHaveBeenCalled();
    });
  });
});
