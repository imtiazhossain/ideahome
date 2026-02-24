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
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { IssuesService } from "./issues.service";
import { IssueCommentsService } from "./issue-comments.service";

@Controller("issues")
export class IssuesController {
  constructor(
    private readonly svc: IssuesService,
    private readonly commentsSvc: IssueCommentsService
  ) {}

  @Get()
  list(
    @Query("projectId") projectId?: string,
    @Query("search") search?: string
  ) {
    return this.svc.list(projectId, search);
  }

  @Get("recordings/stream/:filename")
  streamRecording(@Param("filename") filename: string, @Res() res: Response) {
    this.svc.streamRecording(filename, res);
  }

  @Get(":id/comments")
  listComments(@Param("id") id: string) {
    return this.commentsSvc.list(id);
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
    }
  ) {
    return this.commentsSvc.addAttachment(id, commentId, body);
  }

  @Post(":id/comments")
  createComment(@Param("id") id: string, @Body() body: { body: string }) {
    return this.commentsSvc.create(id, body.body);
  }

  @Delete(":id/comments/:commentId/attachments/:attachmentId")
  removeCommentAttachment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Param("attachmentId") attachmentId: string
  ) {
    return this.commentsSvc.removeAttachment(id, commentId, attachmentId);
  }

  @Patch(":id/comments/:commentId")
  updateComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string,
    @Body() body: { body: string }
  ) {
    return this.commentsSvc.update(id, commentId, body.body);
  }

  @Delete(":id/comments/:commentId")
  deleteComment(
    @Param("id") id: string,
    @Param("commentId") commentId: string
  ) {
    return this.commentsSvc.delete(id, commentId);
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
    }
  ) {
    return this.svc.addRecording(
      id,
      body.videoBase64,
      body.mediaType ?? "video",
      body.recordingType ?? "screen",
      body.fileName
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
    }
  ) {
    return this.svc.updateRecording(id, recordingId, body);
  }

  @Delete(":id/recordings/:recordingId")
  removeRecording(
    @Param("id") id: string,
    @Param("recordingId") recordingId: string
  ) {
    return this.svc.removeRecording(id, recordingId);
  }

  @Post(":id/screenshots")
  addScreenshot(
    @Param("id") id: string,
    @Body() body: { imageBase64: string; fileName?: string }
  ) {
    return this.svc.addScreenshot(id, body.imageBase64, body.fileName);
  }

  @Patch(":id/screenshots/:screenshotId")
  updateScreenshot(
    @Param("id") id: string,
    @Param("screenshotId") screenshotId: string,
    @Body() body: { name?: string | null }
  ) {
    return this.svc.updateScreenshot(id, screenshotId, body.name);
  }

  @Delete(":id/screenshots/:screenshotId")
  removeScreenshot(
    @Param("id") id: string,
    @Param("screenshotId") screenshotId: string
  ) {
    return this.svc.removeScreenshot(id, screenshotId);
  }

  @Post(":id/files")
  addFile(
    @Param("id") id: string,
    @Body() body: { fileBase64?: string; fileName?: string }
  ) {
    if (
      body?.fileBase64 == null ||
      body?.fileName == null ||
      body.fileName === ""
    ) {
      throw new BadRequestException("fileBase64 and fileName are required");
    }
    return this.svc.addFile(id, body.fileBase64, body.fileName);
  }

  @Get(":id/files/:fileId/stream")
  streamFile(
    @Param("id") id: string,
    @Param("fileId") fileId: string,
    @Res() res: Response
  ) {
    return this.svc.streamFile(id, fileId, res);
  }

  @Patch(":id/files/:fileId")
  updateFile(
    @Param("id") id: string,
    @Param("fileId") fileId: string,
    @Body() body: { fileName?: string }
  ) {
    return this.svc.updateFile(id, fileId, body);
  }

  @Delete(":id/files/:fileId")
  removeFile(@Param("id") id: string, @Param("fileId") fileId: string) {
    return this.svc.removeFile(id, fileId);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.svc.get(id);
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
      qualityScore?: number;
      projectId: string;
      assigneeId?: string;
    }
  ) {
    return this.svc.create(body);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.svc.update(id, body);
  }

  @Patch(":id/status")
  updateStatus(@Param("id") id: string, @Body() body: { status: string }) {
    return this.svc.updateStatus(id, body.status);
  }

  @Delete("bulk")
  removeAll(@Query("projectId") projectId?: string) {
    return this.svc.deleteMany(projectId);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.svc.delete(id);
  }
}
