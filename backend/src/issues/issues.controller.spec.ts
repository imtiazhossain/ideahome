import { Test, TestingModule } from "@nestjs/testing";
import { IssuesController } from "./issues.controller";
import { IssuesService } from "./issues.service";
import { IssueCommentsService } from "./issue-comments.service";

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
    }).compile();

    controller = module.get<IssuesController>(IssuesController);
    service = module.get<IssuesService>(IssuesService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("list", () => {
    it("should return result from service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(controller.list()).resolves.toEqual(list);
      expect(mockIssuesService.list).toHaveBeenCalledWith(undefined, undefined);
    });

    it("should pass projectId to service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(controller.list("p1")).resolves.toEqual(list);
      expect(mockIssuesService.list).toHaveBeenCalledWith("p1", undefined);
    });

    it("should pass projectId and search to service.list()", async () => {
      const list = [{ id: "1", title: "Issue 1", projectId: "p1" }];
      mockIssuesService.list.mockResolvedValue(list);

      await expect(controller.list("p1", "bug")).resolves.toEqual(list);
      expect(mockIssuesService.list).toHaveBeenCalledWith("p1", "bug");
    });
  });

  describe("streamRecording", () => {
    it("should call service.streamRecording with filename and res", () => {
      const res = {} as any;
      controller.streamRecording("rec.webm", res);
      expect(mockIssuesService.streamRecording).toHaveBeenCalledWith(
        "rec.webm",
        res
      );
    });
  });

  describe("listComments", () => {
    it("should return result from commentsService.list()", async () => {
      const comments = [{ id: "c1", issueId: "1", body: "A comment" }];
      mockIssueCommentsService.list.mockResolvedValue(comments);

      await expect(controller.listComments("1")).resolves.toEqual(comments);
      expect(mockIssueCommentsService.list).toHaveBeenCalledWith("1");
    });
  });

  describe("addCommentAttachment", () => {
    it("should delegate to commentsService.addAttachment", async () => {
      const body = { type: "screenshot" as const, imageBase64: "abc" };
      mockIssueCommentsService.addAttachment.mockResolvedValue({ id: "a1" });

      await expect(
        controller.addCommentAttachment("1", "c1", body)
      ).resolves.toEqual({ id: "a1" });
      expect(mockIssueCommentsService.addAttachment).toHaveBeenCalledWith(
        "1",
        "c1",
        body
      );
    });
  });

  describe("createComment", () => {
    it("should pass id and body to commentsService.create()", async () => {
      const created = { id: "c1", issueId: "1", body: "New comment" };
      mockIssueCommentsService.create.mockResolvedValue(created);

      await expect(
        controller.createComment("1", { body: "New comment" })
      ).resolves.toEqual(created);
      expect(mockIssueCommentsService.create).toHaveBeenCalledWith(
        "1",
        "New comment"
      );
    });
  });

  describe("updateComment", () => {
    it("should pass id, commentId and body to commentsService.update()", async () => {
      const updated = { id: "c1", body: "Updated" };
      mockIssueCommentsService.update.mockResolvedValue(updated);

      await expect(
        controller.updateComment("1", "c1", { body: "Updated" })
      ).resolves.toEqual(updated);
      expect(mockIssueCommentsService.update).toHaveBeenCalledWith(
        "1",
        "c1",
        "Updated"
      );
    });
  });

  describe("deleteComment", () => {
    it("should pass issueId and commentId to commentsService.delete()", async () => {
      mockIssueCommentsService.delete.mockResolvedValue(undefined);

      await expect(
        controller.deleteComment("1", "c1")
      ).resolves.toBeUndefined();
      expect(mockIssueCommentsService.delete).toHaveBeenCalledWith("1", "c1");
    });
  });

  describe("removeCommentAttachment", () => {
    it("should delegate to commentsService.removeAttachment", async () => {
      mockIssueCommentsService.removeAttachment.mockResolvedValue({ id: "c1" });

      await expect(
        controller.removeCommentAttachment("1", "c1", "a1")
      ).resolves.toEqual({ id: "c1" });
      expect(mockIssueCommentsService.removeAttachment).toHaveBeenCalledWith(
        "1",
        "c1",
        "a1"
      );
    });
  });

  describe("addRecording", () => {
    it("should delegate to service with defaults", async () => {
      mockIssuesService.addRecording.mockResolvedValue({ id: "1" });

      await expect(
        controller.addRecording("1", { videoBase64: "abc" })
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addRecording).toHaveBeenCalledWith(
        "1",
        "abc",
        "video",
        "screen",
        undefined
      );
    });

    it("should pass optional mediaType, recordingType, fileName", async () => {
      mockIssuesService.addRecording.mockResolvedValue({ id: "1" });

      await controller.addRecording("1", {
        videoBase64: "abc",
        mediaType: "audio",
        recordingType: "camera",
        fileName: "rec.webm",
      });
      expect(mockIssuesService.addRecording).toHaveBeenCalledWith(
        "1",
        "abc",
        "audio",
        "camera",
        "rec.webm"
      );
    });
  });

  describe("updateRecording", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateRecording.mockResolvedValue({ id: "1" });
      const body = { name: "New name" };

      await expect(
        controller.updateRecording("1", "r1", body)
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateRecording).toHaveBeenCalledWith(
        "1",
        "r1",
        body
      );
    });
  });

  describe("removeRecording", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeRecording.mockResolvedValue({ id: "1" });

      await expect(controller.removeRecording("1", "r1")).resolves.toEqual({
        id: "1",
      });
      expect(mockIssuesService.removeRecording).toHaveBeenCalledWith("1", "r1");
    });
  });

  describe("addScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.addScreenshot.mockResolvedValue({ id: "1" });

      await expect(
        controller.addScreenshot("1", { imageBase64: "abc" })
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addScreenshot).toHaveBeenCalledWith(
        "1",
        "abc",
        undefined
      );
    });
  });

  describe("updateScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateScreenshot.mockResolvedValue({ id: "1" });

      await expect(
        controller.updateScreenshot("1", "s1", { name: "x" })
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateScreenshot).toHaveBeenCalledWith(
        "1",
        "s1",
        "x"
      );
    });
  });

  describe("removeScreenshot", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeScreenshot.mockResolvedValue({ id: "1" });

      await expect(controller.removeScreenshot("1", "s1")).resolves.toEqual({
        id: "1",
      });
      expect(mockIssuesService.removeScreenshot).toHaveBeenCalledWith(
        "1",
        "s1"
      );
    });
  });

  describe("addFile", () => {
    it("should throw BadRequest when fileBase64 or fileName missing", () => {
      expect(() => controller.addFile("1", {} as any)).toThrow(
        "fileBase64 and fileName are required"
      );
      expect(() => controller.addFile("1", { fileBase64: "x" } as any)).toThrow(
        "fileBase64 and fileName are required"
      );
      expect(() => controller.addFile("1", { fileName: "x" } as any)).toThrow(
        "fileBase64 and fileName are required"
      );
      expect(() =>
        controller.addFile("1", { fileBase64: "x", fileName: "" } as any)
      ).toThrow("fileBase64 and fileName are required");
    });

    it("should delegate to service when body valid", async () => {
      mockIssuesService.addFile.mockResolvedValue({ id: "1" });

      await expect(
        controller.addFile("1", { fileBase64: "abc", fileName: "doc.pdf" })
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.addFile).toHaveBeenCalledWith(
        "1",
        "abc",
        "doc.pdf"
      );
    });
  });

  describe("streamFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.streamFile.mockResolvedValue(undefined);

      await expect(
        controller.streamFile("1", "f1", {} as any)
      ).resolves.toBeUndefined();
      expect(mockIssuesService.streamFile).toHaveBeenCalledWith(
        "1",
        "f1",
        {} as any
      );
    });
  });

  describe("updateFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.updateFile.mockResolvedValue({ id: "1" });

      await expect(
        controller.updateFile("1", "f1", { fileName: "new.pdf" })
      ).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.updateFile).toHaveBeenCalledWith("1", "f1", {
        fileName: "new.pdf",
      });
    });
  });

  describe("removeFile", () => {
    it("should delegate to service", async () => {
      mockIssuesService.removeFile.mockResolvedValue(undefined);

      await expect(controller.removeFile("1", "f1")).resolves.toBeUndefined();
      expect(mockIssuesService.removeFile).toHaveBeenCalledWith("1", "f1");
    });
  });

  describe("get", () => {
    it("should return result from service.get()", async () => {
      const issue = { id: "1", title: "Issue 1" };
      mockIssuesService.get.mockResolvedValue(issue);

      await expect(controller.get("1")).resolves.toEqual(issue);
      expect(mockIssuesService.get).toHaveBeenCalledWith("1");
    });
  });

  describe("create", () => {
    it("should pass body to service.create()", async () => {
      const body = { title: "New", description: "Desc", projectId: "p1" };
      const created = { id: "1", ...body };
      mockIssuesService.create.mockResolvedValue(created);

      await expect(controller.create(body)).resolves.toEqual(created);
      expect(mockIssuesService.create).toHaveBeenCalledWith(body);
    });
  });

  describe("update", () => {
    it("should pass id and body to service.update()", async () => {
      const body = { title: "Updated", status: "in_progress" };
      const updated = { id: "1", ...body };
      mockIssuesService.update.mockResolvedValue(updated);

      await expect(controller.update("1", body)).resolves.toEqual(updated);
      expect(mockIssuesService.update).toHaveBeenCalledWith("1", body);
    });
  });

  describe("updateStatus", () => {
    it("should pass id and status to service.updateStatus()", async () => {
      const updated = { id: "1", title: "Issue", status: "done" };
      mockIssuesService.updateStatus.mockResolvedValue(updated);

      await expect(
        controller.updateStatus("1", { status: "done" })
      ).resolves.toEqual(updated);
      expect(mockIssuesService.updateStatus).toHaveBeenCalledWith("1", "done");
    });
  });

  describe("remove", () => {
    it("should call service.delete() with id", async () => {
      mockIssuesService.delete.mockResolvedValue({ id: "1" });

      await expect(controller.remove("1")).resolves.toEqual({ id: "1" });
      expect(mockIssuesService.delete).toHaveBeenCalledWith("1");
    });
  });
});
