import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { IssueCommentsService } from "./issue-comments.service";
import { IssuesService } from "./issues.service";
import { PrismaService } from "../prisma.service";
import { StorageService } from "../storage.service";

const TEST_USER_ID = "user-1";

const mockStorageService = {
  upload: jest.fn().mockResolvedValue({ url: "uploads/test/file" }),
  delete: jest.fn().mockResolvedValue(undefined),
  isFullUrl: jest.fn().mockReturnValue(false),
};

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("fs", () => ({ existsSync: jest.fn() }));

describe("IssueCommentsService", () => {
  let service: IssueCommentsService;
  const mockPrisma = {
    issue: { findUnique: jest.fn() },
    issueComment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    issueCommentEdit: { create: jest.fn() },
    commentAttachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockIssuesService = {
    verifyIssueAccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIssuesService.verifyIssueAccess.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueCommentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IssuesService, useValue: mockIssuesService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<IssueCommentsService>(IssueCommentsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("list", () => {
    it("should return comments for an issue ordered by createdAt", async () => {
      const issue = { id: "issue-1" };
      const comments = [
        { id: "c1", issueId: "issue-1", body: "First", createdAt: new Date() },
        { id: "c2", issueId: "issue-1", body: "Second", createdAt: new Date() },
      ];
      mockPrisma.issue.findUnique.mockResolvedValue(issue);
      mockPrisma.issueComment.findMany.mockResolvedValue(comments);

      const result = await service.list("issue-1", TEST_USER_ID);
      expect(result).toEqual(comments);
      expect(mockIssuesService.verifyIssueAccess).toHaveBeenCalledWith(
        "issue-1",
        TEST_USER_ID
      );
      expect(mockPrisma.issueComment.findMany).toHaveBeenCalledWith({
        where: { issueId: "issue-1" },
        orderBy: { createdAt: "asc" },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException when issue does not exist", async () => {
      mockIssuesService.verifyIssueAccess.mockRejectedValue(
        new NotFoundException("Issue not found")
      );

      await expect(service.list("missing", TEST_USER_ID)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.list("missing", TEST_USER_ID)).rejects.toThrow(
        "Issue not found"
      );
      expect(mockPrisma.issueComment.findMany).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create a comment for an issue", async () => {
      const issue = { id: "issue-1" };
      const created = { id: "c1", issueId: "issue-1", body: "New comment" };
      mockPrisma.issue.findUnique.mockResolvedValue(issue);
      mockPrisma.issueComment.create.mockResolvedValue(created);

      const result = await service.create(
        "issue-1",
        "New comment",
        TEST_USER_ID
      );
      expect(result).toEqual(created);
      expect(mockIssuesService.verifyIssueAccess).toHaveBeenCalledWith(
        "issue-1",
        TEST_USER_ID
      );
      expect(mockPrisma.issueComment.create).toHaveBeenCalledWith({
        data: { issueId: "issue-1", body: "New comment" },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException when issue does not exist", async () => {
      mockIssuesService.verifyIssueAccess.mockRejectedValue(
        new NotFoundException("Issue not found")
      );

      await expect(
        service.create("missing", "body", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create("missing", "body", TEST_USER_ID)
      ).rejects.toThrow("Issue not found");
      expect(mockPrisma.issueComment.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update comment body and create edit history", async () => {
      const comment = { id: "c1", issueId: "issue-1", body: "Old body" };
      const updated = { id: "c1", issueId: "issue-1", body: "New body" };
      mockPrisma.issueComment.findUnique.mockResolvedValue(comment);
      mockPrisma.$transaction.mockResolvedValue(undefined);
      mockPrisma.issueComment.findUnique
        .mockResolvedValueOnce(comment)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        "issue-1",
        "c1",
        "New body",
        TEST_USER_ID
      );
      expect(result).toEqual(updated);
      expect(mockPrisma.issueCommentEdit.create).toHaveBeenCalledWith({
        data: { commentId: "c1", body: "Old body" },
      });
      expect(mockPrisma.issueComment.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { body: "New body" },
      });
    });

    it("should return comment without update when body is unchanged", async () => {
      const comment = { id: "c1", issueId: "issue-1", body: "Same" };
      mockPrisma.issueComment.findUnique.mockResolvedValue(comment);

      const result = await service.update(
        "issue-1",
        "c1",
        "Same",
        TEST_USER_ID
      );
      expect(result).toEqual(comment);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when comment does not exist", async () => {
      mockPrisma.issueComment.findUnique.mockResolvedValue(null);

      await expect(
        service.update("issue-1", "missing", "New", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update("issue-1", "missing", "New", TEST_USER_ID)
      ).rejects.toThrow("Comment not found");
    });

    it("should throw NotFoundException when comment belongs to another issue", async () => {
      mockPrisma.issueComment.findUnique.mockResolvedValue({
        id: "c1",
        issueId: "other",
      });

      await expect(
        service.update("issue-1", "c1", "New", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw when getOne does not find comment after update", async () => {
      const comment = { id: "c1", issueId: "issue-1", body: "Old" };
      mockPrisma.issueComment.findUnique
        .mockResolvedValueOnce(comment)
        .mockResolvedValueOnce(null);
      mockPrisma.$transaction.mockResolvedValue(undefined);

      await expect(
        service.update("issue-1", "c1", "New", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update("issue-1", "c1", "New", TEST_USER_ID)
      ).rejects.toThrow("Comment not found");
    });
  });

  describe("addAttachment", () => {
    it("should add screenshot attachment", async () => {
      const comment = { id: "c1", issueId: "issue-1" };
      const created = {
        id: "a1",
        commentId: "c1",
        type: "screenshot",
        mediaUrl: "uploads/screenshots/x.png",
      };
      mockPrisma.issueComment.findFirst.mockResolvedValue(comment);
      mockPrisma.commentAttachment.create.mockResolvedValue(created);
      mockPrisma.issueComment.findUnique.mockResolvedValue(created);

      const result = await service.addAttachment(
        "issue-1",
        "c1",
        {
          type: "screenshot",
          imageBase64: "  iVBORw0KGgo=  ",
        },
        TEST_USER_ID
      );
      expect(result).toEqual(created);
      expect(mockPrisma.commentAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ commentId: "c1", type: "screenshot" }),
      });
    });

    it("should add video attachment", async () => {
      const comment = { id: "c1", issueId: "issue-1" };
      const created = {
        id: "a1",
        commentId: "c1",
        type: "video",
        mediaUrl: "uploads/recordings/x.webm",
      };
      mockPrisma.issueComment.findFirst.mockResolvedValue(comment);
      mockPrisma.commentAttachment.create.mockResolvedValue(created);
      mockPrisma.issueComment.findUnique.mockResolvedValue(created);

      const result = await service.addAttachment(
        "issue-1",
        "c1",
        {
          type: "video",
          videoBase64: "  dmlkZW8=  ",
        },
        TEST_USER_ID
      );
      expect(result).toEqual(created);
      expect(mockPrisma.commentAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ commentId: "c1", type: "video" }),
      });
    });

    it("should throw BadRequestException when screenshot has no imageBase64", async () => {
      mockPrisma.issueComment.findFirst.mockResolvedValue({
        id: "c1",
        issueId: "issue-1",
      });

      await expect(
        service.addAttachment(
          "issue-1",
          "c1",
          { type: "screenshot" },
          TEST_USER_ID
        )
      ).rejects.toThrow("Provide a non-empty imageBase64 for screenshot");
    });

    it("should throw BadRequestException when video has no videoBase64", async () => {
      mockPrisma.issueComment.findFirst.mockResolvedValue({
        id: "c1",
        issueId: "issue-1",
      });

      await expect(
        service.addAttachment(
          "issue-1",
          "c1",
          { type: "screen_recording" },
          TEST_USER_ID
        )
      ).rejects.toThrow(
        "Provide a non-empty videoBase64 for video, screen_recording, or camera_recording"
      );
    });

    it("should throw NotFoundException when comment not found", async () => {
      mockPrisma.issueComment.findFirst.mockResolvedValue(null);

      await expect(
        service.addAttachment(
          "issue-1",
          "c1",
          {
            type: "screenshot",
            imageBase64: "abc",
          },
          TEST_USER_ID
        )
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeAttachment", () => {
    it("should remove attachment and return comment", async () => {
      const attachment = {
        id: "a1",
        commentId: "c1",
        mediaUrl: "uploads/screenshots/x.png",
      };
      const comment = { id: "c1", body: "Comment" };
      mockPrisma.commentAttachment.findFirst.mockResolvedValue(attachment);
      mockPrisma.commentAttachment.delete.mockResolvedValue(attachment);
      mockPrisma.issueComment.findUnique.mockResolvedValue(comment);

      const result = await service.removeAttachment(
        "issue-1",
        "c1",
        "a1",
        TEST_USER_ID
      );
      expect(result).toEqual(comment);
      expect(mockPrisma.commentAttachment.delete).toHaveBeenCalledWith({
        where: { id: "a1" },
      });
    });

    it("should throw NotFoundException when attachment not found", async () => {
      mockPrisma.commentAttachment.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAttachment("issue-1", "c1", "a1", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
    });

    it("should delete file when attachment media exists on disk", async () => {
      const attachment = {
        id: "a1",
        commentId: "c1",
        mediaUrl: "uploads/screenshots/x.png",
      };
      const comment = { id: "c1", body: "Comment" };
      mockPrisma.commentAttachment.findFirst.mockResolvedValue(attachment);
      mockPrisma.commentAttachment.delete.mockResolvedValue(attachment);
      mockPrisma.issueComment.findUnique.mockResolvedValue(comment);

      const result = await service.removeAttachment(
        "issue-1",
        "c1",
        "a1",
        TEST_USER_ID
      );
      expect(result).toEqual(comment);
      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/screenshots/x.png"
      );
    });
  });

  describe("delete", () => {
    it("should delete a comment when it exists", async () => {
      const comment = { id: "c1", issueId: "issue-1", attachments: [] };
      mockPrisma.issueComment.findFirst.mockResolvedValue(comment);
      mockPrisma.issueComment.delete.mockResolvedValue(comment);

      await service.delete("issue-1", "c1", TEST_USER_ID);
      expect(mockPrisma.issueComment.findFirst).toHaveBeenCalledWith({
        where: { id: "c1", issueId: "issue-1" },
        include: { attachments: true },
      });
      expect(mockPrisma.issueComment.delete).toHaveBeenCalledWith({
        where: { id: "c1" },
      });
    });

    it("should throw NotFoundException when comment does not exist", async () => {
      mockPrisma.issueComment.findFirst.mockResolvedValue(null);

      await expect(
        service.delete("issue-1", "missing", TEST_USER_ID)
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.delete("issue-1", "missing", TEST_USER_ID)
      ).rejects.toThrow("Comment not found");
      expect(mockPrisma.issueComment.delete).not.toHaveBeenCalled();
    });

    it("should delete comment and unlink attachment files when they exist", async () => {
      const comment = {
        id: "c1",
        issueId: "issue-1",
        attachments: [{ id: "a1", mediaUrl: "uploads/screenshots/x.png" }],
      };
      mockPrisma.issueComment.findFirst.mockResolvedValue(comment);
      mockPrisma.issueComment.delete.mockResolvedValue(comment);
      const existsSync = require("fs").existsSync;
      existsSync.mockReturnValue(true);

      await service.delete("issue-1", "c1", TEST_USER_ID);
      expect(mockPrisma.issueComment.delete).toHaveBeenCalledWith({
        where: { id: "c1" },
      });
    });
  });
});
