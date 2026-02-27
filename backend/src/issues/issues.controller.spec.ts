import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { IssuesController } from "./issues.controller";
import { IssuesService } from "./issues.service";
import { IssueCommentsService } from "./issue-comments.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

describe("IssuesController", () => {
  let controller: IssuesController;
  let service: IssuesService;

  const mockIssuesService = {
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
    streamRecording: jest.fn(),
    addRecording: jest.fn(),
    updateRecording: jest.fn(),
    removeRecording: jest.fn(),
    addScreenshot: jest.fn(),
    updateScreenshot: jest.fn(),
    removeScreenshot: jest.fn(),
    addFile: jest.fn(),
    streamFile: jest.fn(),
    updateFile: jest.fn(),
    removeFile: jest.fn(),
  };

  const mockIssueCommentsService = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    addAttachment: jest.fn(),
    removeAttachment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [
        { provide: IssuesService, useValue: mockIssuesService },
        { provide: IssueCommentsService, useValue: mockIssueCommentsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IssuesController>(IssuesController);
    service = module.get<IssuesService>(IssuesService);
  });

  const req = { user: { sub: "user-1" } };

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(
        controller.list(undefined, undefined, req as any)
      ).resolves.toEqual(list);
      expect(mockIssuesService.list).toHaveBeenCalledWith(
        undefined,
        undefined,
        "user-1"
      );
    });

    it("should pass projectId to service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(
        controller.list("p1", undefined, req as any)
      ).resolves.toEqual(list);
      expect(mockIssuesService.list).toHaveBeenCalledWith(
        "p1",
        undefined,
        "user-1"
      );
    });

    it("should pass projectId and search to service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(controller.list("p1", "bug", req as any)).resolves.toEqual(
        list
      );
      expect(mockIssuesService.list).toHaveBeenCalledWith(
        "p1",
        "bug",
        "user-1"
      );
    });

    it("should throw UnauthorizedException when req.user.sub is missing", async () => {
      expect(() => controller.list(undefined, undefined, {} as any)).toThrow(
        UnauthorizedException
      );
      expect(mockIssuesService.list).not.toHaveBeenCalled();
    });
  });

  describe("streamRecording", () => {
    it("should call service.streamRecording with filename, res and userId", async () => {
      const res = {} as any;
      mockIssuesService.streamRecording.mockResolvedValue(undefined);
      await controller.streamRecording("rec.webm", res, req as any);
      expect(mockIssuesService.streamRecording).toHaveBeenCalledWith(
        "rec.webm",
        res,
        "user-1"
      );
    });
  });

  describe("listComments", () => {
    it("should return result from commentsService.list()", async () => {
      const comments = [{ id: "c1", issueId: "1", body: "A comment" }];
      mockIssueCommentsService.list.mockResolvedValue(comments);

      await expect(controller.listComments("1", req as any)).resolves.toEqual(
        comments
      );
      expect(mockIssueCommentsService.list).toHaveBeenCalledWith("1", "user-1");
    });
  });

  describe("addCommentAttachment", () => {
    it("should delegate to commentsService.addAttachment", async () => {
      const body = { type: "screenshot" as const, imageBase64: "abc" };
      mockIssueCommentsService.addAttachment.mockResolvedValue({ id: "a1" });

      await expect(
        controller.addCommentAttachment("1", "c1", body, req as any)
      ).resolves.toEqual({ id: "a1" });
      expect(mockIssueCommentsService.addAttachment).toHaveBeenCalledWith(
        "1",
        "c1",
        body,
        "user-1"
      );
    });

    it("should pass empty attachment body safely when request body is missing", async () => {
      mockIssueCommentsService.addAttachment.mockResolvedValue({ id: "a1" });
      await controller.addCommentAttachment(
        "1",
        "c1",
        undefined as any,
        req as any
      );
      expect(mockIssueCommentsService.addAttachment).toHaveBeenCalledWith(
        "1",
        "c1",
        {},
        "user-1"
      );
    });
  });

  describe("createComment", () => {
    it("should pass id and body to commentsService.create()", async () => {
      const created = { id: "c1", issueId: "1", body: "New comment" };
      mockIssueCommentsService.create.mockResolvedValue(created);

      await expect(
        controller.createComment("1", { body: "New comment" }, req as any)
      ).resolves.toEqual(created);
      expect(mockIssueCommentsService.create).toHaveBeenCalledWith(
        "1",
        "New comment",
        "user-1"
      );
    });

    it("should pass undefined body safely when request body is missing", async () => {
      mockIssueCommentsService.create.mockResolvedValue({ id: "c1" });
      await controller.createComment("1", undefined as any, req as any);
      expect(mockIssueCommentsService.create).toHaveBeenCalledWith(
        "1",
        undefined,
        "user-1"
      );
    });
  });

  describe("updateComment", () => {
    it("should pass id, commentId and body to commentsService.update()", async () => {
      const updated = { id: "c1", body: "Updated" };
      mockIssueCommentsService.update.mockResolvedValue(updated);

      await expect(
        controller.updateComment("1", "c1", { body: "Updated" }, req as any)
      ).resolves.toEqual(updated);
      expect(mockIssueCommentsService.update).toHaveBeenCalledWith(
        "1",
        "c1",
        "Updated",
        "user-1"
      );
    });

    it("should pass undefined update body safely when request body is missing", async () => {
      mockIssueCommentsService.update.mockResolvedValue({ id: "c1" });
      await controller.updateComment("1", "c1", undefined as any, req as any);
      expect(mockIssueCommentsService.update).toHaveBeenCalledWith(
        "1",
        "c1",
        undefined,
        "user-1"
      );
    });
  });

  describe("deleteComment", () => {
    it("should pass issueId and commentId to commentsService.delete()", async () => {
      mockIssueCommentsService.delete.mockResolvedValue(undefined);

      await expect(
        controller.deleteComment("1", "c1", req as any)
      ).resolves.toBeUndefined();
      expect(mockIssueCommentsService.delete).toHaveBeenCalledWith(
        "1",
        "c1",
        "user-1"
      );
    });
  });

  describe("removeCommentAttachment", () => {
    it("should delegate to commentsService.removeAttachment", async () => {
      mockIssueCommentsService.removeAttachment.mockResolvedValue({ id: "c1" });

      await expect(
        controller.removeCommentAttachment("1", "c1", "a1", req as any)
      ).resolves.toEqual({ id: "c1" });
      expect(mockIssueCommentsService.removeAttachment).toHaveBeenCalledWith(
        "1",
        "c1",
        "a1",
        "user-1"
      );
    });
  });

  describe("addRecording", () => {
    it("should delegate to service with defaults", async () => {
      mockIssuesService.addRecording.mockResolvedValue({ id: "1" });

      await expect(
        controller.addRecording("1", { videoBase64: "abc" }, req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addRecording).toHaveBeenCalledWith(
        "1",
        "abc",
        "video",
        "screen",
        undefined,
        "user-1"
      );
    });

    it("should pass optional mediaType, recordingType, fileName", async () => {
      mockIssuesService.addRecording.mockResolvedValue({ id: "1" });

      await controller.addRecording(
        "1",
        {
          videoBase64: "abc",
          mediaType: "audio",
          recordingType: "camera",
          fileName: "rec.webm",
        },
        req as any
      );
      expect(mockIssuesService.addRecording).toHaveBeenCalledWith(
        "1",
        "abc",
        "audio",
        "camera",
        "rec.webm",
        "user-1"
      );
    });

    it("should pass undefined videoBase64 safely when body is missing", async () => {
      mockIssuesService.addRecording.mockResolvedValue({ id: "1" });
      await controller.addRecording("1", undefined as any, req as any);
      expect(mockIssuesService.addRecording).toHaveBeenCalledWith(
        "1",
        undefined,
        "video",
        "screen",
        undefined,
        "user-1"
      );
    });
  });

  describe("updateRecording", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateRecording.mockResolvedValue({ id: "1" });
      const body = { name: "New name" };

      await expect(
        controller.updateRecording("1", "r1", body, req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateRecording).toHaveBeenCalledWith(
        "1",
        "r1",
        body,
        "user-1"
      );
    });

    it("should pass empty update payload safely when body is missing", async () => {
      mockIssuesService.updateRecording.mockResolvedValue({ id: "1" });
      await controller.updateRecording("1", "r1", undefined as any, req as any);
      expect(mockIssuesService.updateRecording).toHaveBeenCalledWith(
        "1",
        "r1",
        {},
        "user-1"
      );
    });
  });

  describe("removeRecording", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeRecording.mockResolvedValue({ id: "1" });

      await expect(
        controller.removeRecording("1", "r1", req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.removeRecording).toHaveBeenCalledWith(
        "1",
        "r1",
        "user-1"
      );
    });
  });

  describe("addScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.addScreenshot.mockResolvedValue({ id: "1" });

      await expect(
        controller.addScreenshot("1", { imageBase64: "abc" }, req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addScreenshot).toHaveBeenCalledWith(
        "1",
        "abc",
        undefined,
        "user-1"
      );
    });

    it("should pass undefined imageBase64 safely when body is missing", async () => {
      mockIssuesService.addScreenshot.mockResolvedValue({ id: "1" });
      await controller.addScreenshot("1", undefined as any, req as any);
      expect(mockIssuesService.addScreenshot).toHaveBeenCalledWith(
        "1",
        undefined,
        undefined,
        "user-1"
      );
    });
  });

  describe("updateScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateScreenshot.mockResolvedValue({ id: "1" });

      await expect(
        controller.updateScreenshot("1", "s1", { name: "x" }, req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateScreenshot).toHaveBeenCalledWith(
        "1",
        "s1",
        "x",
        "user-1"
      );
    });

    it("should pass undefined name safely when body is missing", async () => {
      mockIssuesService.updateScreenshot.mockResolvedValue({ id: "1" });
      await controller.updateScreenshot(
        "1",
        "s1",
        undefined as any,
        req as any
      );
      expect(mockIssuesService.updateScreenshot).toHaveBeenCalledWith(
        "1",
        "s1",
        undefined,
        "user-1"
      );
    });
  });

  describe("removeScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeScreenshot.mockResolvedValue({ id: "1" });

      await expect(
        controller.removeScreenshot("1", "s1", req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.removeScreenshot).toHaveBeenCalledWith(
        "1",
        "s1",
        "user-1"
      );
    });
  });

  describe("addFile", () => {
    it("should throw BadRequest when fileBase64 or fileName missing", () => {
      expect(() => controller.addFile("1", {} as any, req as any)).toThrow(
        "fileBase64 and fileName are required"
      );
      expect(() =>
        controller.addFile("1", { fileBase64: "x" } as any, req as any)
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile("1", { fileName: "x" } as any, req as any)
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile(
          "1",
          { fileBase64: "x", fileName: "" } as any,
          req as any
        )
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile(
          "1",
          { fileBase64: "   ", fileName: "doc.pdf" } as any,
          req as any
        )
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile(
          "1",
          { fileBase64: "abc", fileName: "   " } as any,
          req as any
        )
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile(
          "1",
          { fileBase64: 123 as any, fileName: "doc.pdf" } as any,
          req as any
        )
      ).toThrow("fileBase64 and fileName are required");
      expect(() =>
        controller.addFile(
          "1",
          { fileBase64: "abc", fileName: 123 as any } as any,
          req as any
        )
      ).toThrow("fileBase64 and fileName are required");
    });

    it("should delegate to service when body valid", async () => {
      mockIssuesService.addFile.mockResolvedValue({ id: "1" });

      await expect(
        controller.addFile(
          "1",
          { fileBase64: "abc", fileName: "doc.pdf" },
          req as any
        )
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addFile).toHaveBeenCalledWith(
        "1",
        "abc",
        "doc.pdf",
        "user-1"
      );
    });
  });

  describe("streamFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.streamFile.mockResolvedValue(undefined);
      const res = {} as any;

      await expect(
        controller.streamFile("1", "f1", res, req as any)
      ).resolves.toBeUndefined();
      expect(mockIssuesService.streamFile).toHaveBeenCalledWith(
        "1",
        "f1",
        res,
        "user-1"
      );
    });
  });

  describe("updateFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateFile.mockResolvedValue({ id: "1" });

      await expect(
        controller.updateFile("1", "f1", { fileName: "new.pdf" }, req as any)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateFile).toHaveBeenCalledWith(
        "1",
        "f1",
        {
          fileName: "new.pdf",
        },
        "user-1"
      );
    });

    it("should pass empty update payload safely when body is missing", async () => {
      mockIssuesService.updateFile.mockResolvedValue({ id: "1" });
      await controller.updateFile("1", "f1", undefined as any, req as any);
      expect(mockIssuesService.updateFile).toHaveBeenCalledWith(
        "1",
        "f1",
        {},
        "user-1"
      );
    });
  });

  describe("removeFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeFile.mockResolvedValue(undefined);

      await expect(
        controller.removeFile("1", "f1", req as any)
      ).resolves.toBeUndefined();
      expect(mockIssuesService.removeFile).toHaveBeenCalledWith(
        "1",
        "f1",
        "user-1"
      );
    });
  });

  describe("get", () => {
    it("should return result from service.get()", async () => {
      const issue = { id: "1", title: "Issue 1" };
      mockIssuesService.get.mockResolvedValue(issue);

      await expect(controller.get("1", req as any)).resolves.toEqual(issue);
      expect(mockIssuesService.get).toHaveBeenCalledWith("1", "user-1");
    });
  });

  describe("create", () => {
    it("should pass body to service.create()", async () => {
      const body = { title: "New", description: "Desc", projectId: "p1" };
      const created = { id: "1", ...body };
      mockIssuesService.create.mockResolvedValue(created);

      await expect(controller.create(body, req as any)).resolves.toEqual(
        created
      );
      expect(mockIssuesService.create).toHaveBeenCalledWith(body, "user-1");
    });

    it("should pass empty object safely when create body is missing", async () => {
      mockIssuesService.create.mockResolvedValue({ id: "1" });
      await controller.create(undefined as any, req as any);
      expect(mockIssuesService.create).toHaveBeenCalledWith({}, "user-1");
    });
  });

  describe("update", () => {
    it("should pass id and body to service.update()", async () => {
      const body = { title: "Updated", status: "in_progress" };
      const updated = { id: "1", ...body };
      mockIssuesService.update.mockResolvedValue(updated);

      await expect(controller.update("1", body, req as any)).resolves.toEqual(
        updated
      );
      expect(mockIssuesService.update).toHaveBeenCalledWith(
        "1",
        body,
        "user-1"
      );
    });

    it("should pass empty object safely when update body is missing", async () => {
      mockIssuesService.update.mockResolvedValue({ id: "1" });
      await controller.update("1", undefined as any, req as any);
      expect(mockIssuesService.update).toHaveBeenCalledWith("1", {}, "user-1");
    });
  });

  describe("updateStatus", () => {
    it("should pass id and status to service.updateStatus()", async () => {
      const updated = { id: "1", title: "Issue", status: "done" };
      mockIssuesService.updateStatus.mockResolvedValue(updated);

      await expect(
        controller.updateStatus("1", { status: "done" }, req as any)
      ).resolves.toEqual(updated);
      expect(mockIssuesService.updateStatus).toHaveBeenCalledWith(
        "1",
        "done",
        "user-1"
      );
    });

    it("should pass undefined status safely when body is missing", async () => {
      mockIssuesService.updateStatus.mockResolvedValue({ id: "1" });
      await controller.updateStatus("1", undefined as any, req as any);
      expect(mockIssuesService.updateStatus).toHaveBeenCalledWith(
        "1",
        undefined,
        "user-1"
      );
    });
  });

  describe("remove", () => {
    it("should call service.delete() with id", async () => {
      mockIssuesService.delete.mockResolvedValue({ id: "1" });

      await expect(controller.remove("1", req as any)).resolves.toEqual({
        id: "1",
      });
      expect(mockIssuesService.delete).toHaveBeenCalledWith("1", "user-1");
    });
  });
});
