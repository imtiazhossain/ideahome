import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AuthenticatedRequest, requireUserId } from "../auth/request-user";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { IssueCommentsService } from "./issue-comments.service";
import { IssuesService } from "./issues.service";

@Controller("issues")
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(
    private readonly svc: IssuesService,
    private readonly commentsSvc: IssueCommentsService
  ) {}

  private userId(req: AuthenticatedRequest): string {
    return requireUserId(req);
  }

  @Get()
  list(
    @Query("projectId") projectId: string | undefined,
    @Query("search") search: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.list(projectId, search, this.userId(req));
  }

  @Get("recordings/stream/:filename")
  async streamRecording(
    @Param("filename") filename: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.streamRecording(filename, res, this.userId(req));
  }

  @Get("screenshots/stream/:filename")
  async streamScreenshotByFilename(
    @Param("filename") filename: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    await this.svc.streamScreenshotByFilename(filename, res, this.userId(req));
  }

  @Get(":id/comments")
  listComments(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.commentsSvc.list(id, this.userId(req));
  }

  @Post(":id/comments/:commentId/attachments")
  addCommentAttachment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Body()
    body: {
      type: "screenshot" | "video" | "screen_recording" | "camera_recording";
      imageBase64?: string;
      videoBase64?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.commentsSvc.addAttachment(
      id,
      commentId,
      payload,
      this.userId(req)
    );
  }

  @Post(":id/comments")
  createComment(
    @Param("id") id: string,
    @Body() body: { body: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.commentsSvc.create(id, body?.body, this.userId(req));
  }

  @Delete(":id/comments/:commentId/attachments/:attachmentId")
  removeCommentAttachment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.commentsSvc.removeAttachment(
      id,
      commentId,
      attachmentId,
      this.userId(req)
    );
  }

  @Patch(":id/comments/:commentId")
  updateComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Body() body: { body: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.commentsSvc.update(id, commentId, body?.body, this.userId(req));
  }

  @Delete(":id/comments/:commentId")
  deleteComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.commentsSvc.delete(id, commentId, this.userId(req));
  }

  @Post(":id/recordings")
  addRecording(
    @Param("id") id: string,
    @Body()
    body: {
      videoBase64: string;
      mediaType?: "video" | "audio";
      recordingType?: "screen" | "camera" | "audio";
      fileName?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.svc.addRecording(
      id,
      payload.videoBase64,
      payload.mediaType ?? "video",
      payload.recordingType ?? "screen",
      payload.fileName,
      this.userId(req)
    );
  }

  @Patch(":id/recordings/:recordingId")
  updateRecording(
    @Param("id") id: string,
    @Param("recordingId") recordingId: string,
    @Body()
    body: {
      mediaType?: "video" | "audio";
      recordingType?: "screen" | "camera" | "audio";
      name?: string | null;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.updateRecording(
      id,
      recordingId,
      body ?? {},
      this.userId(req)
    );
  }

  @Delete(":id/recordings/:recordingId")
  removeRecording(
    @Param("id") id: string,
    @Param("recordingId") recordingId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.removeRecording(id, recordingId, this.userId(req));
  }

  @Post(":id/screenshots")
  addScreenshot(
    @Param("id") id: string,
    @Body() body: { imageBase64: string; fileName?: string },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.svc.addScreenshot(
      id,
      payload.imageBase64,
      payload.fileName,
      this.userId(req)
    );
  }

  @Patch(":id/screenshots/:screenshotId")
  updateScreenshot(
    @Param("id") id: string,
    @Param("screenshotId") screenshotId: string,
    @Body() body: { name?: string | null },
    @Req() req: AuthenticatedRequest
  ) {
    const payload = body ?? {};
    return this.svc.updateScreenshot(
      id,
      screenshotId,
      payload.name,
      this.userId(req)
    );
  }

  @Delete(":id/screenshots/:screenshotId")
  removeScreenshot(
    @Param("id") id: string,
    @Param("screenshotId") screenshotId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.removeScreenshot(id, screenshotId, this.userId(req));
  }

  @Post(":id/files")
  addFile(
    @Param("id") id: string,
    @Body() body: { fileBase64?: string; fileName?: string },
    @Req() req: AuthenticatedRequest
  ) {
    const fileBase64 = body?.fileBase64;
    const fileName = body?.fileName;
    if (
      typeof fileBase64 !== "string" ||
      typeof fileName !== "string" ||
      fileBase64.trim() === "" ||
      fileName.trim() === ""
    ) {
      throw new BadRequestException("fileBase64 and fileName are required");
    }
    return this.svc.addFile(id, fileBase64, fileName, this.userId(req));
  }

  @Get(":id/files/:fileId/stream")
  streamFile(
    @Param("id") id: string,
    @Param("fileId") fileId: string,
    @Res() res: Response,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.streamFile(id, fileId, res, this.userId(req));
  }

  @Patch(":id/files/:fileId")
  updateFile(
    @Param("id") id: string,
    @Param("fileId") fileId: string,
    @Body() body: { fileName?: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.updateFile(id, fileId, body ?? {}, this.userId(req));
  }

  @Delete(":id/files/:fileId")
  removeFile(
    @Param("id") id: string,
    @Param("fileId") fileId: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.removeFile(id, fileId, this.userId(req));
  }

  @Get(":id")
  get(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.get(id, this.userId(req));
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      description?: string;
      acceptanceCriteria?: string;
      database?: string;
      api?: string;
      testCases?: string;
      automatedTest?: string;
      status?: string;
      qualityScore?: number;
      projectId: string;
      assigneeId?: string;
    },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.create(body ?? {}, this.userId(req));
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.update(
      id,
      (body ?? {}) as Record<string, unknown>,
      this.userId(req)
    );
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() body: { status: string },
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.updateStatus(id, body?.status, this.userId(req));
  }

  @Delete("bulk")
  removeAll(
    @Query("projectId") projectId: string | undefined,
    @Req() req: AuthenticatedRequest
  ) {
    return this.svc.deleteMany(projectId, this.userId(req));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.svc.delete(id, this.userId(req));
  }
}
